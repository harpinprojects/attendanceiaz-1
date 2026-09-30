import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERTEMUAN_LIST } from "@/lib/absensi";

export const Route = createFileRoute("/kartu-kuliah")({
  head: () => ({
    meta: [
      { title: "Kartu Kuliah Mahasiswa | Institut Az Zuhra" },
      { name: "description", content: "Kartu Kuliah Mahasiswa per kelas dengan rekap pertemuan 1-16." },
      { property: "og:title", content: "Kartu Kuliah Mahasiswa | Institut Az Zuhra" },
      { property: "og:description", content: "Kartu Kuliah Mahasiswa per kelas, siap diunduh PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KartuKuliahPage,
});

const KODE: Record<string, string> = { Hadir: "✓", Izin: "I", Sakit: "S", Alpa: "A" };

function fmtTgl(t?: string) {
  if (!t) return "";
  const [, m, d] = t.split("-");
  return `${d}/${m}`;
}

function KartuKuliahPage() {
  const [kelasId, setKelasId] = useState("");

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

  const kelas = kelasList.find((k) => k.id === kelasId);

  const { data } = useQuery({
    queryKey: ["kartu-kuliah", kelasId],
    enabled: !!kelas,
    queryFn: async () => {
      const [mk, mhs, abs] = await Promise.all([
        supabase.from("mata_kuliah").select("*").eq("id", kelas!.mata_kuliah_id).single(),
        supabase.from("mahasiswa").select("*").eq("kelas", kelas!.nama).order("npm"),
        supabase
          .from("absensi")
          .select("mahasiswa_id, pertemuan, tanggal, status, mahasiswa(id, npm, nama, program_studi)")
          .eq("kelas_id", kelasId),
      ]);
      if (mk.error) throw mk.error;
      if (mhs.error) throw mhs.error;
      if (abs.error) throw abs.error;
      return { mk: mk.data, mhs: mhs.data, abs: abs.data };
    },
  });

  // Build rows
  const tanggal: Record<number, string> = {};
  const students = new Map<string, { npm: string; nama: string; prodi: string }>();
  const status = new Map<string, string>();
  if (data) {
    for (const m of data.mhs) students.set(m.id, { npm: m.npm, nama: m.nama, prodi: m.program_studi });
    for (const a of data.abs) {
      if (!tanggal[a.pertemuan]) tanggal[a.pertemuan] = a.tanggal;
      if (a.mahasiswa && !students.has(a.mahasiswa_id))
        students.set(a.mahasiswa_id, {
          npm: a.mahasiswa.npm,
          nama: a.mahasiswa.nama,
          prodi: a.mahasiswa.program_studi,
        });
      status.set(`${a.mahasiswa_id}-${a.pertemuan}`, a.status);
    }
  }
  const rows = [...students.entries()]
    .sort((a, b) => a[1].npm.localeCompare(b[1].npm))
    .map(([id, s]) => {
      const cells = PERTEMUAN_LIST.map((p) => status.get(`${id}-${p}`) ?? "");
      const tercatat = cells.filter(Boolean).length;
      const hadir = cells.filter((c) => c === "Hadir").length;
      return { ...s, cells, persen: tercatat ? Math.round((hadir / tercatat) * 100) : 0 };
    });

  const prodi = rows[0]?.prodi ?? "-";
  const info: [string, string][] = data
    ? [
        ["MATAKULIAH", `${data.mk.kode} - ${data.mk.nama}`],
        ["PRODI", prodi],
        ["DOSEN", kelas!.dosen],
        ["SKS / SEM", `${data.mk.sks} / ${kelas!.semester}`],
        ["THN. AKD", kelas!.tahun_akademik],
        ["KELAS", kelas!.nama],
      ]
    : [];

  async function downloadPdf() {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("INSTITUT AZ ZUHRA", W / 2, 14, { align: "center" });
    doc.setFontSize(12);
    doc.text("KARTU KULIAH MAHASISWA", W / 2, 21, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(10, 24, W - 10, 24);

    doc.setFontSize(9);
    info.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 10 + col * (W / 2);
      const y = 30 + row * 5.5;
      doc.setFont("helvetica", "bold");
      doc.text(k, x, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${v}`, x + 25, y);
    });

    const head = [
      [
        { content: "NO", rowSpan: 2 },
        { content: "NAMA MAHASISWA", rowSpan: 2 },
        { content: "NPM", rowSpan: 2 },
        { content: "PERTEMUAN", colSpan: 16 },
        { content: "% HADIR", rowSpan: 2 },
        { content: "NILAI AKHIR", rowSpan: 2 },
      ],
      PERTEMUAN_LIST.map((p) => `${p}\n${fmtTgl(tanggal[p])}`),
    ];
    const body = rows.map((r, i) => [
      String(i + 1),
      r.nama,
      r.npm,
      ...r.cells.map((c) => (c && c !== "Hadir" ? (KODE[c] ?? "") : "")),
      `${r.persen}%`,
      "",
    ]);
    const hadirMark = new Set<string>();
    rows.forEach((r, i) => r.cells.forEach((c, j) => c === "Hadir" && hadirMark.add(`${i}-${j + 3}`)));

    autoTable(doc, {
      startY: 48,
      head: head as never,
      body,
      theme: "grid",
      margin: { left: 10, right: 10 },
      tableWidth: W - 20,
      styles: { fontSize: 7.5, halign: "center", valign: "middle", cellPadding: 1.2, lineColor: 0, lineWidth: 0.2, textColor: 0 },
      headStyles: { fillColor: [235, 230, 245], textColor: 0, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 52, halign: "left" },
        2: { cellWidth: 22 },
        19: { cellWidth: 15 },
        20: { cellWidth: 17 },
        ...Object.fromEntries(PERTEMUAN_LIST.map((p) => [p + 2, { cellWidth: (W - 20 - 114) / 16 }])),
      },
      didDrawCell: (d) => {
        if (d.section === "body" && hadirMark.has(`${d.row.index}-${d.column.index}`)) {
          const cx = d.cell.x + d.cell.width / 2;
          const cy = d.cell.y + d.cell.height / 2;
          doc.setLineWidth(0.4);
          doc.line(cx - 1.4, cy, cx - 0.4, cy + 1.1);
          doc.line(cx - 0.4, cy + 1.1, cx + 1.6, cy - 1.2);
        }
      },
    });
    doc.save(`Kartu-Kuliah-${kelas!.nama}-${data.mk.kode}.pdf`);
  }

  return (
    <AppLayout title="Kartu Kuliah Mahasiswa" description="Kartu kuliah per kelas dengan pertemuan 1-16.">
      <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div className="w-full max-w-sm space-y-2">
            <Label>Pilih Kelas</Label>
            <Select value={kelasId} onValueChange={setKelasId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {kelasList.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama} — {k.mata_kuliah?.kode} {k.mata_kuliah?.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={downloadPdf} disabled={!data}>
            <Download className="size-4" /> DOWNLOAD PDF
          </Button>
        </CardContent>
      </Card>

      {data ? (
        <Card className="mt-6 border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
          <CardContent className="p-6">
            <div className="border-b-2 border-foreground pb-2 text-center">
              <p className="text-lg font-bold">INSTITUT AZ ZUHRA</p>
              <p className="font-bold">KARTU KULIAH MAHASISWA</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              {info.map(([k, v]) => (
                <div key={k} className="flex">
                  <span className="w-28 font-semibold">{k}</span>
                  <span>: {v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-primary-soft">
                  <tr>
                    <th rowSpan={2} className="border border-border p-1">NO</th>
                    <th rowSpan={2} className="border border-border p-1">NAMA MAHASISWA</th>
                    <th rowSpan={2} className="border border-border p-1">NPM</th>
                    <th colSpan={16} className="border border-border p-1">PERTEMUAN</th>
                    <th rowSpan={2} className="border border-border p-1">% HADIR</th>
                    <th rowSpan={2} className="border border-border p-1">NILAI AKHIR</th>
                  </tr>
                  <tr>
                    {PERTEMUAN_LIST.map((p) => (
                      <th key={p} className="border border-border p-1 font-medium">
                        {p}
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {fmtTgl(tanggal[p]) || "-"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={21} className="border border-border p-3 text-center text-muted-foreground">
                        Belum ada mahasiswa.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={r.npm}>
                        <td className="border border-border p-1 text-center">{i + 1}</td>
                        <td className="border border-border p-1 whitespace-nowrap">{r.nama}</td>
                        <td className="border border-border p-1 text-center">{r.npm}</td>
                        {r.cells.map((c, j) => (
                          <td key={j} className="border border-border p-1 text-center font-semibold">
                            {c ? KODE[c] : ""}
                          </td>
                        ))}
                        <td className="border border-border p-1 text-center font-semibold text-primary">
                          {r.persen}%
                        </td>
                        <td className="border border-border p-1" />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Keterangan: ✓ = Hadir, I = Izin, S = Sakit, A = Alpa
            </p>
          </CardContent>
        </Card>
      ) : null}
    </AppLayout>
  );
}
