# Mo'eeya - Aplikasi Presensi & Tata Kelola Desa

Aplikasi presensi digital desa modern, responsif, dan elegan dengan desain UI kelas dashboard profesional, dilengkapi dengan sistem multi-role, validasi GPS & radius kantor, webcam selfie watermark, pengajuan izin/sakit/cuti, serta pencetakan laporan resmi.

---

## 🚀 Akun Demo Siap Pakai

Anda dapat langsung mengklik tombol **Login Cepat (Demo)** pada halaman login atau memasukkan kredensial berikut:

| Peran (Role) | NIK / Akun | Password | Unit Kantor | Hak Akses Utama |
| :--- | :--- | :--- | :--- | :--- |
| **👑 Super Admin** | `198501012010011001` | `admin` | Kantor Camat Botumoito | Dashboard Global, Koreksi Absen, Tambah/Kelola Semua Pegawai, Pengaturan Lokasi Peta & Jam Kerja, Laporan Lengkap |
| **🏢 Admin Desa** | `199002022015021002` | `admin` | Kantor Desa Botumoito | Dashboard Statistik Desa, Koreksi Absen Pegawai Desa, Tambah Pegawai Desa, Cetak Laporan Desa |
| **👤 Pegawai (User)** | `7501020304050001` | `user` | Kantor Desa Botumoito | Absen Masuk & Pulang Selfie, Absensi Teman, Izin, Sakit, Cuti, Profil Saya, Riwayat Presensi |

---

## 🌟 Fitur Utama Sesuai Spesifikasi

### 1. Halaman Login (3 Role)
- Pilihan peran: **Super Admin**, **Admin Desa**, dan **User / Pegawai**.
- Tombol 1-klik pengisian akun demo untuk uji coba instan.
- Validasi keamanan kredensial dan feedback modern.

### 2. Tampilan Pegawai (User)
- **Foto Profil & Status**: Menampilkan avatar, nama lengkap, NIK, jabatan, dan status kehadiran hari ini.
- **Widget Jam Kerja**: Jam digital real-time, target **Jam Masuk (08:00)** dan **Jam Pulang (16:00)**.
- **8 Tombol Aksi Lengkap**:
  1. 🟢 **Absen Masuk**: Selfie webcam dengan watermark waktu, koordinat GPS, dan deteksi radius kantor desa.
  2. 🔵 **Absen Pulang**: Selfie jam pulang dan penghitungan jam kerja.
  3. 👥 **Absensi Teman**: Membantu presensi rekan satu kantor desa dengan catatan audit khusus.
  4. 📝 **Tombol Izin**: Form permohonan izin dengan tanggal dan alasan.
  5. 🏥 **Tombol Sakit**: Form pelaporan sakit pegawai.
  6. 🏖️ **Tombol Cuti**: Form pengajuan cuti resmi.
  7. 👤 **Tombol Profil**: Edit informasi akun, unggah foto profil baru, dan ganti password.
  8. 📜 **Riwayat Absen**: Tabel riwayat kehadiran pribadi lengkap dengan foto thumbnail.

### 3. Tampilan Admin Desa
- **Foto Profil Admin & Info Desa**: Manajemen foto profil via unggah berkas, selfie webcam, maupun reset default.
- **Profil Saya**: Menu khusus untuk memperbarui nama, jabatan resmi, no HP, password, dan foto profil.
- **Absensi Teman / Rekan Kerja**: Membantu presensi rekan kerja satu kantor desa dengan fitur pencarian cepat.
- **Dashboard**:
  - Kartu statistik kehadiran, keterlambatan, dan persentase disiplin.
  - Diagram Donut status absensi (Tepat Waktu, Terlambat, Izin, Belum Hadir).
  - Diagram Batang tren kehadiran mingguan (7 hari terakhir).
  - Feed aktivitas presensi real-time.
- **Koreksi Absen**: Fitur mengubah status presensi pegawai desa yang mengalami kendala teknis atau dinas luar disertai catatan, dilengkapi tombol langsung kirim ke Google Sheets.
- **Tambah Pegawai**: CRUD pegawai pada kantor desa yang bersangkutan.
- **Laporan**: Cetak laporan rekapitulasi desa dengan penandatanganan Kepala Desa / Sekretaris Desa (PDF & Excel).

### 4. Tampilan Super Admin
- **Foto Profil Super Admin & Status Wilayah**: Manajemen foto profil via unggah berkas, selfie webcam, maupun reset default.
- **Profil Saya**: Menu khusus untuk memperbarui nama, gelar, jabatan resmi, no HP, password, dan foto profil.
- **Absensi Rekan Kerja (Lintas Kantor)**: Membantu presensi rekan kerja dengan filter pilihan kantor desa dan pencarian instan.
- **Dashboard Global**: Ringkasan seluruh kantor desa di kecamatan.
- **Koreksi Absen**: Koreksi lintas kantor desa dengan tombol sinkronisasi 1-klik ke Google Sheets.
- **Tambah Pegawai & Manajemen RBAC**: Pengelolaan semua akun pengguna dan admin.
- **Pengaturan Lengkap**:
  - **Tambah Lokasi Absen Pakai Titik Lokasi**: Peta interaktif Leaflet.js (klik pada peta untuk mengambil titik latitude & longitude, tombol ambil GPS lokasi saat ini, serta slider radius batas presensi).
  - **Tambah Nama Kantor**: Kelola daftar kantor desa / unit kerja.
  - **Tambah & Atur Jam Masuk / Jam Pulang**: Pengaturan waktu kerja masing-masing kantor desa.
  - **Koneksi Database Google Sheets**: Sinkronisasi dua arah, tombol ekspor seluruh data absensi lokal ke Google Spreadsheet.
- **Laporan Wilayah**: Cetak laporan resmi ber-kop surat dinas pemerintahan kecamatan / dinas PMD serta export ke file Excel (.csv).

---

## 💻 Cara Menjalankan

Cukup buka file `index.html` langsung pada peramban web (Google Chrome, Microsoft Edge, Mozilla Firefox, atau Safari). Aplikasi sudah dilengkapi penyimpanan lokal (*offline-first LocalStorage*) dan sinkronisasi awan (*Google Sheets Cloud Sync*):
1. **Data di Database Kosong?**: Cukup klik tombol hijau **"Kirim ke Google Sheets"** pada halaman *Koreksi Absen* atau pada modal *Database* di bar atas untuk mengirim seluruh data presensi lokal ke Google Sheets seketika!
2. **Koneksi Google Spreadsheet**: Spreadsheet Google Sheet terhubung adalah [Mo'eeya Spreadsheet](https://docs.google.com/spreadsheets/d/1lM9x10LOVkZFZv-iLRvre2uhpqvycZ_WuDLFagtY7Ic/edit). Pastikan Web App di-deploy dengan opsi akses "Anyone" (Siapa saja).
