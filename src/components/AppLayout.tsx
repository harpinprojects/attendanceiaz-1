import { useState } from "react";
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
  FileText,
  LogOut,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/mahasiswa", label: "Data Mahasiswa", icon: Users },
  { to: "/mata-kuliah", label: "Data Mata Kuliah", icon: BookOpen },
  { to: "/kelas", label: "Data Kelas", icon: School },
  { to: "/absensi", label: "Absensi", icon: ClipboardCheck },
  { to: "/laporan", label: "Laporan", icon: BarChart3 },
  { to: "/kartu-kuliah", label: "Kartu Kuliah", icon: IdCard },
  { to: "/berita-acara", label: "Berita Acara", icon: FileText },
  { to: "/honor-dosen", label: "Honor & Kehadiran Dosen", icon: Banknote },
  { to: "/profil", label: "Profil Akun", icon: UserRound },
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
  const [collapsed, setCollapsed] = useState(false);
  const { data: activeDosen } = useQuery({
    queryKey: ["active-dosen"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nama_lengkap,email,avatar_path")
        .eq("user_id", user.id)
        .maybeSingle();
      const name = profile?.nama_lengkap || profile?.email || user.email || "Dosen";
      let avatarUrl: string | null = null;
      if (profile?.avatar_path) {
        const { data: signed } = await supabase.storage
          .from("profile-photos")
          .createSignedUrl(profile.avatar_path, 3600);
        avatarUrl = signed?.signedUrl ?? null;
      }
      return { name, avatarUrl };
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
      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <div
          className={`flex items-center gap-3 py-6 ${
            collapsed ? "flex-col px-2" : "px-6"
          }`}
        >
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <GraduationCap className="size-6" />
          </div>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Perbesar menu"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
            >
              <PanelLeftOpen className="size-5" />
            </button>
          ) : (
            <>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Sistem Absensi
                </p>
                <p className="truncate text-sm font-bold text-foreground">Institut Az Zuhra</p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Perkecil menu"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
              >
                <PanelLeftClose className="size-5" />
              </button>
            </>
          )}
        </div>
        {!collapsed && (
          <div className="mx-4 mb-3 flex items-center gap-3 border-y border-border px-2 py-3">
            <Avatar className="size-9 border border-border">
              <AvatarImage src={activeDosen?.avatarUrl ?? undefined} alt="Foto profil Dosen" className="object-cover" />
              <AvatarFallback className="bg-primary-soft text-xs font-bold text-primary">
                {(activeDosen?.name ?? "Dosen").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Masuk sebagai:</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{activeDosen?.name ?? "Dosen"}</p>
            </div>
          </div>
        )}
        {collapsed && activeDosen ? (
          <Avatar className="mx-auto mb-3 size-9 border border-border" title={activeDosen.name}>
            <AvatarImage src={activeDosen.avatarUrl ?? undefined} alt="Foto profil Dosen" className="object-cover" />
            <AvatarFallback className="bg-primary-soft text-xs font-bold text-primary">
              {activeDosen.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : null}
        <nav className={`flex flex-1 flex-col gap-1 py-2 ${collapsed ? "px-3" : "px-4"}`}>
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              title={item.label}
              className={`flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              }`}
              activeProps={{
                className: `flex items-center rounded-lg text-sm font-semibold bg-primary-soft text-primary ${
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                }`,
              }}
            >
              <item.icon className="size-4.5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border px-3 py-4">
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto flex text-muted-foreground"
              onClick={handleLogout}
              title="Keluar"
            >
              <LogOut />
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
                <LogOut /> Keluar
              </Button>
              <p className="mt-3 px-2 text-xs text-muted-foreground">Tahun Akademik 2025/2026</p>
            </>
          )}
        </div>
      </aside>

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <header className="border-b border-border bg-card/70 backdrop-blur">
          <div className="flex items-center gap-3 px-6 py-6">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Perbesar menu" : "Perkecil menu"}
              className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary lg:inline-flex"
            >
              {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
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
