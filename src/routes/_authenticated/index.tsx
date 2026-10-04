import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, School, ClipboardCheck, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { statusClass, STATUS_LIST, type Status } from "@/lib/absensi";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard | Sistem Absensi Institut Az Zuhra" },
      {
        name: "description",
        content:
          "Ringkasan data mahasiswa, mata kuliah, kelas, dan rekap kehadiran Institut Az Zuhra.",
      },
      { property: "og:title", content: "Dashboard | Sistem Absensi Institut Az Zuhra" },
      {
        property: "og:description",
        content: "Ringkasan data mahasiswa, mata kuliah, kelas, dan rekap kehadiran.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [mhs, mk, kls, abs] = await Promise.all([
        supabase.from("mahasiswa").select("id", { count: "exact", head: true }),
        supabase.from("mata_kuliah").select("id", { count: "exact", head: true }),
        supabase.from("kelas").select("id", { count: "exact", head: true }),
        supabase.from("absensi").select("status"),
      ]);
      if (abs.error) throw abs.error;
      const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<Status, number>;
      for (const row of abs.data ?? []) counts[row.status as Status] += 1;
      return {
        mahasiswa: mhs.count ?? 0,
        mataKuliah: mk.count ?? 0,
        kelas: kls.count ?? 0,
        total: abs.data?.length ?? 0,
        counts,
      };
    },
  });

  const { data: jadwal = [] } = useQuery({
    queryKey: ["jadwal-mendatang"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kelas")
        .select("id, nama, dosen, hari, jam_mulai, jam_selesai, ruangan, mata_kuliah(kode, nama)")
        .not("hari", "is", null);
      if (error) throw error;
      const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const toMin = (t: string | null) => {
        if (!t) return 0;
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      return (data ?? [])
        .map((k) => {
          const d = HARI.indexOf(k.hari ?? "");
          if (d < 0) return null;
          let diff = (d - now.getDay() + 7) % 7;
          const end = toMin(k.jam_selesai ?? k.jam_mulai);
          if (diff === 0 && end && end < nowMin) diff = 7;
          const date = new Date(now);
          date.setDate(now.getDate() + diff);
          return { ...k, diff, date, sort: diff * 1440 + toMin(k.jam_mulai) };
        })
        .filter((k): k is NonNullable<typeof k> => k !== null)
        .sort((a, b) => a.sort - b.sort)
        .slice(0, 6);
    },
  });

  const stats = [
    { label: "Mahasiswa", value: data?.mahasiswa ?? 0, icon: Users },
    { label: "Mata Kuliah", value: data?.mataKuliah ?? 0, icon: BookOpen },
    { label: "Kelas", value: data?.kelas ?? 0, icon: School },
    { label: "Catatan Absensi", value: data?.total ?? 0, icon: ClipboardCheck },
  ];

  const persenHadir = data && data.total > 0 ? Math.round((data.counts.Hadir / data.total) * 100) : 0;

  return (
    <AppLayout title="Dashboard" description="Ringkasan data dan kehadiran perkuliahan.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat data...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              className="border-border lg:col-span-2"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-foreground">Rekap Status Kehadiran</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  {STATUS_LIST.map((s) => (
                    <div key={s} className={`rounded-xl border p-4 ${statusClass[s]}`}>
                      <p className="text-xs font-medium">{s}</p>
                      <p className="mt-1 text-2xl font-bold">{data?.counts[s] ?? 0}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-foreground">Persentase Kehadiran</h2>
                <p className="mt-4 text-5xl font-bold text-primary">{persenHadir}%</p>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${persenHadir}%`, backgroundImage: "var(--gradient-primary)" }}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Dihitung dari seluruh catatan absensi yang tersimpan.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <CalendarClock className="size-5 text-primary" /> Jadwal Kelas Mendatang
              </h2>
              {jadwal.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Belum ada jadwal. Atur jadwal di menu Data Kelas.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {jadwal.map((k) => (
                    <div key={k.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                          {k.diff === 0 ? "Hari ini" : k.diff === 1 ? "Besok" : k.hari}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {k.date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="mt-2 font-semibold text-foreground">
                        {k.mata_kuliah?.nama ?? "-"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Kelas {k.nama} · {k.dosen}
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {k.jam_mulai?.slice(0, 5) ?? "-"}–{k.jam_selesai?.slice(0, 5) ?? "-"}
                        {k.ruangan ? ` · ${k.ruangan}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
