import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Camera, Loader2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Profil Akun — Sistem Absensi Institut Az Zuhra" },
      { name: "description", content: "Kelola profil akun dosen: nama lengkap, NUPTK, dan email." },
      { property: "og:title", content: "Profil Akun | Sistem Absensi Institut Az Zuhra" },
      { property: "og:description", content: "Kelola identitas dan foto profil akun Dosen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [namaLengkap, setNamaLengkap] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: profil, isLoading } = useQuery({
    queryKey: ["profil-akun"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      let avatarUrl: string | null = null;
      if (data?.avatar_path) {
        const { data: signed } = await supabase.storage
          .from("profile-photos")
          .createSignedUrl(data.avatar_path, 3600);
        avatarUrl = signed?.signedUrl ?? null;
      }
      return { userId: user.id, email: user.email ?? "", profil: data, avatarUrl };
    },
  });

  useEffect(() => {
    if (profil?.profil) {
      setNamaLengkap(profil.profil.nama_lengkap);
      setNuptk(profil.profil.nuptk);
    }
  }, [profil]);

  const simpan = useMutation({
    mutationFn: async () => {
      if (!profil) throw new Error("Sesi tidak ditemukan");
      const { error } = await supabase.from("profiles").upsert(
        {
          user_id: profil.userId,
          nama_lengkap: namaLengkap.trim(),
          nuptk: nuptk.trim(),
          email: profil.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil berhasil disimpan");
      queryClient.invalidateQueries({ queryKey: ["profil-akun"] });
      queryClient.invalidateQueries({ queryKey: ["active-dosen"] });
    },
    onError: (e) => toast.error(`Gagal menyimpan profil: ${e.message}`),
  });

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profil) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Gunakan foto berformat JPG, PNG, atau WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 2 MB");
      return;
    }

    setUploadingPhoto(true);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const avatarPath = `${profil.userId}/avatar-${Date.now()}.${extension}`;
    const previousPath = profil.profil?.avatar_path;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(avatarPath, file, { cacheControl: "3600", upsert: false, contentType: file.type });

    if (uploadError) {
      setUploadingPhoto(false);
      toast.error(`Gagal mengunggah foto: ${uploadError.message}`);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
      .eq("user_id", profil.userId);

    if (profileError) {
      setUploadingPhoto(false);
      toast.error(`Gagal menyimpan foto: ${profileError.message}`);
      return;
    }

    if (previousPath && previousPath !== avatarPath) {
      await supabase.storage.from("profile-photos").remove([previousPath]);
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profil-akun"] }),
      queryClient.invalidateQueries({ queryKey: ["active-dosen"] }),
    ]);
    setUploadingPhoto(false);
    toast.success(previousPath ? "Foto profil berhasil diganti" : "Foto profil berhasil diunggah");
  }

  return (
    <AppLayout title="Profil Akun" description="Kelola identitas akun dosen Anda">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="size-5 text-primary" /> Data Profil
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat profil…</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                simpan.mutate();
              }}
            >
              <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
                <Avatar className="size-24 border border-border">
                  <AvatarImage src={profil?.avatarUrl ?? undefined} alt="Foto profil Dosen" className="object-cover" />
                  <AvatarFallback className="bg-primary-soft text-xl font-bold text-primary">
                    {(namaLengkap || profil?.email || "Dosen").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? <Loader2 className="animate-spin" /> : <Camera />}
                    {profil?.profil?.avatar_path ? "Ganti Foto" : "Unggah Foto"}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP. Maksimal 2 MB.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profil?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input
                  id="nama"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Contoh: Achmad Harpin Asrori, S.Kom., M.T."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nuptk">NUPTK</Label>
                <Input
                  id="nuptk"
                  value={nuptk}
                  onChange={(e) => setNuptk(e.target.value)}
                  placeholder="Nomor Unik Pendidik dan Tenaga Kependidikan"
                />
              </div>
              <Button type="submit" disabled={simpan.isPending}>
                {simpan.isPending ? "Menyimpan…" : "Simpan Profil"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
