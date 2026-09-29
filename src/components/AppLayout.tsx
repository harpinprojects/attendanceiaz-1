import { Link } from "@tanstack/react-router";
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
} from "lucide-react";

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
        <p className="px-6 py-5 text-xs text-muted-foreground">Tahun Akademik 2025/2026</p>
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
