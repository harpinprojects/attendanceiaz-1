CREATE TABLE public.berita_acara (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id uuid NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  pertemuan integer NOT NULL CHECK (pertemuan BETWEEN 1 AND 16),
  tanggal date,
  pokok_bahasan text NOT NULL DEFAULT '',
  metode text NOT NULL DEFAULT '',
  keterangan text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kelas_id, pertemuan)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.berita_acara TO authenticated;
GRANT ALL ON public.berita_acara TO service_role;
ALTER TABLE public.berita_acara ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dosen terautentikasi dapat mengelola berita acara" ON public.berita_acara FOR ALL TO authenticated USING (true) WITH CHECK (true);