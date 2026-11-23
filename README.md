# Kentang6171 – Kendali Wilkerstat dan Geospasial 6171

Website terdiri dari empat halaman:
- `index.html` – Dashboard
- `batching.html` – Batching
- `pengolahan-peta.html` – Pengolahan Peta
- `pengolahan-titik.html` – Pengolahan Titik

## Koneksi Google Spreadsheet
- Data tabel dibaca dari sheet `DB` melalui Google Apps Script.
- Data dashboard dibaca dari sheet `Monitoring`.
- Perubahan pada dropdown/status dan catatan dikirim kembali ke sheet `DB` berdasarkan `idsubsls`.
- Dropdown `Petugas Pengolahan` di halaman Pengolahan Peta dan Pengolahan Titik mengambil pilihan dari validasi dropdown di Spreadsheet. Jika tidak ada pilihan validasi yang terbaca, sistem menggunakan daftar nama unik yang sudah ada pada kolom `Petugas Pengolahan`.
- Daftar petugas tidak ditulis manual di HTML, sehingga mengikuti sumber data Spreadsheet.

## Menjalankan
Buka `index.html` melalui browser atau hosting GitHub Pages. Koneksi internet diperlukan untuk memuat Bootstrap, Bootstrap Icons, dan Google Apps Script.

## Catatan
- Pastikan deployment Google Apps Script menggunakan versi `Code.gs` terbaru.
- File CSS bersama berada di `css/style.css`.
