import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  School,
  ClipboardCheck,
  BarChart3,
  GraduationCap,
  IdCard,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/mahasiswa", label: "Data Mahasiswa", icon: Users },
  { to: "/mata-kuliah", label: "Data Mata Kuliah", icon: BookOpen },
  { to: "/kelas", label: "Data Kelas", icon: School },
  { to: "/absensi", label: "Absensi", icon: ClipboardCheck },
  { to: "/laporan", label: "Laporan", icon: BarChart3 },
  { to: "/kartu-kuliah", label: "Kartu Kuliah", icon: IdCard },
] as const;

export function AppLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: activeDosen } = useQuery({
    queryKey: ["active-dosen"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data: profile } = await supabase.from("profiles").select("nama_lengkap,email").eq("user_id", user.id).maybeSingle();
      return profile?.nama_lengkap || profile?.email || user.email || "Dosen";
    },
  });

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <div
            className="flex size-11 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <GraduationCap className="size-6" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Sistem Absensi
            </p>
            <p className="text-sm font-bold text-foreground">Institut Az Zuhra</p>
          </div>
        </div>
        <div className="mx-4 mb-3 border-y border-border px-2 py-3">
          <p className="text-xs text-muted-foreground">Masuk sebagai:</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{activeDosen ?? "Dosen"}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-4 py-2">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold bg-primary-soft text-primary",
              }}
            >
              <item.icon className="size-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-4">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut /> Keluar
          </Button>
          <p className="mt-3 px-2 text-xs text-muted-foreground">Tahun Akademik 2025/2026</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="border-b border-border bg-card/70 backdrop-blur">
          <div className="px-6 py-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
                activeProps={{
                  className:
                    "rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap bg-primary-soft text-primary",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
