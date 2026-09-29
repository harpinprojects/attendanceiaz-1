CREATE TABLE public.mahasiswa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npm TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  program_studi TEXT NOT NULL,
  kelas TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mahasiswa TO anon, authenticated;
GRANT ALL ON public.mahasiswa TO service_role;
ALTER TABLE public.mahasiswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access mahasiswa" ON public.mahasiswa FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.mata_kuliah (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  sks INTEGER NOT NULL DEFAULT 2,
  semester INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mata_kuliah TO anon, authenticated;
GRANT ALL ON public.mata_kuliah TO service_role;
ALTER TABLE public.mata_kuliah ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access mata_kuliah" ON public.mata_kuliah FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  mata_kuliah_id UUID NOT NULL REFERENCES public.mata_kuliah(id) ON DELETE CASCADE,
  dosen TEXT NOT NULL,
  tahun_akademik TEXT NOT NULL,
  semester INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kelas TO anon, authenticated;
GRANT ALL ON public.kelas TO service_role;
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access kelas" ON public.kelas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.absensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mahasiswa_id UUID NOT NULL REFERENCES public.mahasiswa(id) ON DELETE CASCADE,
  mata_kuliah_id UUID NOT NULL REFERENCES public.mata_kuliah(id) ON DELETE CASCADE,
  kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  pertemuan INTEGER NOT NULL CHECK (pertemuan BETWEEN 1 AND 16),
  tanggal DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir','Izin','Sakit','Alpa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mahasiswa_id, kelas_id, pertemuan)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absensi TO anon, authenticated;
GRANT ALL ON public.absensi TO service_role;
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access absensi" ON public.absensi FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.mata_kuliah (kode, nama, sks, semester) VALUES
 ('IF101','Algoritma dan Pemrograman',3,1),
 ('IF203','Basis Data',3,3),
 ('MN105','Pengantar Manajemen',2,1);

INSERT INTO public.mahasiswa (npm, nama, program_studi, kelas) VALUES
 ('2210001','Ahmad Fauzi','Teknik Informatika','TI-1A'),
 ('2210002','Siti Nurhaliza','Teknik Informatika','TI-1A'),
 ('2210003','Budi Santoso','Teknik Informatika','TI-1A'),
 ('2210004','Dewi Lestari','Manajemen','MN-1A'),
 ('2210005','Rizky Pratama','Manajemen','MN-1A');

INSERT INTO public.kelas (nama, mata_kuliah_id, dosen, tahun_akademik, semester)
SELECT 'TI-1A', id, 'Dr. Hasanuddin, M.Kom', '2025/2026', 1 FROM public.mata_kuliah WHERE kode='IF101';
INSERT INTO public.kelas (nama, mata_kuliah_id, dosen, tahun_akademik, semester)
SELECT 'MN-1A', id, 'Dra. Siti Aminah, M.M', '2025/2026', 1 FROM public.mata_kuliah WHERE kode='MN105';