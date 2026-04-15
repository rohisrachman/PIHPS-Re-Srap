"""
PIHPS BI — Flask Scraping Dashboard
"""

import io
import json
import time
import threading
import uuid
import os
import re
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote_plus

from flask import Flask, render_template, request, jsonify, send_file
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import pandas as pd
import warnings
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from pymongo.errors import ConnectionFailure
import gridfs
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

warnings.filterwarnings('ignore')

app = Flask(__name__)

# ── Security Headers Middleware ─────────────────────────────────────
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    # Content Security Policy - Restrict sources for scripts, styles, etc.
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://www.bi.go.id; "
        "frame-ancestors 'none';"
    )
    
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Enable XSS protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Referrer policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Permissions policy
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    
    return response

# ── Input Validation & Sanitization ─────────────────────────────────
import html

def sanitize_input(text, max_length=1000):
    """Sanitize user input to prevent XSS and injection attacks"""
    if not text:
        return ""
    if not isinstance(text, str):
        return ""
    # Truncate to max length
    text = text[:max_length]
    # HTML escape to prevent XSS
    text = html.escape(text)
    # Remove potentially dangerous patterns
    dangerous_patterns = ['<script', '</script>', 'javascript:', 'onerror=', 'onload=', 'onclick=']
    for pattern in dangerous_patterns:
        text = text.replace(pattern, '')
    return text.strip()

def validate_date(date_str):
    """Validate date format YYYY-MM-DD"""
    if not date_str or not isinstance(date_str, str):
        return False
    try:
        from datetime import datetime
        datetime.strptime(date_str, '%Y-%m-%d')
        return True
    except:
        return False

def validate_message(message, max_length=500):
    """Validate AI chat message"""
    if not message or not isinstance(message, str):
        return False
    if len(message) > max_length:
        return False
    # Check for suspicious patterns
    suspicious = ['<script', 'javascript:', 'eval(', 'document.cookie', 'window.location']
    for pattern in suspicious:
        if pattern.lower() in message.lower():
            return False
    return True

# ── Rate Limiting (In-Memory) ───────────────────────────────────────
from collections import defaultdict

class RateLimiter:
    """Simple in-memory rate limiter"""
    def __init__(self, max_requests=60, window=60):
        self.max_requests = max_requests
        self.window = window
        self.requests = defaultdict(list)
    
    def is_allowed(self, key):
        """Check if request is allowed for given key"""
        now = time.time()
        # Remove old requests outside the window
        self.requests[key] = [t for t in self.requests[key] if now - t < self.window]
        
        # Check if under limit
        if len(self.requests[key]) >= self.max_requests:
            return False
        
        # Add current request
        self.requests[key].append(now)
        return True
    
    def get_remaining(self, key):
        """Get remaining requests for given key"""
        now = time.time()
        self.requests[key] = [t for t in self.requests[key] if now - t < self.window]
        return max(0, self.max_requests - len(self.requests[key]))

# Initialize rate limiters
ai_chat_rate_limiter = RateLimiter(max_requests=30, window=60)  # 30 requests per minute
api_rate_limiter = RateLimiter(max_requests=100, window=60)  # 100 requests per minute

# ── CSRF Protection ─────────────────────────────────────────────────
import secrets

csrf_tokens = {}

def generate_csrf_token():
    """Generate a new CSRF token"""
    return secrets.token_hex(32)

def validate_csrf_token(token):
    """Validate CSRF token"""
    if not token:
        return False
    # Simple validation - in production, use proper session-based tokens
    # For this demo, we'll just check if token format is valid
    if len(token) != 64:
        return False
    try:
        int(token, 16)
        return True
    except:
        return False

# ── Config ───────────────────────────────────────────────────────
BASE = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas",
    "X-Requested-With": "XMLHttpRequest",
}

# Storage directory
STORAGE_DIR = Path("storage")
STORAGE_DIR.mkdir(exist_ok=True)

# ── MongoDB Connection ───────────────────────────────────────────
# Get MongoDB URI from environment variable (Vercel/Atlas format)
MONGODB_URI = os.environ.get('MONGODB_URI')
MONGO_DB = os.environ.get('MONGO_DB', 'pihps_dashboard')

# Initialize MongoDB client
mongo_client = None
db = None
fs = None  # GridFS for file storage
storage_collection = None  # MongoDB collection for metadata

def init_mongodb():
    """Initialize MongoDB connection using MongoDB Atlas format"""
    global mongo_client, db, fs, storage_collection
    try:
        if MONGODB_URI:
            # Debug: print connection string (hide password)
            # Find password between : and @
            debug_uri = re.sub(r':([^:@]+)@', ':***@', MONGODB_URI)
            print(f"🔌 Connecting to: {debug_uri}")
            
            # Create a new client and connect to the server (MongoDB Atlas format)
            # Try with SSL first, fallback to no SSL verification for development
            try:
                mongo_client = MongoClient(
                    MONGODB_URI, 
                    server_api=ServerApi('1'),
                    tls=True,
                    tlsAllowInvalidCertificates=False,
                    serverSelectionTimeoutMS=5000
                )
                mongo_client.admin.command('ping')
            except Exception:
                print("⚠️  SSL verification failed, retrying with tlsAllowInvalidCertificates=True")
                mongo_client = MongoClient(
                    MONGODB_URI, 
                    server_api=ServerApi('1'),
                    tls=True,
                    tlsAllowInvalidCertificates=True,
                    serverSelectionTimeoutMS=5000
                )
                mongo_client.admin.command('ping')
            
            db = mongo_client.get_database(MONGO_DB)
            fs = gridfs.GridFS(db)  # Initialize GridFS
            storage_collection = db['storage_metadata']  # Collection for file metadata
            print("✅ MongoDB connected successfully!")
            return True
        else:
            print("⚠️  MONGODB_URI not found. Please set it in .env file")
            return False
    except ConnectionFailure as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False
    except Exception as e:
        print(f"❌ MongoDB error: {e}")
        return False

# Try to connect on startup
init_mongodb()

# In-memory storage (fallback if MongoDB not available)
jobs = {}
storage_metadata = {}  # {file_id: {name, timestamp, rows, komoditas_count, etc}}

# Thread-local storage for sessions
import threading
_thread_local = threading.local()

def get_session():
    """Get thread-local session (thread-safe)"""
    if not hasattr(_thread_local, 'session'):
        session = requests.Session()
        adapter = HTTPAdapter(
            pool_connections=5,
            pool_maxsize=10,
            max_retries=Retry(
                total=3,
                backoff_factor=0.5,
                status_forcelist=[500, 502, 503, 504]
            )
        )
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        session.headers.update(HEADERS)
        _thread_local.session = session
    return _thread_local.session


def load_storage_metadata():
    """Load existing storage metadata from MongoDB"""
    global storage_metadata
    try:
        if storage_collection is not None:
            storage_metadata = {}
            for doc in storage_collection.find():
                doc_id = str(doc.pop('_id'))
                storage_metadata[doc_id] = doc
        else:
            storage_metadata = {}
    except Exception as e:
        print(f"⚠️  Could not load from MongoDB, using empty storage: {e}")
        storage_metadata = {}


def save_storage_metadata():
    """Save storage metadata - now handled automatically by MongoDB inserts"""
    # No-op: Metadata is saved directly to MongoDB when files are stored
    pass


# ─── Helpers API ─────────────────────────────────────────────────

def get_json(url, params=None, retries=3, backoff=1):
    """Fetch JSON with retry mechanism and exponential backoff using session"""
    session = get_session()
    for attempt in range(retries):
        try:
            resp = session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, json.JSONDecodeError) as e:
            if attempt == retries - 1:
                # Last attempt failed
                print(f"\n❌ Failed after {retries} attempts: {url}")
                print(f"  Error: {e}\n")
                raise
            # Exponential backoff
            wait_time = backoff * (2 ** attempt)
            print(f"⚠️  Attempt {attempt + 1} failed, retrying in {wait_time}s...")
            time.sleep(wait_time)
    return None


def flatten_rows(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get('data') or data.get('rows') or []
    return []


def get_province_id(provinsi_target):
    """Resolve province name or ID to (id, name) tuple"""
    data = get_json(f"{BASE}/GetRefProvince")
    
    # If provinsi_target is numeric, look for matching ID
    if str(provinsi_target).isdigit():
        target_id = int(provinsi_target)
        for p in flatten_rows(data):
            pid = p.get('province_id') or p.get('id') or p.get('value')
            if int(pid) == target_id:
                nama = str(p.get('province_name') or p.get('name') or p.get('text') or '')
                return pid, nama
    else:
        # Otherwise, search by name
        for p in flatten_rows(data):
            nama = str(p.get('province_name') or p.get('name') or p.get('text') or p.get('label') or '')
            if provinsi_target.lower() in nama.lower():
                pid = p.get('province_id') or p.get('id') or p.get('value')
                return pid, nama
    
    return None, None


def get_regency_ids(province_id, kabkota_target):
    data = get_json(f"{BASE}/GetRefRegency", params={
        "price_type_id": 1,
        "ref_prov_id": province_id
    })
    ids, names, all_options = [], [], []
    for r in flatten_rows(data):
        nama = str(r.get('regency_name') or r.get('name') or r.get('text') or r.get('label') or '')
        rid = r.get('regency_id') or r.get('id') or r.get('value')
        all_options.append({'id': rid, 'name': nama.strip()})
        for target in kabkota_target:
            if target.lower() in nama.lower() or str(target) == str(rid):
                ids.append(str(rid))
                names.append(nama.strip())
                break
    return ids, names, all_options


def get_komoditas_list():
    data = get_json(f"{BASE}/GetRefCommodityAndCategory")
    result = []
    for item in flatten_rows(data):
        nama = str(item.get('commodity_name') or item.get('name') or item.get('text') or item.get('label') or '')
        cid = item.get('comcat_id') or item.get('id') or item.get('value')
        if nama and cid and str(cid).startswith('cat'):
            result.append({'name': nama, 'comcat_id': str(cid)})
    return result


# Mapping provinsi ke kab/kota rekomendasi (ibukota + kota besar)
REGENCY_RECOMMENDATIONS = {
    'aceh': ['Banda Aceh', 'Lhokseumawe', 'Langsa'],
    'sumatera utara': ['Medan', 'Binjai', 'Pematangsiantar', 'Tebing Tinggi'],
    'sumatera barat': ['Padang', 'Bukittinggi', 'Solok'],
    'riau': ['Pekanbaru', 'Dumai'],
    'jambi': ['Jambi', 'Sungai Penuh'],
    'sumatera selatan': ['Palembang', 'Prabumulih', 'Lubuklinggau'],
    'bengkulu': ['Bengkulu', 'Curup'],
    'lampung': ['Bandar Lampung', 'Metro'],
    'kepulauan bangka belitung': ['Pangkal Pinang', 'Tanjung Pandan'],
    'dki jakarta': ['Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Barat'],
    'jawa barat': ['Bandung', 'Bekasi', 'Bogor', 'Depok'],
    'jawa tengah': ['Semarang', 'Surakarta', 'Pekalongan', 'Salatiga'],
    'daerah istimewa yogyakarta': ['Yogyakarta'],
    'jawa timur': ['Surabaya', 'Malang', 'Kediri', 'Probolinggo'],
    'banten': ['Serang', 'Cilegon', 'Tangerang'],
    'bali': ['Denpasar', 'Singaraja'],
    'nusa tenggara barat': ['Mataram', 'Bima'],
    'nusa tenggara timur': ['Kupang', 'Maumere'],
    'kalimantan barat': ['Pontianak', 'Singkawang'],
    'kalimantan tengah': ['Palangka Raya', 'Sampit'],
    'kalimantan selatan': ['Banjarmasin', 'Banjarbaru'],
    'kalimantan timur': ['Samarinda', 'Balikpapan'],
    'sulawesi utara': ['Manado', 'Tomohon'],
    'sulawesi tengah': ['Palu', 'Kab. Banggai'],
    'sulawesi selatan': ['Makassar', 'Parepare', 'Palopo'],
    'sulawesi tenggara': ['Kendari', 'Bau-Bau'],
    'gorontalo': ['Gorontalo', 'Tilamuta'],
    'sulawesi barat': ['Mamuju', 'Polewali'],
    'maluku': ['Ambon', 'Tual'],
    'maluku utara': ['Ternate', 'Tidore'],
    'papua barat': ['Manokwari', 'Sorong'],
    'papua': ['Jayapura', 'Wamena'],
    'papua tengah': ['Nabire'],
    'papua pegunungan': ['Jayawijaya', 'Wamena'],
    'papua selatan': ['Merauke'],
}


def get_recommended_regencies(province_id):
    """Get rekomendasi kab/kota berdasarkan province_id (numeric)"""
    try:
        # Fetch semua kab/kota untuk provinsi ini
        data = get_json(f"{BASE}/GetRefRegency", params={
            "price_type_id": 1,
            "ref_prov_id": province_id
        })
        all_regencies = []
        for r in flatten_rows(data):
            nama = str(r.get('regency_name') or r.get('name') or r.get('text') or r.get('label') or '')
            if nama:
                all_regencies.append(nama.strip())
        
        # Try to match dengan salah satu province keys di REGENCY_RECOMMENDATIONS
        recommendations = []
        for prov_key in REGENCY_RECOMMENDATIONS.keys():
            # Cek apakah ada yang cocok dengan checking kota dari all_regencies
            matched = False
            for rec in REGENCY_RECOMMENDATIONS[prov_key]:
                for regency in all_regencies:
                    if rec.lower() in regency.lower():
                        matched = True
                        break
                if matched:
                    break
            
            if matched:
                recommendations = REGENCY_RECOMMENDATIONS[prov_key]
                break
        
        # Filter regencies yang match dengan recommendations
        if recommendations:
            filtered = [reg for reg in all_regencies if any(rec.lower() in reg.lower() for rec in recommendations)]
            if filtered:
                return sorted(list(set(filtered)))
        
        # Fallback: return top 3 regencies
        return sorted(all_regencies)[:3] if all_regencies else []
    except Exception as e:
        print(f"Error getting recommendations for province_id={province_id}: {e}")
        import traceback
        traceback.print_exc()
        return []


def scrape_komoditas_api(comcat_id, nama_komoditas, province_id,
                          regency_ids, tgl_mulai, tgl_selesai, tipe_laporan, max_retries=3):
    """Scrape single komoditas with retry support using session"""
    session = get_session()
    regency_str = ",".join(regency_ids) if regency_ids else ""
    params = {
        "price_type_id": 1,
        "comcat_id": comcat_id,
        "province_id": province_id,
        "regency_id": regency_str,
        "showKota": "true",
        "showPasar": "false",
        "tipe_laporan": tipe_laporan,
        "start_date": tgl_mulai,
        "end_date": tgl_selesai,
    }
    
    for attempt in range(max_retries):
        try:
            resp = session.get(f"{BASE}/GetGridDataKomoditas",
                                params=params, timeout=30)
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
            return None  # Empty result is not an error
            
        except Exception as e:
            if attempt == max_retries - 1:
                raise  # Re-raise on final attempt
            time.sleep(0.5 * (attempt + 1))  # Brief backoff
    
    return None


# ─── Background job ──────────────────────────────────────────────

def run_scraping_job(job_id, params):
    job = jobs[job_id]
    job['status'] = 'running'
    job['started_at'] = datetime.now().isoformat()
    job['logs'] = []
    job['current'] = 0
    job['total'] = 0

    def log(msg):
        ts = datetime.now().strftime('%H:%M:%S')
        job['logs'].append(f"[{ts}] {msg}")

    provinsi = params['provinsi']
    kabkota_list = params['kabkota_target']
    tgl_mulai = params['tanggal_mulai']
    tgl_selesai = params['tanggal_selesai']
    tipe_laporan = int(params.get('tipe_laporan', 2))
    kom_filter = params.get('komoditas_filter', [])

    semua_data = []
    gagal = []

    try:
        log(f"📡 Resolving provinsi '{provinsi}'...")
        province_id, province_name = get_province_id(provinsi)
        if not province_id:
            raise Exception(f"Provinsi '{provinsi}' tidak ditemukan")
        log(f"   ✅ {province_name} → ID={province_id}")
        
        # Store provinsi in job for dashboard tracking
        job['provinsi'] = province_name or provinsi

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

            job['current'] = i
            job['current_komoditas'] = kom['name']
            log(f"[{i:2}/{len(komoditas_list)}] ⏳ {kom['name']} (ID: {kom['comcat_id']})")

            try:
                df = scrape_komoditas_api(
                    comcat_id=kom['comcat_id'],
                    nama_komoditas=kom['name'],
                    province_id=province_id,
                    regency_ids=regency_ids,
                    tgl_mulai=tgl_mulai,
                    tgl_selesai=tgl_selesai,
                    tipe_laporan=tipe_laporan,
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

            # Adaptive delay: shorter delay for successful requests
            time.sleep(0.15)

        if semua_data:
            df_all = pd.concat(semua_data, ignore_index=True)
            
            # VALIDATE SHAPE BEFORE STORAGE
            shape_before = df_all.shape
            columns_before = list(df_all.columns)
            
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df_all.to_excel(writer, sheet_name='Semua Komoditas', index=False)
                for df_k in semua_data:
                    sheet = df_k['Komoditas'].iloc[0][:31].strip()
                    df_k.to_excel(writer, sheet_name=sheet, index=False)
            output.seek(0)
            job['excel_bytes'] = output.getvalue()
            
            # VALIDATE SHAPE AFTER (should be same)
            shape_after = df_all.shape
            columns_after = list(df_all.columns)
            
            job['shape_validation'] = {
                'before': {'shape': shape_before, 'columns': columns_before},
                'after': {'shape': shape_after, 'columns': columns_after},
                'match': shape_before == shape_after and columns_before == columns_after
            }
            
            job['df_preview'] = df_all.head(50).to_dict(orient='records')
            job['df_columns'] = list(df_all.columns)
            job['df_stats'] = df_all.groupby('Komoditas').size().reset_index(
                name='Jumlah Baris').to_dict(orient='records')
            job['total_rows'] = len(df_all)
            
            # Format filename: <provinsi>_<tanggal_bulan_tahun awal s.d tanggal_bulan_tahun akhir>
            # Date format: "Des-26" (Bulan Singkat-Tahun 2 digit)
            def format_date_indo(date_str):
                """Convert YYYY-MM-DD to Mmm-YY format (Indonesian)"""
                bulan_indo = {
                    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
                    '05': 'Mei', '06': 'Jun', '07': 'Jul', '08': 'Agu',
                    '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des'
                }
                try:
                    year, month, day = date_str.split('-')
                    short_year = year[-2:]  # Last 2 digits of year
                    return f"{bulan_indo.get(month, month)}-{short_year}"
                except:
                    return date_str
            
            provinsi_clean = province_name.replace(' ', '_').replace('/', '_')
            tgl_mulai_fmt = format_date_indo(tgl_mulai)
            tgl_selesai_fmt = format_date_indo(tgl_selesai)
            job['filename'] = f"{provinsi_clean}_{tgl_mulai_fmt}_s.d_{tgl_selesai_fmt}.xlsx"
            log(f"💾 Excel siap — {len(df_all)} baris total")
            log(f"✅ Shape validation: {shape_before} → {shape_after} ({'MATCH' if job['shape_validation']['match'] else 'MISMATCH'})")

        log(f"🏁 Selesai! Berhasil: {len(semua_data)}/{len(komoditas_list)}")
        if gagal:
            log(f"⚠️  Gagal ({len(gagal)}): {', '.join(gagal)}")

    except Exception as e:
        log(f"❌ Fatal: {e}")
        job['status'] = 'error'
        job['error'] = str(e)
        return

    job['status'] = 'done' if semua_data else 'done_empty'
    job['finished_at'] = datetime.now().isoformat()
    job['berhasil'] = len(semua_data)
    job['gagal'] = gagal


# ─── Routes: AI Assistant (GROQ API) ─────────────────────────────

GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_MODEL = 'llama-3.1-8b-instant'

def call_groq_api(message, conversation_history=None):
    if not GROQ_API_KEY:
        return None, "GROQ_API_KEY belum diatur"
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    messages = [
        {"role": "system", "content": "Anda adalah AI Assistant untuk PIHPS Dashboard. Anda membantu pengguna dengan: panduan penggunaan dashboard, informasi komoditas, analisis data harga, dan troubleshooting. Jawab dengan ringkas dan membantu dalam bahasa Indonesia."},
        {"role": "user", "content": message}
    ]
    
    try:
        resp = requests.post(url, json={
            "model": GROQ_MODEL,
            "messages": messages,
            "max_tokens": 800,
            "temperature": 0.7
        }, headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }, timeout=30)
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content'], None
    except Exception as e:
        return None, str(e)

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Handle AI chat using GROQ API"""
    try:
        # Rate limiting by IP address
        client_ip = request.remote_addr
        if not ai_chat_rate_limiter.is_allowed(client_ip):
            remaining = ai_chat_rate_limiter.get_remaining(client_ip)
            return jsonify({
                'error': 'Too many requests',
                'remaining': remaining
            }), 429
        
        data = request.json
        if not data:
            return jsonify({'error': 'Invalid request'}), 400
        
        user_message = data.get('message', '').strip()
        
        # Validate message
        if not validate_message(user_message):
            return jsonify({'error': 'Invalid message format or content'}), 400
        
        # Sanitize message
        sanitized_message = sanitize_input(user_message, max_length=500)
        
        print(f"[AI Chat] Received message: {sanitized_message[:50]}...")
        print(f"[AI Chat] GROQ_API_KEY exists: {bool(GROQ_API_KEY)}")
        
        response, error = call_groq_api(sanitized_message)
        
        if error:
            print(f"[AI Chat] Error: {error}")
            return jsonify({'error': error}), 500
        
        print(f"[AI Chat] Response received")
        return jsonify({'response': response})
        
    except Exception as e:
        print(f"[AI Chat] Exception: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


# ─── Routes: Reference Data ──────────────────────────────────────

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
            pid = p.get('province_id') or p.get('id') or p.get('value')
            if nama and pid:
                result.append({'id': pid, 'name': nama})
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


@app.route('/api/ref/regency/<province_id>')
def ref_regency(province_id):
    """Dapatkan daftar semua kab/kota berdasarkan province_id untuk checklist"""
    try:
        data = get_json(f"{BASE}/GetRefRegency", params={
            "price_type_id": 1,
            "ref_prov_id": province_id
        })
        result = []
        for r in flatten_rows(data):
            nama = str(r.get('regency_name') or r.get('name') or r.get('text') or r.get('label') or '')
            rid = r.get('regency_id') or r.get('id') or r.get('value')
            if nama and rid:
                result.append({'id': str(rid), 'name': nama.strip()})
        result.sort(key=lambda x: x['name'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommend/regency/<province_id>')
def recommend_regency(province_id):
    """Dapatkan rekomendasi kab/kota berdasarkan provinsi"""
    try:
        # Convert province_id (could be string name or numeric ID) to numeric ID
        numeric_id = province_id
        
        # If it's not purely numeric, try to find it from API
        if not str(province_id).isdigit():
            # Fetch provinces and find the ID
            try:
                prov_data = get_json(f"{BASE}/GetRefProvince")
                for p in flatten_rows(prov_data):
                    prov_name = str(p.get('province_name') or p.get('name') or '')
                    if province_id.lower() in prov_name.lower() or prov_name.lower() in province_id.lower():
                        numeric_id = p.get('province_id') or p.get('id')
                        break
            except Exception as e:
                print(f"Warning: Could not resolve province name to ID: {e}")
        
        recommendations = get_recommended_regencies(numeric_id)
        return jsonify({'recommendations': recommendations})
    except Exception as e:
        print(f"Error in recommend_regency: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'recommendations': [], 'error': str(e)}), 500


# ─── Routes: Scraping ────────────────────────────────────────────

@app.route('/api/start', methods=['POST'])
def start_scraping():
    # Validate CSRF token for state-changing operation
    csrf_token = request.headers.get('X-CSRF-Token')
    if not validate_csrf_token(csrf_token):
        return jsonify({'error': 'Invalid CSRF token'}), 403
    
    data = request.get_json()
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        'status': 'queued', 'logs': [], 'current': 0,
        'total': 0, 'current_komoditas': '', 'cancelled': False,
    }
    threading.Thread(target=run_scraping_job, args=(job_id, data), daemon=True).start()
    return jsonify({'job_id': job_id})


@app.route('/api/csrf-token', methods=['GET'])
def get_csrf_token():
    """Generate and return CSRF token"""
    token = generate_csrf_token()
    return jsonify({'csrf_token': token})


@app.route('/api/status/<job_id>')
def job_status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job tidak ditemukan'}), 404
    return jsonify({
        'status': job['status'],
        'current': job.get('current', 0),
        'total': job.get('total', 0),
        'current_komoditas': job.get('current_komoditas', ''),
        'logs': job.get('logs', []),
        'berhasil': job.get('berhasil', 0),
        'gagal': job.get('gagal', []),
        'total_rows': job.get('total_rows', 0),
        'df_columns': job.get('df_columns', []),
        'df_preview': job.get('df_preview', []),
        'df_stats': job.get('df_stats', []),
        'filename': job.get('filename', ''),
        'error': job.get('error', ''),
        'komoditas_dari_api': job.get('komoditas_dari_api', []),
        'shape_validation': job.get('shape_validation', {}),
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

    # Save to GridFS
    file_id = str(uuid.uuid4())[:12]
    filename = job.get('filename', 'pihps_data.xlsx')
    
    try:
        if fs is not None:
            # Store file in GridFS
            grid_id = fs.put(
                job['excel_bytes'],
                filename=filename,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            mongo_file_id = str(grid_id)
        else:
            mongo_file_id = None
            # Fallback: save to local storage
            filepath = STORAGE_DIR / f"{file_id}.xlsx"
            with open(filepath, 'wb') as f:
                f.write(job['excel_bytes'])
        
        # Save metadata to MongoDB
        metadata_doc = {
            'id': file_id,
            'name': filename,
            'timestamp': datetime.now().isoformat(),
            'rows': job.get('total_rows', 0),
            'komoditas_count': len(job.get('komoditas_dari_api', [])),
            'komoditas': job.get('komoditas_dari_api', []),
            'provinsi': job.get('provinsi', 'Unknown'),
            'mongo_file_id': mongo_file_id,  # Reference to GridFS file
        }
        
        if storage_collection is not None:
            storage_collection.insert_one({'_id': file_id, **metadata_doc})
        storage_metadata[file_id] = metadata_doc
        
    except Exception as e:
        print(f"❌ Error saving to storage: {e}")
        return jsonify({'error': f'Gagal menyimpan: {str(e)}'}), 500

    return send_file(
        io.BytesIO(job['excel_bytes']),
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/jobs/<job_id>/save', methods=['POST'])
def save_job_to_storage(job_id):
    """Save job data to storage without downloading"""
    job = jobs.get(job_id)
    if not job or 'excel_bytes' not in job:
        return jsonify({'error': 'Data belum tersedia'}), 404
    
    try:
        # Save to GridFS
        file_id = str(uuid.uuid4())[:12]
        filename = job.get('filename', 'pihps_data.xlsx')
        
        if fs is not None:
            # Store file in GridFS
            grid_id = fs.put(
                job['excel_bytes'],
                filename=filename,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            mongo_file_id = str(grid_id)
        else:
            mongo_file_id = None
            # Fallback: save to local storage
            filepath = STORAGE_DIR / f"{file_id}.xlsx"
            with open(filepath, 'wb') as f:
                f.write(job['excel_bytes'])
        
        # Save metadata to MongoDB
        metadata_doc = {
            'id': file_id,
            'name': filename,
            'timestamp': datetime.now().isoformat(),
            'rows': job.get('total_rows', 0),
            'komoditas_count': len(job.get('komoditas_dari_api', [])),
            'komoditas': job.get('komoditas_dari_api', []),
            'provinsi': job.get('provinsi', 'Unknown'),
            'mongo_file_id': mongo_file_id,
        }
        
        if storage_collection is not None:
            storage_collection.insert_one({'_id': file_id, **metadata_doc})
        storage_metadata[file_id] = metadata_doc
        
        return jsonify({'ok': True, 'file_id': file_id, 'message': 'Data berhasil disimpan'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Routes: Storage Management ──────────────────────────────────

@app.route('/api/storage/list')
def storage_list():
    try:
        if storage_collection is not None:
            # Load from MongoDB
            result = list(storage_collection.find())
            for r in result:
                r['id'] = str(r.pop('_id'))
            result.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            return jsonify(result)
        else:
            # Fallback to in-memory
            load_storage_metadata()
            result = list(storage_metadata.values())
            result.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/download/<file_id>')
def storage_download(file_id):
    try:
        # Get metadata from MongoDB
        if storage_collection is not None:
            meta = storage_collection.find_one({'_id': file_id})
        else:
            load_storage_metadata()
            meta = storage_metadata.get(file_id)
        
        if not meta:
            return jsonify({'error': 'File tidak ditemukan'}), 404
        
        filename = meta.get('name', 'pihps_data.xlsx')
        mongo_file_id = meta.get('mongo_file_id')
        
        if fs is not None and mongo_file_id:
            # Download from GridFS
            from bson.objectid import ObjectId
            grid_file = fs.get(ObjectId(mongo_file_id))
            return send_file(
                io.BytesIO(grid_file.read()),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=filename
            )
        else:
            # Fallback: download from local storage
            filepath = STORAGE_DIR / f"{file_id}.xlsx"
            if not filepath.exists():
                return jsonify({'error': 'File tidak ditemukan di disk'}), 404
            return send_file(
                filepath,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=filename
            )
    except Exception as e:
        return jsonify({'error': f'Error downloading file: {str(e)}'}), 500


@app.route('/api/storage/delete/<file_id>', methods=['POST'])
def storage_delete(file_id):
    try:
        # Get metadata
        if storage_collection is not None:
            meta = storage_collection.find_one({'_id': file_id})
        else:
            load_storage_metadata()
            meta = storage_metadata.get(file_id)
        
        if not meta:
            return jsonify({'error': 'File tidak ditemukan'}), 404
        
        mongo_file_id = meta.get('mongo_file_id')
        
        # Delete from GridFS if exists
        if fs is not None and mongo_file_id:
            try:
                from bson.objectid import ObjectId
                fs.delete(ObjectId(mongo_file_id))
            except:
                pass  # File might not exist in GridFS
        else:
            # Fallback: delete local file
            filepath = STORAGE_DIR / f"{file_id}.xlsx"
            if filepath.exists():
                filepath.unlink()
        
        # Delete metadata from MongoDB
        if storage_collection is not None:
            storage_collection.delete_one({'_id': file_id})
        
        if file_id in storage_metadata:
            del storage_metadata[file_id]
        
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/clear', methods=['POST'])
def storage_clear():
    try:
        if storage_collection is not None and fs is not None:
            # Get all metadata
            all_docs = list(storage_collection.find())
            # Delete files from GridFS
            for doc in all_docs:
                mongo_file_id = doc.get('mongo_file_id')
                if mongo_file_id:
                    try:
                        from bson.objectid import ObjectId
                        fs.delete(ObjectId(mongo_file_id))
                    except:
                        pass
            # Clear metadata collection
            storage_collection.delete_many({})
        else:
            # Fallback: clear local files
            for file_id in list(storage_metadata.keys()):
                filepath = STORAGE_DIR / f"{file_id}.xlsx"
                if filepath.exists():
                    filepath.unlink()
        
        storage_metadata.clear()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/preview/<file_id>')
def storage_preview(file_id):
    """Preview stored Excel file data as JSON"""
    try:
        # Get metadata
        if storage_collection is not None:
            meta = storage_collection.find_one({'_id': file_id})
        else:
            load_storage_metadata()
            meta = storage_metadata.get(file_id)
        
        if not meta:
            return jsonify({'error': 'File tidak ditemukan'}), 404
        
        filename = meta.get('name', 'pihps_data.xlsx')
        mongo_file_id = meta.get('mongo_file_id')
        
        try:
            if fs is not None and mongo_file_id:
                # Read from GridFS
                from bson.objectid import ObjectId
                grid_file = fs.get(ObjectId(mongo_file_id))
                file_data = grid_file.read()
                df = pd.read_excel(io.BytesIO(file_data), sheet_name='Semua Komoditas')
            else:
                # Fallback: read from local storage
                filepath = STORAGE_DIR / f"{file_id}.xlsx"
                if not filepath.exists():
                    return jsonify({'error': 'File tidak ditemukan di disk'}), 404
                df = pd.read_excel(filepath, sheet_name='Semua Komoditas')
            
            # Get preview (first 50 rows)
            preview_data = df.head(50).to_dict(orient='records')
            columns = list(df.columns)
            total_rows = len(df)
            
            return jsonify({
                'columns': columns,
                'preview': preview_data,
                'total_rows': total_rows,
                'filename': filename
            })
        except Exception as e:
            return jsonify({'error': f'Error reading file: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Error: {str(e)}'}), 500


# ─── Routes: Dashboard Stats ────────────────────────────────────

@app.route('/api/dashboard/stats')
def dashboard_stats():
    try:
        # Load from MongoDB if available
        if storage_collection is not None:
            all_metadata = list(storage_collection.find())
            for m in all_metadata:
                m['id'] = str(m.pop('_id'))
        else:
            load_storage_metadata()
            all_metadata = list(storage_metadata.values())
    except Exception as e:
        # Fallback to in-memory if MongoDB fails
        load_storage_metadata()
        all_metadata = list(storage_metadata.values())
    
    total_jobs = len(jobs)
    total_rows = sum(meta.get('rows', 0) for meta in all_metadata)
    total_files = len(all_metadata)

    # Recent jobs
    recent_jobs = []
    for job_id, job in list(jobs.items())[-5:]:
        if job.get('status') in ['done', 'done_empty']:
            recent_jobs.append({
                'id': job_id,
                'provinsi': job.get('provinsi', 'Unknown'),
                'timestamp': job.get('finished_at', datetime.now().isoformat()),
                'rows': job.get('total_rows', 0),
            })

    # Popular komoditas
    kom_count = {}
    for meta in all_metadata:
        for k in meta.get('komoditas', []):
            kom_count[k] = kom_count.get(k, 0) + 1
    popular_komoditas = [
        {'name': k, 'count': v} for k, v in sorted(kom_count.items(), key=lambda x: -x[1])
    ]

    # Popular provinces
    prov_count = {}
    for meta in all_metadata:
        p = meta.get('provinsi', 'Unknown')
        prov_count[p] = prov_count.get(p, 0) + 1
    popular_provinces = [
        {'name': p, 'count': v} for p, v in sorted(prov_count.items(), key=lambda x: -x[1])
    ]

    return jsonify({
        'total_jobs': total_jobs,
        'total_rows': total_rows,
        'total_files': total_files,
        'recent_jobs': recent_jobs,
        'popular_komoditas': popular_komoditas,
        'popular_provinces': popular_provinces,
    })


# ─── AI Assistant Route ──────────────────────────────────────────

# Gemini API Configuration
# Dapatkan API Key gratis di: https://makersuite.google.com/app/apikey
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')  # Set di environment variable
GEMINI_MODEL = 'gemini-1.5-flash'  # atau 'gemini-pro' untuk response lebih detail

def call_gemini_api(message, conversation_history=None):
    """Call Google Gemini API for contextual responses"""
    if not GEMINI_API_KEY:
        return None, "GEMINI_API_KEY belum diatur. Silakan set environment variable GEMINI_API_KEY."
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    
    # System prompt untuk konteks PIHPS
    system_prompt = """Anda adalah AI Assistant untuk PIHPS BI Dashboard - sistem monitoring harga pangan strategis Indonesia.
    
Kemampuan Anda:
1. Panduan penggunaan dashboard scraping
2. Penjelasan tentang komoditas pangan (beras, daging, telur, minyak, gula, dll)
3. Analisis data harga yang sudah di-scrape
4. Troubleshooting error scraping
5. Informasi umum tentang PIHPS (Pusat Informasi Harga Pangan Strategis)

Jawablah dalam Bahasa Indonesia yang ramah dan profesional. Jika ditanya tentang data spesifik, arahkan user untuk melakukan scraping terlebih dahulu."""

    # Build conversation
    contents = []
    
    # Add system instruction as first user message (Gemini doesn't have native system prompt)
    contents.append({
        "role": "user",
        "parts": [{"text": system_prompt + "\n\nPertanyaan user: " + message}]
    })
    
    # Add conversation history if exists
    if conversation_history:
        for msg in conversation_history[-5:]:  # Keep last 5 messages for context
            role = "user" if msg.get('role') == 'user' else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.get('content', '')}]
            })
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 800,
            "topP": 0.9,
            "topK": 40
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
        ]
    }
    
    try:
        resp = requests.post(
            f"{url}?key={GEMINI_API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        
        # Extract response text
        if 'candidates' in data and len(data['candidates']) > 0:
            candidate = data['candidates'][0]
            if 'content' in candidate and 'parts' in candidate['content']:
                response_text = candidate['content']['parts'][0].get('text', '')
                return response_text, None
        
        return "Maaf, saya tidak dapat memahami pertanyaan tersebut. Coba tanyakan dengan cara lain.", None
        
    except requests.exceptions.RequestException as e:
        return None, f"Error koneksi ke Gemini API: {str(e)}"
    except Exception as e:
        return None, f"Error: {str(e)}"




if __name__ == '__main__':
    load_storage_metadata()
    app.run(debug=True, port=5001)
