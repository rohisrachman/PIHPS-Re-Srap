# 🛒 PIHPS BI — Flask Scraping Dashboard

Dashboard web berbasis Flask untuk scraping data harga pangan strategis dari
**bi.go.id/hargapangan** (Sistem Pemantauan Harga Pangan Strategis Bank Indonesia).

## Fitur
- ✅ Parameter scraping lengkap (periode, provinsi, kab/kota, komoditas)
- ✅ Pilih komoditas via checkbox dengan preset (Semua, Beras, Daging & Telur)
- ✅ Progress bar real-time + live log terminal
- ✅ Download hasil Excel multi-sheet (gabungan + per komoditas)
- ✅ Preview tabel & rekap baris per komoditas
- ✅ Tombol batalkan scraping
- ✅ Delay konfigurabel (untuk koneksi lambat)

## Struktur File
```
pihps_dashboard/
├── app.py               # Flask backend + logika scraping
├── requirements.txt
├── README.md
└── templates/
    └── index.html       # Dashboard UI
```

## Cara Menjalankan

### 1. Install dependencies
```bash
cd pihps_dashboard
pip install -r requirements.txt
```

### 2. Install Chrome & ChromeDriver
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y google-chrome-stable chromium-chromedriver

# Atau install chromedriver otomatis:
pip install chromedriver-autoinstall
python -c "import chromedriver_autoinstall; chromedriver_autoinstall.install(replace=True)"
```

### 3. Jalankan Flask
```bash
python app.py
```

### 4. Buka browser
```
http://localhost:5000
```

## Cara Pakai
1. **Atur Periode** — masukkan tanggal mulai & selesai (format DD/MM/YYYY)
2. **Pilih Provinsi** — pilih dari dropdown
3. **Tambah Kab/Kota** — ketik nama lalu tekan Enter (bisa lebih dari satu)
4. **Pilih Komoditas** — centang/uncentang, gunakan preset Beras atau Daging & Telur
5. **Atur Delay** — naikkan jika koneksi lambat
6. Klik **🚀 Mulai Scraping**
7. Pantau log dan progress bar
8. Setelah selesai, klik **⬇ Download Excel**

## Catatan
- Scraping berjalan di background thread, halaman tetap responsif
- File Excel berisi sheet "Semua Komoditas" + sheet per komoditas
- Jika scraping gagal, coba naikkan nilai Delay Panjang (default 5 detik)
- Tambahkan kab/kota sesuai nama di web BI (bisa partial match)

## Troubleshooting
| Masalah | Solusi |
|---------|--------|
| ChromeDriver error | Pastikan Chrome & ChromeDriver versi sama |
| Data kosong | Naikkan DELAY_PANJANG, atau cek nama kab/kota |
| Timeout | Naikkan delay, periksa koneksi internet |
| Dropdown tidak ditemukan | Struktur web BI mungkin berubah, perlu update selector |
