DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mahasiswa','mata_kuliah','kelas','absensi','berita_acara'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid()', t);
    EXECUTE format('UPDATE public.%I SET owner_id = %L WHERE owner_id IS NULL', t, '8c33f0f2-e560-45d5-a8b1-c75cf772dc6b');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(owner_id)', t || '_owner_idx', t);
  END LOOP;
END $$;

ALTER TABLE public.mahasiswa DROP CONSTRAINT mahasiswa_npm_key;
ALTER TABLE public.mahasiswa ADD CONSTRAINT mahasiswa_owner_npm_key UNIQUE (owner_id, npm);
ALTER TABLE public.mata_kuliah DROP CONSTRAINT mata_kuliah_kode_key;
ALTER TABLE public.mata_kuliah ADD CONSTRAINT mata_kuliah_owner_kode_key UNIQUE (owner_id, kode);

DROP POLICY "Dosen terautentikasi dapat mengelola mahasiswa" ON public.mahasiswa;
DROP POLICY "Dosen terautentikasi dapat mengelola mata kuliah" ON public.mata_kuliah;
DROP POLICY "Dosen terautentikasi dapat mengelola kelas" ON public.kelas;
DROP POLICY "Dosen terautentikasi dapat mengelola absensi" ON public.absensi;
DROP POLICY "Dosen terautentikasi dapat mengelola berita acara" ON public.berita_acara;

CREATE POLICY "Dosen mengelola mahasiswa sendiri" ON public.mahasiswa FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Dosen mengelola mata kuliah sendiri" ON public.mata_kuliah FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Dosen mengelola kelas sendiri" ON public.kelas FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Dosen mengelola absensi sendiri" ON public.absensi FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Dosen mengelola berita acara sendiri" ON public.berita_acara FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());