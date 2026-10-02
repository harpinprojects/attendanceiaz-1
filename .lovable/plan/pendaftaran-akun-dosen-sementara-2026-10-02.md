# Pendaftaran Akun Dosen Sementara

## Tujuan
Menambahkan halaman publik `/register` agar akun Dosen pertama dapat dibuat untuk pengujian, tanpa mengubah halaman dan fitur yang sudah berjalan.

## Perubahan
- Buat formulir pendaftaran berisi Nama Lengkap, NUPTK, Email, Kata Sandi, dan Konfirmasi Kata Sandi.
- Validasi seluruh isian sebelum pendaftaran, termasuk kecocokan dan panjang minimum kata sandi.
- Simpan Nama Lengkap dan NUPTK ke profil Dosen secara otomatis saat akun dibuat.
- Tampilkan hasil yang sesuai dengan pengaturan konfirmasi email: arahkan ke login setelah akun siap, atau minta pengguna memeriksa email bila konfirmasi diperlukan.
- Tambahkan teks “Belum punya akun? Daftar di sini” di bawah tombol Masuk pada halaman login.
- Tambahkan tautan kembali ke halaman login pada halaman pendaftaran.

## Detail teknis
- Gunakan sistem autentikasi email/password Lovable Cloud yang sudah aktif.
- Tambahkan pemicu database yang aman untuk membuat profil dari metadata pendaftaran, sehingga profil tetap tersimpan walaupun sesi belum aktif sebelum email dikonfirmasi.
- Pertahankan `/register` sebagai halaman publik sementara; seluruh halaman aplikasi lainnya tetap terlindungi.
- Tambahkan metadata halaman khusus untuk `/register` dan verifikasi pendaftaran, navigasi, serta kondisi aplikasi.
