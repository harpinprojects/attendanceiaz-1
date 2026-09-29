import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { PERTEMUAN_LIST, STATUS_LIST, statusClass, type Status } from "@/lib/absensi";

export const Route = createFileRoute("/absensi")({
  head: () => ({
    meta: [
      { title: "Absensi | Sistem Absensi Institut Az Zuhra" },
      {
        name: "description",
        content: "Isi kehadiran mahasiswa per mata kuliah, kelas, dan pertemuan 1-16.",
      },
      { property: "og:title", content: "Absensi | Sistem Absensi Institut Az Zuhra" },
      { property: "og:description", content: "Isi kehadiran mahasiswa per pertemuan." },
    ],
  }),
  component: AbsensiPage,
});

function AbsensiPage() {
  const qc = useQueryClient();
  const [mataKuliahId, setMataKuliahId] = useState("");
  const [kelasId, setKelasId] = useState("");
  const [pertemuan, setPertemuan] = useState("1");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState<Record<string, Status>>({});

  const { data: mataKuliah = [] } = useQuery({
    queryKey: ["mata_kuliah"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mata_kuliah").select("*").order("kode");
      if (error) throw error;
      return data;
    },
  });

  const { data: kelasList = [] } = useQuery({
    queryKey: ["kelas", mataKuliahId],
    enabled: !!mataKuliahId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kelas")
        .select("*")
        .eq("mata_kuliah_id", mataKuliahId)
        .order("nama");
      if (error) throw error;
      return data;
    },
  });

  const kelas = kelasList.find((k) => k.id === kelasId);

  const { data: mahasiswa = [], isLoading } = useQuery({
    queryKey: ["mahasiswa-kelas", kelas?.nama],
    enabled: !!kelas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mahasiswa")
        .select("*")
        .eq("kelas", kelas!.nama)
        .order("npm");
      if (error) throw error;
      return data;
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["absensi-existing", kelasId, pertemuan],
    enabled: !!kelasId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absensi")
        .select("*")
        .eq("kelas_id", kelasId)
        .eq("pertemuan", Number(pertemuan));
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const next: Record<string, Status> = {};
    for (const m of mahasiswa) next[m.id] = "Hadir";
    for (const a of existing) next[a.mahasiswa_id] = a.status as Status;
    setStatuses(next);
    if (existing.length > 0 && existing[0]?.tanggal) setTanggal(existing[0].tanggal);
  }, [mahasiswa, existing]);

  const simpan = useMutation({
    mutationFn: async () => {
      const rows = mahasiswa.map((m) => ({
        mahasiswa_id: m.id,
        mata_kuliah_id: mataKuliahId,
        kelas_id: kelasId,
        pertemuan: Number(pertemuan),
        tanggal,
        status: statuses[m.id] ?? "Hadir",
      }));
      const { error } = await supabase
        .from("absensi")
        .upsert(rows, { onConflict: "mahasiswa_id,kelas_id,pertemuan" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absensi-existing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["laporan"] });
      toast.success("Absensi berhasil disimpan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout
      title="Absensi"
      description="Pilih mata kuliah, kelas, pertemuan, lalu tetapkan status kehadiran."
    >
      <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="grid gap-4 p-6 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Mata Kuliah</Label>
            <Select
              value={mataKuliahId}
              onValueChange={(v) => {
                setMataKuliahId(v);
                setKelasId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih mata kuliah" />
              </SelectTrigger>
              <SelectContent>
                {mataKuliah.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.kode} - {m.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kelas</Label>
            <Select value={kelasId} onValueChange={setKelasId} disabled={!mataKuliahId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {kelasList.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama} — {k.dosen}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pertemuan</Label>
            <Select value={pertemuan} onValueChange={setPertemuan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERTEMUAN_LIST.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    Pertemuan {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tanggal</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="p-0">
          {!kelasId ? (
            <p className="p-6 text-sm text-muted-foreground">
              Pilih mata kuliah dan kelas untuk menampilkan daftar mahasiswa.
            </p>
          ) : isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Memuat mahasiswa...</p>
          ) : mahasiswa.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Belum ada mahasiswa pada kelas {kelas?.nama}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NPM</TableHead>
                  <TableHead>Nama Mahasiswa</TableHead>
                  <TableHead>Program Studi</TableHead>
                  <TableHead>Status Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mahasiswa.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.npm}</TableCell>
                    <TableCell>{m.nama}</TableCell>
                    <TableCell>{m.program_studi}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_LIST.map((s) => {
                          const active = (statuses[m.id] ?? "Hadir") === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStatuses((p) => ({ ...p, [m.id]: s }))}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                active
                                  ? statusClass[s]
                                  : "border-border text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {kelasId && mahasiswa.length > 0 ? (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => simpan.mutate()} disabled={simpan.isPending}>
            <Save className="size-4" /> Simpan Absensi
          </Button>
        </div>
      ) : null}
    </AppLayout>
  );
}
