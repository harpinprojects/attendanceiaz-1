DROP POLICY "public access absensi" ON public.absensi;
CREATE POLICY "Dosen terautentikasi dapat mengelola absensi" ON public.absensi FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.absensi FROM anon;

DROP POLICY "public access kelas" ON public.kelas;
CREATE POLICY "Dosen terautentikasi dapat mengelola kelas" ON public.kelas FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.kelas FROM anon;

DROP POLICY "public access mahasiswa" ON public.mahasiswa;
CREATE POLICY "Dosen terautentikasi dapat mengelola mahasiswa" ON public.mahasiswa FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.mahasiswa FROM anon;

DROP POLICY "public access mata_kuliah" ON public.mata_kuliah;
CREATE POLICY "Dosen terautentikasi dapat mengelola mata kuliah" ON public.mata_kuliah FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.mata_kuliah FROM anon;