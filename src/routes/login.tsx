import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().trim().email("Alamat email tidak valid").max(255),
  password: z.string().min(1, "Password wajib diisi").max(128),
});

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Login Dosen | Sistem Absensi Institut Az Zuhra" },
      { name: "description", content: "Portal login Dosen Sistem Absensi Institut Az Zuhra." },
      { property: "og:title", content: "Portal Dosen | Institut Az Zuhra" },
      { property: "og:description", content: "Login Dosen Sistem Absensi Institut Az Zuhra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Periksa kembali data login");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      setLoading(false);
      toast.error("Email atau password tidak sesuai");
      return;
    }
    const metadata = data.user.user_metadata;
    await supabase.from("profiles").upsert(
      {
        user_id: data.user.id,
        email: data.user.email ?? parsed.data.email,
        nama_lengkap: typeof metadata["nama_lengkap"] === "string" ? metadata["nama_lengkap"] : "",
        nuptk: typeof metadata["nuptk"] === "string" ? metadata["nuptk"] : "",
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
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
            <CardTitle className="text-xl">Portal Dosen</CardTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">Sistem Absensi Institut Az Zuhra</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
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
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required />
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null} Masuk
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Belum punya akun? <Link to="/register" className="font-semibold text-primary hover:underline">Daftar di sini</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}