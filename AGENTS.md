# AGENTS

- Halaman aplikasi adalah route file di `src/routes/` dengan layout bersama `src/components/AppLayout.tsx`, agar navigasi konsisten di semua halaman.
- Data absensi/mahasiswa/mata kuliah/kelas diakses langsung dari browser via `@/integrations/supabase/client` + TanStack Query; tidak ada auth sehingga tabel memakai policy akses publik.
- Satu baris absensi unik per (mahasiswa, kelas, pertemuan) dan disimpan dengan upsert, supaya pengisian ulang pertemuan yang sama tidak menduplikasi data.
