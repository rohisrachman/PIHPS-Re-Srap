# 📊 PIHPS BI Dashboard — Setup Guide Lengkap

## 🎯 Ringkasan Fitur

Dashboard web dengan 3 tab utama:

### Tab 1: 🚀 Scrape Data
- Form parameter lengkap (periode, provinsi, kab/kota, komoditas)
- Preset filter komoditas (Semua, Beras, Daging & Telur)
- Progress bar real-time + live log terminal
- **✨ Shape Validation:** Mengecek struktur data sebelum & sesudah scraping
- Preview tabel 50 baris pertama
- Download Excel multi-sheet (gabungan + per-komoditas)
- Statistik baris per komoditas

### Tab 2: 💾 Data Tersimpan
- Grid view semua file Excel yang pernah di-download
- Info: jumlah baris, jumlah komoditas, tanggal simpan
- Download ulang file lama
- Hapus file individual atau all-at-once
- Auto-save metadata ke JSON

### Tab 3: 📈 Dashboard
- KPI card: Total scraping, Total baris, Total files
- Aktivitas terbaru (5 job terakhir)
- Komoditas paling populer
- Provinsi paling populer
- Real-time stats dari database

---

## 📁 Struktur Folder

Buat folder seperti ini:

```
pihps_dashboard/
├── app.py                          # ← Backend Flask + Logika scraping
├── requirements.txt                # ← Dependencies
├── README.md
├── STRUKTUR_FOLDER.md              # ← Dokumentasi struktur
├── storage/                        # ← Folder penyimpanan Excel (auto-created)
│   └── metadata.json              # ← Metadata files (auto-created)
├── templates/
│   └── index.html                 # ← HTML 3 tab (dari file terpisah)
└── static/
    ├── css/
    │   └── style.css              # ← Styling CSS (dari file terpisah)
    └── js/
        └── app.js                 # ← JavaScript (dari file terpisah)
```

---

## 🚀 Cara Setup

### Step 1: Buat Struktur Folder

```bash
# Linux/Mac
mkdir -p pihps_dashboard/templates pihps_dashboard/static/css pihps_dashboard/static/js

# Atau Windows
mkdir pihps_dashboard\templates pihps_dashboard\static\css pihps_dashboard\static\js
```

### Step 2: Copy/Buat Files

Copy files yang sudah dibuat:

1. **app.py** → ke root `pihps_dashboard/`
2. **requirements.txt** → ke root `pihps_dashboard/`
3. **index.html** → ke `pihps_dashboard/templates/`
4. **style.css** → ke `pihps_dashboard/static/css/`
5. **app.js** → ke `pihps_dashboard/static/js/`

### Step 3: Install Dependencies

```bash
cd pihps_dashboard
pip install -r requirements.txt
```

### Step 4: Run Server

```bash
python app.py
```

Output akan tampil seperti:
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### Step 5: Buka di Browser

```
http://localhost:5000
```

---

## 📋 Cara Menggunakan

### 🚀 Tab 1: Scrape Data

1. **Atur Periode**
   - Pilih tanggal mulai & selesai
   - Format: YYYY-MM-DD

2. **Pilih Provinsi**
   - Dropdown auto-load dari API BI

3. **Tambah Kab/Kota (Opsional)**
   - Ketik nama kab/kota
   - Tekan Enter untuk tambah
   - Kosongkan untuk semua kab/kota

4. **Pilih Komoditas**
   - Gunakan preset: ✓ Semua, 🍚 Beras, 🥚 Daging & Telur
   - Atau centang komoditas individual
   - Minimal 1 komoditas harus dipilih

5. **Klik "🚀 Mulai Scraping"**
   - Progress bar akan muncul
   - Live log menunjukkan proses real-time
   - Tunggu sampai selesai

6. **Download Excel**
   - Setelah selesai, klik "⬇️ Download Excel"
   - File auto-tersimpan di tab Data Tersimpan

7. **Cek Shape Validation**
   - Lihat log: "Shape validation: (N, M) → (N, M) (MATCH)"
   - Memastikan struktur data konsisten

### 💾 Tab 2: Data Tersimpan

1. **Lihat File Tersimpan**
   - Grid card menampilkan semua file lama
   - Info: nama, jumlah baris, komoditas, tanggal

2. **Download File Lama**
   - Klik tombol "⬇️ Download" pada file manapun

3. **Hapus File**
   - Klik "🗑️ Hapus" untuk satu file
   - Atau "🗑️ Hapus Semua" untuk hapus all

### 📈 Tab 3: Dashboard

1. **Monitor KPI**
   - Total Scraping: berapa kali scraping dilakukan
   - Total Baris: total baris data dari semua file
   - Total Files: jumlah file tersimpan

2. **Aktivitas Terbaru**
   - Lihat 5 job terakhir dengan provinsi & tanggal

3. **Analisis Populer**
   - Komoditas apa yang paling sering di-scrape
   - Provinsi apa yang paling sering

---

## 🔍 Shape Validation Details

### Apa itu Shape Validation?

Shape = struktur data (columns + rows)

Validasi memastikan:
- ✅ Columns tidak berubah sebelum/sesudah scraping
- ✅ Row count tidak hilang atau bertambah selain dari multiple komoditas
- ✅ Data integrity terjaga

### Contoh Output di Log

```
✅ Shape validation: (1500, 8) → (1500, 8) (MATCH)
```

Artinya:
- Sebelum scraping: 1500 baris, 8 kolom
- Sesudah scraping: 1500 baris, 8 kolom
- Hasilnya: MATCH (konsisten)

---

## 💾 Storage & Metadata

### Auto-Save Behavior

Setiap kali **Download** di tab Scrape Data:
1. File Excel disimpan ke folder `storage/{uuid}.xlsx`
2. Metadata di-update di `storage/metadata.json`
3. Auto-muncul di tab "Data Tersimpan"

### Struktur Metadata

```json
{
  "file_id_123abc": {
    "id": "file_id_123abc",
    "name": "harga_pangan_2024-01-01_sd_2024-12-31.xlsx",
    "timestamp": "2024-01-15T10:30:45.123456",
    "rows": 1500,
    "komoditas_count": 5,
    "komoditas": ["Beras", "Daging Sapi", "Daging Ayam", "Telur Ayam", "Bawang Merah"],
    "provinsi": "Jawa Tengah"
  }
}
```

### Folder `storage/`

Folder ini akan dibuat otomatis saat first download.

```
storage/
├── metadata.json           # Metadata semua files
├── abc123def456.xlsx       # Actual file 1
├── xyz789uvw012.xlsx       # Actual file 2
└── ...
```

---

## ⚙️ Konfigurasi

### Backend (app.py)

```python
BASE = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga"
# ^ Endpoint API BI (jangan diubah kecuali ada update)

STORAGE_DIR = Path("storage")
# ^ Folder penyimpanan (bisa diubah sesuai kebutuhan)

time.sleep(0.3)  # Delay antar request di scraping
# ^ Naikkan jika koneksi lambat atau API strict
```

### Frontend (app.js)

```javascript
pollTimer = setInterval(pollStatus, 1200);
// ^ Polling interval (1200ms = 1.2 detik)
// Ubah ke 2000 jika ingin lebih lambat
```

### Styling (style.css)

```css
:root {
  --accent: #00d4ff;  /* Main color: cyan */
  --green: #00ff88;   /* Success color */
  --red: #ff4444;     /* Error color */
  /* ... lebih banyak di file CSS */
}
```

---

## 🎨 Styling & Customization

### Ubah Warna

Edit `static/css/style.css`:

```css
:root {
  --accent: #00d4ff;  ← Ubah ke warna lain (e.g., #ff00ff untuk magenta)
  --bg: #0b0e14;      ← Background color
  --surface: #111520; ← Card background
  /* ... */
}
```

### Responsive Design

Sudah mobile-friendly dengan media queries:
- ✅ Desktop (1300px+)
- ✅ Tablet (768px - 1299px)
- ✅ Mobile (<768px)

---

## 🐛 Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|---------|--------|
| "Dropdown empty" | API down/timeout | Cek koneksi internet, refresh halaman |
| "Data kosong" | Filter terlalu strict | Cek nama kab/kota, hapus filter |
| "Error: Connection refused" | Server tidak jalan | `python app.py` di terminal |
| "File tidak tersimpan" | Folder `storage/` tidak ada | Auto-created, atau manual `mkdir storage/` |
| "Shape validation error" | Data corruption | Cek log, coba scraping ulang |
| "Halaman blank" | CSS/JS tidak load | Check browser console (F12) |

---

## 📊 API Reference

### Scraping Endpoints

#### `POST /api/start`
Mulai scraping job baru.

**Request:**
```json
{
  "tanggal_mulai": "2024-01-01",
  "tanggal_selesai": "2024-12-31",
  "provinsi": "Jawa Tengah",
  "kabkota_target": ["Semarang", "Klaten"],
  "tipe_laporan": 2,
  "komoditas_filter": ["Beras", "Daging Sapi"]
}
```

**Response:**
```json
{
  "job_id": "abc123de"
}
```

#### `GET /api/status/<job_id>`
Check status job yang sedang berjalan.

**Response:**
```json
{
  "status": "running",
  "current": 3,
  "total": 10,
  "current_komoditas": "Daging Sapi",
  "logs": [...],
  "total_rows": 1500,
  "df_columns": ["Komoditas", "pasar_id", ...],
  "df_preview": [{...}, ...],
  "df_stats": [{"Komoditas": "Beras", "Jumlah Baris": 500}],
  "shape_validation": {
    "before": {"shape": [1500, 8], "columns": [...]},
    "after": {"shape": [1500, 8], "columns": [...]},
    "match": true
  }
}
```

### Storage Endpoints

#### `GET /api/storage/list`
List semua file tersimpan.

**Response:**
```json
[
  {
    "id": "abc123def456",
    "name": "harga_pangan_2024-01-01_sd_2024-12-31.xlsx",
    "timestamp": "2024-01-15T10:30:45",
    "rows": 1500,
    "komoditas_count": 5,
    "komoditas": ["Beras", ...],
    "provinsi": "Jawa Tengah"
  }
]
```

#### `GET /api/storage/download/<file_id>`
Download file Excel.

#### `POST /api/storage/delete/<file_id>`
Hapus file dari storage.

#### `POST /api/storage/clear`
Hapus semua files.

### Dashboard Endpoints

#### `GET /api/dashboard/stats`
Get dashboard statistics.

**Response:**
```json
{
  "total_jobs": 15,
  "total_rows": 45000,
  "total_files": 8,
  "recent_jobs": [
    {"id": "abc123", "provinsi": "Jawa Tengah", "timestamp": "...", "rows": 1500}
  ],
  "popular_komoditas": [
    {"name": "Beras", "count": 5}
  ],
  "popular_provinces": [
    {"name": "Jawa Tengah", "count": 10}
  ]
}
```

---

## 📈 Performance Tips

1. **Polling interval:** Jika dashboard heavy, naikkan dari 1200ms ke 2000ms
2. **Preview rows:** Default 50, bisa dikurangi jika database besar
3. **Delay antar request:** Default 0.3s, naikkan jika API rate-limited
4. **Storage cleanup:** Delete old files untuk hemat disk space

---

## 🔐 Security Notes

- ⚠️ **CORS:** Pastikan API BI accessible dari localhost
- ⚠️ **Credentials:** Tidak ada auth (dev-only)
- ⚠️ **File upload:** Tidak ada (hanya download dari API)
- 🔒 **Recommend:** Untuk production, tambahkan auth + HTTPS

---

## 📞 Support

Jika ada error:
1. Check browser console: `F12` → Console tab
2. Check terminal: `python app.py` output
3. Check network: Browser DevTools → Network tab
4. Check API: Try endpoint langsung di postman/curl

---

## ✅ Checklist Deployment

- [ ] Semua files di folder yang tepat
- [ ] `requirements.txt` sudah install
- [ ] Folder `storage/` ada
- [ ] `python app.py` berjalan tanpa error
- [ ] Browser bisa akses `http://localhost:5000`
- [ ] Tab Scrape Data bisa load provinsi
- [ ] Bisa start scraping sample
- [ ] File bisa di-download & tersimpan
- [ ] Tab Data Tersimpan menampilkan file
- [ ] Tab Dashboard show stats

---

🎉 **Selesai!** Enjoy your PIHPS BI Dashboard!
