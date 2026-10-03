import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Loader2, LockKeyhole, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const registerSchema = z.object({
  nama: z.string().trim().min(1, "Nama lengkap wajib diisi").max(100),
  email: z.string().trim().email("Alamat email tidak valid").max(255),
  password: z.string().min(6, "Password minimal 6 karakter").max(128),
});

export const Route = createFileRoute("/register")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Daftar Dosen | Sistem Absensi Institut Az Zuhra" },
      { name: "description", content: "Pendaftaran akun Dosen Sistem Absensi Institut Az Zuhra." },
      { property: "og:title", content: "Daftar Dosen | Institut Az Zuhra" },
      { property: "og:description", content: "Pendaftaran akun Dosen Sistem Absensi Institut Az Zuhra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = registerSchema.safeParse({ nama, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Periksa kembali data pendaftaran");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Pendaftaran gagal, coba lagi");
      return;
    }
    if (!data.session) {
      setLoading(false);
      toast.success("Pendaftaran berhasil. Silakan cek email untuk konfirmasi, lalu masuk.");
      await navigate({ to: "/login", replace: true });
      return;
    }
    await supabase.from("profiles").upsert(
      {
        user_id: data.user.id,
        email: data.user.email ?? parsed.data.email,
        nama_lengkap: parsed.data.nama,
      },
      { onConflict: "user_id" },
    );
    toast.success("Pendaftaran berhasil. Selamat datang!");
    await navigate({ to: "/", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="items-center space-y-4 pb-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-7" />
          </div>
          <div>
            <CardTitle className="text-xl">Daftar Akun Dosen</CardTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">Sistem Absensi Institut Az Zuhra</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input id="nama" type="text" autoComplete="name" value={nama} onChange={(e) => setNama(e.target.value)} className="pl-9" placeholder="Nama lengkap beserta gelar" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="dosen@azzuhra.ac.id" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="Minimal 6 karakter" required />
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null} Daftar
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Sudah punya akun?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Masuk di sini
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
