# Login Dosen dan perapian PDF Kartu Kuliah

## Tujuan
- Merapikan unduhan Kartu Kuliah kelas 26E3 agar setiap blok tabel dan tanda tangan tidak terpecah.
- Menambahkan login khusus Dosen tanpa mengubah fungsi absensi yang sudah berjalan.

## Perubahan
- Menambahkan halaman `/login` dengan kartu login profesional berisi Email, Password, dan tombol Masuk.
- Menambahkan profil dosen yang terhubung ke akun login, dengan nama lengkap dan NUPTK sebagai data awal profil.
- Mengunci Dashboard, Data Mahasiswa, Data Mata Kuliah, Data Kelas, Absensi, Laporan, dan Kartu Kuliah; pengguna tanpa sesi diarahkan ke `/login`.
- Menampilkan nama dosen (atau email bila nama belum tersedia) di sidebar dan menyediakan tombol Keluar di bagian bawah.
- Menyiapkan kolom penghubung profil dosen untuk kelas agar pembatasan pengelolaan kelas per dosen dapat diterapkan kemudian, tanpa mengubah akses data saat ini.
- Mengaktifkan login email/password di Lovable Cloud.

## Teknis
- Gunakan autentikasi dan sesi Lovable Cloud.
- Buat tabel profil dengan akses hanya untuk pemilik akun, lalu siapkan relasi opsional dari kelas ke profil dosen.
- Gunakan layout halaman terlindungi agar pemeriksaan login konsisten di seluruh aplikasi.
- Pertahankan seluruh query, formulir, perhitungan, dan hasil laporan yang ada.
- Perbaiki perhitungan ruang PDF berdasarkan tinggi blok keterangan dan tanda tangan, bukan ambang tetap.

## Verifikasi
- Uji pengguna tanpa login dialihkan ke `/login`.
- Uji login dosen, tampilan identitas, akses semua menu, dan logout.
- Unduh ulang PDF kelas 26E3, pastikan A4 landscape dan tinjau setiap halaman hasil render.
- Pastikan halaman dan fitur lama tetap dapat dibuka setelah login.
