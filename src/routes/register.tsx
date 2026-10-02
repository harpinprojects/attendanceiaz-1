import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { GraduationCap, IdCard, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const registerSchema = z
  .object({
    namaLengkap: z.string().trim().min(2, "Nama lengkap wajib diisi").max(100),
    nuptk: z.string().trim().min(1, "NUPTK wajib diisi").max(30),
    email: z.string().trim().email("Alamat email tidak valid").max(255),
    password: z.string().min(8, "Kata sandi minimal 8 karakter").max(128),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi").max(128),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Konfirmasi kata sandi tidak sama",
    path: ["confirmPassword"],
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
  const [form, setForm] = useState({ namaLengkap: "", nuptk: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Periksa kembali data pendaftaran");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nama_lengkap: parsed.data.namaLengkap, nuptk: parsed.data.nuptk },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message.includes("already registered") ? "Email sudah terdaftar" : "Pendaftaran gagal. Silakan coba kembali.");
      return;
    }

    if (data.session && data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          user_id: data.user.id,
          nama_lengkap: parsed.data.namaLengkap,
          nuptk: parsed.data.nuptk,
          email: parsed.data.email,
        },
        { onConflict: "user_id" },
      );
      if (profileError) {
        setLoading(false);
        toast.error("Akun dibuat, tetapi profil belum dapat disimpan. Silakan masuk kembali.");
        await navigate({ to: "/login", replace: true });
        return;
      }
      toast.success("Akun Dosen berhasil dibuat");
      await navigate({ to: "/", replace: true });
      return;
    }

    toast.success("Pendaftaran berhasil. Periksa email untuk konfirmasi akun.");
    await navigate({ to: "/login", replace: true });
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
              <Label htmlFor="namaLengkap">Nama Lengkap</Label>
              <div className="relative"><UserRound className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="namaLengkap" autoComplete="name" value={form.namaLengkap} onChange={(event) => setField("namaLengkap", event.target.value)} className="pl-9" required /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nuptk">NUPTK</Label>
              <div className="relative"><IdCard className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="nuptk" inputMode="numeric" value={form.nuptk} onChange={(event) => setField("nuptk", event.target.value)} className="pl-9" required /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative"><Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setField("email", event.target.value)} className="pl-9" placeholder="dosen@azzuhra.ac.id" required /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <div className="relative"><LockKeyhole className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setField("password", event.target.value)} className="pl-9" minLength={8} required /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi</Label>
              <div className="relative"><LockKeyhole className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setField("confirmPassword", event.target.value)} className="pl-9" minLength={8} required /></div>
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null} Daftar
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Sudah punya akun? <Link to="/login" className="font-semibold text-primary hover:underline">Masuk di sini</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}