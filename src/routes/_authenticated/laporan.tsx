import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_LIST, type Status } from "@/lib/absensi";

export const Route = createFileRoute("/_authenticated/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan | Sistem Absensi Institut Az Zuhra" },
      {
        name: "description",
        content: "Rekap otomatis kehadiran mahasiswa per kelas dan mata kuliah.",
      },
      { property: "og:title", content: "Laporan | Sistem Absensi Institut Az Zuhra" },
      { property: "og:description", content: "Rekap otomatis kehadiran mahasiswa." },
    ],
  }),
  component: LaporanPage,
});

function LaporanPage() {
  const [kelasId, setKelasId] = useState("all");

  const { data: kelasList = [] } = useQuery({
    queryKey: ["kelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kelas")
        .select("*, mata_kuliah(kode, nama)")
        .order("nama");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["laporan", kelasId],
    queryFn: async () => {
      let q = supabase
        .from("absensi")
        .select("status, pertemuan, mahasiswa(id, npm, nama), kelas(nama), mata_kuliah(kode, nama)");
      if (kelasId !== "all") q = q.eq("kelas_id", kelasId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const rekap = new Map<
    string,
    { npm: string; nama: string; kelas: string; mk: string; counts: Record<Status, number> }
  >();
  for (const r of rows) {
    const key = `${r.mahasiswa?.id}-${r.kelas?.nama}-${r.mata_kuliah?.kode}`;
    if (!rekap.has(key)) {
      rekap.set(key, {
        npm: r.mahasiswa?.npm ?? "-",
        nama: r.mahasiswa?.nama ?? "-",
        kelas: r.kelas?.nama ?? "-",
        mk: r.mata_kuliah ? `${r.mata_kuliah.kode} - ${r.mata_kuliah.nama}` : "-",
        counts: { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 },
      });
    }
    rekap.get(key)!.counts[r.status as Status] += 1;
  }
  const list = [...rekap.values()].sort((a, b) => a.npm.localeCompare(b.npm));

  return (
    <AppLayout title="Laporan" description="Rekap kehadiran otomatis dari data absensi.">
      <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="p-6">
          <div className="max-w-sm space-y-2">
            <Label>Filter Kelas</Label>
            <Select value={kelasId} onValueChange={setKelasId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {kelasList.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama} — {k.mata_kuliah?.kode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NPM</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Mata Kuliah</TableHead>
                {STATUS_LIST.map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
                <TableHead>Total</TableHead>
                <TableHead>% Hadir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground">
                    Memuat rekap...
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground">
                    Belum ada data absensi.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((r) => {
                  const total =
                    r.counts.Hadir + r.counts.Izin + r.counts.Sakit + r.counts.Alpa;
                  const persen = total ? Math.round((r.counts.Hadir / total) * 100) : 0;
                  return (
                    <TableRow key={`${r.npm}-${r.kelas}-${r.mk}`}>
                      <TableCell className="font-medium">{r.npm}</TableCell>
                      <TableCell>{r.nama}</TableCell>
                      <TableCell>{r.kelas}</TableCell>
                      <TableCell>{r.mk}</TableCell>
                      {STATUS_LIST.map((s) => (
                        <TableCell key={s}>{r.counts[s]}</TableCell>
                      ))}
                      <TableCell>{total}</TableCell>
                      <TableCell className="font-semibold text-primary">{persen}%</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
