CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  nama_lengkap TEXT NOT NULL DEFAULT '',
  nuptk TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dosen dapat melihat profil sendiri"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Dosen dapat membuat profil sendiri"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Dosen dapat memperbarui profil sendiri"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.kelas ADD COLUMN dosen_user_id UUID;
CREATE INDEX kelas_dosen_user_id_idx ON public.kelas(dosen_user_id);
COMMENT ON COLUMN public.kelas.dosen_user_id IS 'Penghubung opsional ke profiles.user_id untuk pembatasan kelas per dosen di masa depan';