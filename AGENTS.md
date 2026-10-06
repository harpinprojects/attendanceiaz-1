# AGENTS

- Halaman aplikasi terlindungi berada di `src/routes/_authenticated/` dengan layout bersama `src/components/AppLayout.tsx`; `/login` tetap publik.
- Autentikasi Dosen memakai Lovable Cloud email/password, profil disimpan di `profiles`, dan `kelas.dosen_user_id` disiapkan sebagai penghubung opsional.
- Data mahasiswa, mata kuliah, kelas, absensi, dan berita acara dimiliki per akun Dosen lewat kolom `owner_id` (default auth.uid()) dan RLS owner-only; NPM/kode unik per Dosen, supaya tiap akun mengelola datanya sendiri.
- Satu baris absensi unik per (mahasiswa, kelas, pertemuan) dan disimpan dengan upsert, supaya pengisian ulang pertemuan yang sama tidak menduplikasi data.
- Foto profil disimpan privat di bucket `profile-photos` dengan folder per ID pengguna; `profiles.avatar_path` hanya menyimpan lokasi berkas agar akses tetap mengikuti sesi Dosen.
