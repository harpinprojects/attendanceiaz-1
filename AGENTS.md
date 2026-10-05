# AGENTS

- Halaman aplikasi terlindungi berada di `src/routes/_authenticated/` dengan layout bersama `src/components/AppLayout.tsx`; `/login` tetap publik.
- Autentikasi Dosen memakai Lovable Cloud email/password, profil disimpan di `profiles`, dan `kelas.dosen_user_id` disiapkan sebagai penghubung opsional.
- Data absensi/mahasiswa/mata kuliah/kelas diakses dari browser via `@/integrations/supabase/client` + TanStack Query dan hanya tersedia bagi Dosen terautentikasi.
- Satu baris absensi unik per (mahasiswa, kelas, pertemuan) dan disimpan dengan upsert, supaya pengisian ulang pertemuan yang sama tidak menduplikasi data.
- Foto profil disimpan privat di bucket `profile-photos` dengan folder per ID pengguna; `profiles.avatar_path` hanya menyimpan lokasi berkas agar akses tetap mengikuti sesi Dosen.
