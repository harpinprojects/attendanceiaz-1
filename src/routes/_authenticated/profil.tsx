import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Profil Akun — Sistem Absensi Institut Az Zuhra" },
      { name: "description", content: "Kelola profil akun dosen: nama lengkap, NUPTK, dan email." },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const queryClient = useQueryClient();
  const [namaLengkap, setNamaLengkap] = useState("");
  const [nuptk, setNuptk] = useState("");

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
      return { userId: user.id, email: user.email ?? "", profil: data };
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
