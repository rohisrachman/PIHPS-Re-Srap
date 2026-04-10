# PIHPS BI Dashboard — Struktur File & Setup Guide

## 📁 Struktur Folder

```
pihps_dashboard/
├── app.py                          # Backend Flask + API endpoints
├── requirements.txt                # Dependencies Python
├── README.md
├── storage/                        # Folder untuk menyimpan file Excel
│   └── metadata.json              # Metadata file tersimpan
├── templates/
│   └── index.html                 # HTML utama (3 tab)
└── static/
    ├── css/
    │   └── style.css              # CSS terpisah
    └── js/
        └── app.js                 # JavaScript terpisah
```

## 🚀 Setup & Menjalankan

### 1. Buat struktur folder

```bash
mkdir -p pihps_dashboard/templates pihps_dashboard/static/css pihps_dashboard/static/js pihps_dashboard/storage
cd pihps_dashboard
```

### 2. Copy files

- `app.py` → root folder
- `requirements.txt` → root folder
- `index.html` → `templates/`
- `style.css` → `static/css/`
- `app.js` → `static/js/`
- Folder `storage/` akan dibuat otomatis

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Jalankan server

```bash
python app.py
```

### 5. Buka di browser

```
http://localhost:5000
```

## 📋 Fitur Utama

### 🚀 Tab 1: Scrape Data
- Parameter lengkap: periode, provinsi, kab/kota, komoditas
- Preset komoditas: Semua, Beras, Daging & Telur
- Real-time progress bar + live log terminal
- Data shape validation (before & after scraping)
- Preview tabel 50 baris pertama
- Download Excel multi-sheet
- Statistik komoditas per baris

### 💾 Tab 2: Data Tersimpan
- List semua file Excel yang pernah di-download
- Metadata: jumlah baris, komoditas, tanggal
- Download ulang file lama
- Hapus file individual atau semua sekaligus
- Auto-save setiap kali download

### 📈 Tab 3: Dashboard
- Ringkasan: total scraping, total baris, total file
- Aktivitas terbaru (5 job terakhir)
- Komoditas populer
- Provinsi populer
- Real-time update saat switch tab

## 🔍 Shape Validation

**Before Scraping:**
- Capture parameter: provinsi, periode, komoditas list
- Format: `tgl_mulai + tgl_selesai`

**After Scraping:**
- Validasi columns (harus ada 'Komoditas')
- Validasi row count
- Validasi shape match (before vs after)
- Log validation results

## 🗂️ Storage Structure

Files disimpan di folder `storage/` dengan format:
- **File:** `{uuid}.xlsx`
- **Metadata:** `metadata.json`

Metadata struktur:
```json
{
  "file_id": {
    "id": "unique_id",
    "name": "harga_pangan_2024-01-01_sd_2024-12-31.xlsx",
    "timestamp": "2024-01-15T10:30:00",
    "rows": 1500,
    "komoditas_count": 5,
    "komoditas": ["Beras", "Daging Sapi", ...],
    "provinsi": "Jawa Tengah"
  }
}
```

## 🔗 API Endpoints

### Scraping
- `GET /api/ref/provinsi` — List provinsi
- `GET /api/ref/komoditas` — List komoditas
- `POST /api/start` — Start scraping job
- `GET /api/status/<job_id>` — Check job status
- `POST /api/cancel/<job_id>` — Cancel job
- `GET /api/download/<job_id>` — Download Excel + save

### Storage
- `GET /api/storage/list` — List saved files
- `GET /api/storage/download/<file_id>` — Download old file
- `POST /api/storage/delete/<file_id>` — Delete file
- `POST /api/storage/clear` — Clear all files

### Dashboard
- `GET /api/dashboard/stats` — Get dashboard stats

## 🎨 Styling

- Dark mode modern dengan accent cyan (#00d4ff)
- Responsive design (mobile-friendly)
- CSS variables untuk easy theming
- Smooth animations & transitions
- Font: Sora (sans-serif) + Space Mono (monospace)

## ⚡ Performance Tips

1. **Delay antar request:** Default 0.3 detik (configurable)
2. **Polling interval:** Default 1.2 detik (configurable)
3. **Preview max rows:** 50 baris untuk preview
4. **Storage cleanup:** Hapus files lama untuk hemat space

## 🐛 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| CORS error | Verify API endpoint di `BASE` variable |
| Dropdown kosong | Check internet, coba refresh halaman |
| Data kosong | Naikkan delay atau cek filter kab/kota |
| Storage tidak muncul | Check folder `storage/` dan `metadata.json` |
| Page tidak responsive | Check browser cache, hard refresh (Ctrl+Shift+R) |

## 📝 Notes

- Storage files disimpan otomatis saat download
- Metadata di-load dari disk saat akses
- Shape validation optional (info purposes)
- Dashboard stats real-time dari in-memory jobs + storage metadata
