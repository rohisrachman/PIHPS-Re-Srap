"""
PIHPS BI — Flask Scraping Dashboard
Algoritma: REST API langsung (requests) — tanpa Selenium/Chrome
Endpoint: bi.go.id/hargapangan/WebSite/TabelHarga/*
Database: SQLite untuk menyimpan data historis selama 1 tahun
"""

import io
import time
import re
import threading
import uuid
import os
import sqlite3
from datetime import datetime, timedelta
from contextlib import contextmanager

from flask import Flask, render_template, request, jsonify, send_file
import requests
import pandas as pd
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)

BASE = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga"
HEADERS = {
    "User-Agent"      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer"         : "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas",
    "X-Requested-With": "XMLHttpRequest",
}

# Database config
DB_PATH = os.path.join(os.path.dirname(__file__), 'pihps_data.db')

jobs = {}

# ─── Database Setup ───────────────────────────────────────────────────────────

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS price_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                commodity_name TEXT NOT NULL,
                province_name TEXT NOT NULL,
                regency_name TEXT NOT NULL,
                price REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, commodity_name, province_name, regency_name)
            )
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_date_commodity 
            ON price_data(date, commodity_name)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_date_province 
            ON price_data(date, province_name)
        ''')
        conn.commit()


def save_price_data(df, province_name):
    """Save scraped data to database, returns count of saved records"""
    try:
        print(f"\n[SAVE_DATA] Starting save for province: {province_name}")
        print(f"[SAVE_DATA] DataFrame shape: {df.shape}, columns: {list(df.columns)}\n")
        
        if df.empty:
            print("[SAVE_DATA] ⚠️ DataFrame is empty!")
            return 0
        
        with get_db() as conn:
            cursor = conn.cursor()
            saved_count = 0
            skipped_count = 0
            
            for idx, row in df.iterrows():
                try:
                    # Extract commodity - must have 'Komoditas' column
                    commodity = ''
                    if 'Komoditas' in df.columns and pd.notna(row['Komoditas']):
                        commodity = str(row['Komoditas']).strip()
                    if not commodity or commodity == 'nan':
                        skipped_count += 1
                        continue
                    
                    # Extract regency - try multiple column names
                    regency = 'Unknown'
                    for col in ['name', 'regency_name', 'kab_kota', 'Kab/Kota', 'kabupaten']:
                        if col in df.columns and pd.notna(row[col]):
                            regency = str(row[col]).strip()
                            break
                    
                    # Process dynamic date columns (Wide format)
                    exclude_cols = {'komoditas', 'name', 'regency_name', 'kab_kota', 'kab/kota', 'kabupaten', 'id', 'no', 'level'}
                    month_map = {
                        'jan': 1, 'january': 1,
                        'feb': 2, 'february': 2,
                        'mar': 3, 'march': 3,
                        'apr': 4, 'april': 4,
                        'may': 5,
                        'jun': 6, 'june': 6,
                        'jul': 7, 'july': 7,
                        'ago': 8, 'aug': 8, 'august': 8,
                        'sep': 9, 'september': 9,
                        'okt': 10, 'oct': 10, 'october': 10,
                        'nov': 11, 'november': 11,
                        'des': 12, 'dec': 12, 'december': 12,
                    }
                    
                    for col in df.columns:
                        if str(col).lower() in exclude_cols:
                            continue
                            
                        date_str = str(col).strip()
                        db_date = None
                        
                        # Try parse "Dec 2025 (IV)" or "Dec 2025" format
                        month_year_match = re.search(r'([A-Za-z]+)\s+(\d{4})', date_str)
                        if month_year_match:
                            month_str = month_year_match.group(1).lower()[:3]
                            year_str = month_year_match.group(2)
                            if month_str in month_map:
                                m = month_map[month_str]
                                # Use 15th of the month as default day
                                db_date = f"{year_str}-{m:02d}-15"
                        else:
                            # Try parse DD-MM-YYYY or DD/MM/YYYY
                            match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', date_str)
                            if match:
                                d, m, y = match.groups()
                                db_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
                            else:
                                # Try parse YYYY-MM-DD
                                match_iso = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', date_str)
                                if match_iso:
                                    y, m, d = match_iso.groups()
                                    db_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
                                
                        if not db_date:
                            continue
                            
                        raw_price = row[col]
                        if pd.isna(raw_price) or str(raw_price).strip() in ('', '-', '0'):
                            continue
                            
                        # Clean price string for IDR formats
                        price_str = str(raw_price).strip().replace(',', '')
                        if price_str.count('.') == 1 and len(price_str.split('.')[1]) == 3:
                            price_str = price_str.replace('.', '')
                            
                        try:
                            price = float(price_str)
                        except ValueError:
                            continue
                            
                        if price > 0:
                            cursor.execute('''
                                INSERT OR REPLACE INTO price_data 
                                (date, commodity_name, province_name, regency_name, price)
                                VALUES (?, ?, ?, ?, ?)
                            ''', (db_date, commodity, province_name, regency, price))
                            saved_count += 1
                
                except Exception as e:
                    print(f"[SAVE_DATA] Row {idx} error: {e}")
                    skipped_count += 1
                    continue
            
            conn.commit()
            print(f"[SAVE_DATA] ✅ Saved {saved_count} records, skipped {skipped_count}\n")
            return saved_count
            
    except Exception as e:
        print(f"[SAVE_DATA] ❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def get_price_chart_data(days=365):
    """Get price trend data for chart"""
    try:
        cutoff_date = (datetime.now() - timedelta(days=days)).date()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT date, commodity_name, AVG(price) as avg_price
                FROM price_data
                WHERE date >= ?
                GROUP BY date, commodity_name
                ORDER BY date ASC
            ''', (str(cutoff_date),))
            
            result = {}
            for row in cursor.fetchall():
                key = row['date']
                if key not in result:
                    result[key] = {}
                result[key][row['commodity_name']] = row['avg_price']
            
            return result
    except Exception as e:
        print(f"Error getting chart data: {e}")
        return {}


def get_commodity_stats():
    """Get commodity statistics"""
    try:
        cutoff_date = (datetime.now() - timedelta(days=365)).date()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT commodity_name, 
                       COUNT(*) as count,
                       AVG(price) as avg_price,
                       MIN(price) as min_price,
                       MAX(price) as max_price
                FROM price_data
                WHERE date >= ?
                GROUP BY commodity_name
                ORDER BY avg_price DESC
            ''', (str(cutoff_date),))
            
            result = []
            for row in cursor.fetchall():
                result.append({
                    'commodity': row['commodity_name'],
                    'count': row['count'],
                    'avg_price': round(row['avg_price'], 2) if row['avg_price'] else 0,
                    'min_price': round(row['min_price'], 2) if row['min_price'] else 0,
                    'max_price': round(row['max_price'], 2) if row['max_price'] else 0,
                })
            return result
    except Exception as e:
        print(f"Error getting commodity stats: {e}")
        return []


def get_latest_prices():
    """Get latest prices for all commodities"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                WITH LatestDates AS (
                    SELECT commodity_name, MAX(date) as max_date
                    FROM price_data
                    GROUP BY commodity_name
                )
                SELECT p.commodity_name, AVG(p.price) as latest_price, p.date as latest_date
                FROM price_data p
                JOIN LatestDates l ON p.commodity_name = l.commodity_name AND p.date = l.max_date
                GROUP BY p.commodity_name, p.date
                ORDER BY p.commodity_name
            ''')
            
            result = []
            for row in cursor.fetchall():
                result.append({
                    'commodity': row['commodity_name'],
                    'price': round(row['latest_price'] or 0, 2),
                    'date': row['latest_date'],
                })
            return result
    except Exception as e:
        print(f"Error getting latest prices: {e}")
        return []


# Initialize database
init_db()


# ─── Helpers API ─────────────────────────────────────────────────────────────

def get_json(url, params=None):
    resp = requests.get(url, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def flatten_rows(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get('data') or data.get('rows') or []
    return []


def get_province_id(provinsi_target):
    data = get_json(f"{BASE}/GetRefProvince")
    for p in flatten_rows(data):
        nama = str(p.get('province_name') or p.get('name') or p.get('text') or p.get('label') or '')
        if provinsi_target.lower() in nama.lower():
            pid = p.get('province_id') or p.get('id') or p.get('value')
            return pid, nama
    return None, None


def get_regency_ids(province_id, kabkota_target):
    data = get_json(f"{BASE}/GetRefRegency", params={
        "price_type_id": 1,
        "ref_prov_id"  : province_id
    })
    ids, names, all_options = [], [], []
    for r in flatten_rows(data):
        nama = str(r.get('regency_name') or r.get('name') or r.get('text') or r.get('label') or '')
        rid  = r.get('regency_id') or r.get('id') or r.get('value')
        all_options.append({'id': rid, 'name': nama.strip()})
        
        if not kabkota_target:
            ids.append(str(rid))
            names.append(nama.strip())
        else:
            for target in kabkota_target:
                if target.lower() in nama.lower():
                    ids.append(str(rid))
                    names.append(nama.strip())
                    break
    return ids, names, all_options


def get_komoditas_list():
    data = get_json(f"{BASE}/GetRefCommodityAndCategory")
    result = []
    for item in flatten_rows(data):
        nama = str(item.get('commodity_name') or item.get('name') or item.get('text') or item.get('label') or '')
        cid  = item.get('comcat_id') or item.get('id') or item.get('value')
        if nama and cid:  # Accept any non-empty ID, not just 'cat' prefixed
            result.append({'name': nama, 'comcat_id': str(cid)})
    return result


def scrape_komoditas_api(comcat_id, nama_komoditas, province_id,
                          regency_ids, tgl_mulai, tgl_selesai, tipe_laporan):
    regency_str = ",".join(regency_ids) if regency_ids else ""
    params = {
        "price_type_id": 1,
        "comcat_id"    : comcat_id,
        "province_id"  : province_id,
        "regency_id"   : regency_str,
        "showKota"     : "true",
        "showPasar"    : "false",
        "tipe_laporan" : tipe_laporan,
        "start_date"   : tgl_mulai,
        "end_date"     : tgl_selesai,
    }
    resp = requests.get(f"{BASE}/GetGridDataKomoditas",
                        params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    rows = flatten_rows(data)
    if not rows and isinstance(data, dict):
        for key in ['data', 'rows', 'result', 'items']:
            if key in data and data[key]:
                rows = data[key]
                break

    if rows:
        df = pd.DataFrame(rows)
        df.insert(0, 'Komoditas', nama_komoditas)
        return df
    return None


# ─── Background job ──────────────────────────────────────────────────────────

def run_scraping_job(job_id, params):
    job = jobs[job_id]
    job['status']     = 'running'
    job['started_at'] = datetime.now().isoformat()
    job['logs']       = []
    job['current']    = 0
    job['total']      = 0

    def log(msg):
        ts = datetime.now().strftime('%H:%M:%S')
        job['logs'].append(f"[{ts}] {msg}")

    provinsi     = params['provinsi']
    kabkota_list = params['kabkota_target']
    
    # Safety fallback if date format given from frontend is different
    def clean_date_param(d):
        m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', d)
        if m: return f"{m.group(1).zfill(2)}-{m.group(2).zfill(2)}-{m.group(3)}"
        m_iso = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', d)
        if m_iso: return f"{m_iso.group(3).zfill(2)}-{m_iso.group(2).zfill(2)}-{m_iso.group(1)}"
        return d

    tgl_mulai    = clean_date_param(params['tanggal_mulai'])
    tgl_selesai  = clean_date_param(params['tanggal_selesai'])
    tipe_laporan = int(params.get('tipe_laporan', 2))
    kom_filter   = params.get('komoditas_filter', [])

    semua_data = []
    gagal      = []

    try:
        log(f"📡 Resolving provinsi '{provinsi}'...")
        province_id, province_name = get_province_id(provinsi)
        if not province_id:
            raise Exception(f"Provinsi '{provinsi}' tidak ditemukan")
        log(f"   ✅ {province_name} → ID={province_id}")

        log(f"📡 Mengambil kab/kota (province_id={province_id})...")
        regency_ids, regency_names, all_reg = get_regency_ids(province_id, kabkota_list)
        job['regency_options'] = all_reg

        if kabkota_list and not regency_ids:
            log("   ⚠️  Kab/kota tidak cocok — semua opsi:")
            for r in all_reg:
                log(f"      • {r['name']} (ID={r['id']})")
            log("   ℹ️  Lanjut tanpa filter kab/kota")
        else:
            for n, i in zip(regency_names, regency_ids):
                log(f"   ✅ {n} → ID={i}")

        log("📡 Mengambil daftar komoditas dari API...")
        komoditas_list = get_komoditas_list()
        if not komoditas_list:
            raise Exception("Daftar komoditas kosong dari API")
        if kom_filter:
            komoditas_list = [k for k in komoditas_list if k['name'] in kom_filter]
        log(f"   ✅ {len(komoditas_list)} komoditas akan di-scrape")
        job['total'] = len(komoditas_list)
        job['komoditas_dari_api'] = [k['name'] for k in komoditas_list]

        tipe_label = {1: 'Harian', 2: 'Mingguan', 3: 'Bulanan'}.get(tipe_laporan, str(tipe_laporan))
        log(f"🚀 Scraping dimulai — Periode: {tgl_mulai} s.d {tgl_selesai} | Tipe: {tipe_label}")

        for i, kom in enumerate(komoditas_list, 1):
            if job.get('cancelled'):
                log("⛔ Dibatalkan oleh pengguna")
                break

            job['current']            = i
            job['current_komoditas']  = kom['name']
            log(f"[{i:2}/{len(komoditas_list)}] ⏳ {kom['name']} (ID: {kom['comcat_id']})")

            try:
                df = scrape_komoditas_api(
                    comcat_id      = kom['comcat_id'],
                    nama_komoditas = kom['name'],
                    province_id    = province_id,
                    regency_ids    = regency_ids,
                    tgl_mulai      = tgl_mulai,
                    tgl_selesai    = tgl_selesai,
                    tipe_laporan   = tipe_laporan,
                )
                if df is not None and not df.empty:
                    semua_data.append(df)
                    log(f"       ✅ {len(df)} baris")
                else:
                    gagal.append(kom['name'])
                    log(f"       ⚠️  Kosong")
            except Exception as e:
                gagal.append(kom['name'])
                log(f"       ❌ Error: {e}")

            time.sleep(0.3)

        if semua_data:
            df_all = pd.concat(semua_data, ignore_index=True)
            
            # Save to database
            saved_count = save_price_data(df_all, province_name)
            log(f"💾 Saved {saved_count} records to database")
            
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df_all.to_excel(writer, sheet_name='Semua Komoditas', index=False)
                for df_k in semua_data:
                    sheet = df_k['Komoditas'].iloc[0][:31].strip()
                    df_k.to_excel(writer, sheet_name=sheet, index=False)
            output.seek(0)
            job['excel_bytes'] = output.getvalue()
            job['df_preview']  = df_all.head(50).to_dict(orient='records')
            job['df_columns']  = list(df_all.columns)
            job['df_stats']    = df_all.groupby('Komoditas').size().reset_index(
                name='Jumlah Baris').to_dict(orient='records')
            job['total_rows']  = len(df_all)
            job['filename']    = f"harga_pangan_{tgl_mulai}_sd_{tgl_selesai}.xlsx"
            log(f"💾 Excel siap — {len(df_all)} baris total")

        log(f"🏁 Selesai! Berhasil: {len(semua_data)}/{len(komoditas_list)}")
        if gagal:
            log(f"⚠️  Gagal ({len(gagal)}): {', '.join(gagal)}")

    except Exception as e:
        log(f"❌ Fatal: {e}")
        job['status'] = 'error'
        job['error']  = str(e)
        return

    job['status']      = 'done' if semua_data else 'done_empty'
    job['finished_at'] = datetime.now().isoformat()
    job['berhasil']    = len(semua_data)
    job['gagal']       = gagal


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/ref/provinsi')
def ref_provinsi():
    try:
        data = get_json(f"{BASE}/GetRefProvince")
        result = []
        for p in flatten_rows(data):
            nama = str(p.get('province_name') or p.get('name') or p.get('text') or '')
            pid  = p.get('province_id') or p.get('id') or p.get('value')
            if nama and pid:
                result.append({'id': pid, 'name': nama})
        result.sort(key=lambda x: x['name'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ref/regency')
def ref_regency():
    province_id = request.args.get('province_id')
    if not province_id:
        return jsonify([])
    try:
        data = get_json(f"{BASE}/GetRefRegency", params={
            "price_type_id": 1,
            "ref_prov_id"  : province_id
        })
        result = []
        for r in flatten_rows(data):
            nama = str(r.get('regency_name') or r.get('name') or r.get('text') or '')
            rid  = r.get('regency_id') or r.get('id') or r.get('value')
            if nama and rid:
                result.append({'id': rid, 'name': nama.strip()})
        result.sort(key=lambda x: x['name'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ref/komoditas')
def ref_komoditas():
    try:
        return jsonify(get_komoditas_list())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/start', methods=['POST'])
def start_scraping():
    data   = request.get_json()
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        'status': 'queued', 'logs': [], 'current': 0,
        'total': 0, 'current_komoditas': '', 'cancelled': False,
    }
    threading.Thread(target=run_scraping_job, args=(job_id, data), daemon=True).start()
    return jsonify({'job_id': job_id})


@app.route('/api/status/<job_id>')
def job_status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job tidak ditemukan'}), 404
    return jsonify({
        'status'           : job['status'],
        'current'          : job.get('current', 0),
        'total'            : job.get('total', 0),
        'current_komoditas': job.get('current_komoditas', ''),
        'logs'             : job.get('logs', []),
        'berhasil'         : job.get('berhasil', 0),
        'gagal'            : job.get('gagal', []),
        'total_rows'       : job.get('total_rows', 0),
        'df_columns'       : job.get('df_columns', []),
        'df_preview'       : job.get('df_preview', []),
        'df_stats'         : job.get('df_stats', []),
        'filename'         : job.get('filename', ''),
        'error'            : job.get('error', ''),
        'komoditas_dari_api': job.get('komoditas_dari_api', []),
    })


@app.route('/api/cancel/<job_id>', methods=['POST'])
def cancel_job(job_id):
    job = jobs.get(job_id)
    if job:
        job['cancelled'] = True
    return jsonify({'ok': True})


@app.route('/api/download/<job_id>')
def download(job_id):
    job = jobs.get(job_id)
    if not job or 'excel_bytes' not in job:
        return jsonify({'error': 'Data belum tersedia'}), 404
    return send_file(
        io.BytesIO(job['excel_bytes']),
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=job.get('filename', 'pihps_data.xlsx')
    )


# ─── Dashboard API Routes ────────────────────────────────────────────────────

@app.route('/api/dashboard/chart-data')
def dashboard_chart_data():
    """Get chart data for visualization"""
    days = request.args.get('days', 365, type=int)
    data = get_price_chart_data(days)
    return jsonify(data)


@app.route('/api/dashboard/commodity-stats')
def dashboard_commodity_stats():
    """Get commodity statistics"""
    stats = get_commodity_stats()
    return jsonify(stats)


@app.route('/api/dashboard/latest-prices')
def dashboard_latest_prices():
    """Get latest prices for all commodities"""
    prices = get_latest_prices()
    return jsonify(prices)


@app.route('/api/dashboard/summary')
def dashboard_summary():
    """Get dashboard summary"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Total records
            cursor.execute('SELECT COUNT(*) as count FROM price_data')
            total_records = cursor.fetchone()['count']
            
            # Last update
            cursor.execute('SELECT MAX(date) as last_date FROM price_data')
            last_date = cursor.fetchone()['last_date']
            
            # Unique commodities
            cursor.execute('SELECT COUNT(DISTINCT commodity_name) as count FROM price_data')
            unique_commodities = cursor.fetchone()['count']
            
            # Unique provinces
            cursor.execute('SELECT COUNT(DISTINCT province_name) as count FROM price_data')
            unique_provinces = cursor.fetchone()['count']
            
            return jsonify({
                'total_records': total_records,
                'last_update': last_date,
                'unique_commodities': unique_commodities,
                'unique_provinces': unique_provinces,
            })
    except Exception as e:
        print(f"Error in dashboard_summary: {e}")
        return jsonify({'total_records': 0, 'last_update': None, 'unique_commodities': 0, 'unique_provinces': 0}), 200


@app.route('/api/dashboard/saved-data')
def dashboard_saved_data():
    """Get raw saved data with optional search"""
    try:
        search = request.args.get('search', '')
        limit = request.args.get('limit', 500, type=int)
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            if search:
                cursor.execute('''
                    SELECT date, commodity_name, province_name, regency_name, price
                    FROM price_data
                    WHERE commodity_name LIKE ? OR province_name LIKE ? OR regency_name LIKE ?
                    ORDER BY date DESC, commodity_name
                    LIMIT ?
                ''', (f'%{search}%', f'%{search}%', f'%{search}%', limit))
            else:
                cursor.execute('''
                    SELECT date, commodity_name, province_name, regency_name, price
                    FROM price_data
                    ORDER BY date DESC, commodity_name
                    LIMIT ?
                ''', (limit,))
            
            result = []
            for row in cursor.fetchall():
                result.append({
                    'date': row['date'],
                    'commodity': row['commodity_name'],
                    'province': row['province_name'],
                    'regency': row['regency_name'],
                    'price': row['price']
                })
            
            return jsonify({'data': result, 'count': len(result)})
    except Exception as e:
        print(f"Error in dashboard_saved_data: {e}")
        return jsonify({'data': [], 'count': 0}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
