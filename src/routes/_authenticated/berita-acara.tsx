import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERTEMUAN_LIST } from "@/lib/absensi";

export const Route = createFileRoute("/_authenticated/berita-acara")({
  head: () => ({
    meta: [
      { title: "Berita Acara Perkuliahan | Institut Az Zuhra" },
      { name: "description", content: "Berita Acara Perkuliahan (BAP) per kelas dengan jumlah kehadiran otomatis." },
      { property: "og:title", content: "Berita Acara Perkuliahan | Institut Az Zuhra" },
      { property: "og:description", content: "BAP pertemuan 1-16, siap dicetak PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BeritaAcaraPage,
});

type Entri = { tanggal: string; pokok_bahasan: string; metode: string; keterangan: string };
const KOSONG: Entri = { tanggal: "", pokok_bahasan: "", metode: "", keterangan: "" };
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function fmtHariTgl(t?: string) {
  if (!t) return "";
  const [y, m, d] = t.split("-").map(Number);
  if (!y || !m || !d) return t;
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${HARI[day]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(y).slice(2)}`;
}

function BeritaAcaraPage() {
  const qc = useQueryClient();
  const [kelasId, setKelasId] = useState("");
  const [entri, setEntri] = useState<Record<number, Entri>>({});
  const [saving, setSaving] = useState(false);

  const { data: kelasList = [] } = useQuery({
    queryKey: ["kelas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kelas").select("*, mata_kuliah(kode, nama)").order("nama");
      if (error) throw error;
      return data;
    },
  });
  const kelas = kelasList.find((k) => k.id === kelasId);

  const { data } = useQuery({
    queryKey: ["berita-acara", kelasId],
    enabled: Boolean(kelas),
    queryFn: async () => {
      if (!kelas) throw new Error("Kelas belum dipilih.");
      const [mk, mhs, abs, bap] = await Promise.all([
        supabase.from("mata_kuliah").select("*").eq("id", kelas.mata_kuliah_id).single(),
        supabase.from("mahasiswa").select("program_studi").eq("kelas", kelas.nama).limit(1),
        supabase.from("absensi").select("pertemuan, tanggal, status").eq("kelas_id", kelasId),
        supabase.from("berita_acara").select("*").eq("kelas_id", kelasId),
      ]);
      if (mk.error) throw mk.error;
      if (mhs.error) throw mhs.error;
      if (abs.error) throw abs.error;
      if (bap.error) throw bap.error;
      return { mk: mk.data, prodi: mhs.data[0]?.program_studi ?? "-", abs: abs.data, bap: bap.data };
    },
  });

  // Rekap kehadiran otomatis dari absensi
  const rekap: Record<number, { hadir: number; tidak: number; tanggal?: string }> = {};
  for (const a of data?.abs ?? []) {
    const r = (rekap[a.pertemuan] ??= { hadir: 0, tidak: 0, tanggal: a.tanggal });
    if (a.status === "Hadir") r.hadir++;
    else r.tidak++;
  }

  useEffect(() => {
    if (!data) return;
    const next: Record<number, Entri> = {};
    for (const b of data.bap) {
      next[b.pertemuan] = {
        tanggal: b.tanggal ?? "",
        pokok_bahasan: b.pokok_bahasan,
        metode: b.metode,
        keterangan: b.keterangan,
      };
    }
    setEntri(next);
  }, [data]);

  const get = (p: number): Entri => entri[p] ?? KOSONG;
  const tglOf = (p: number) => get(p).tanggal || rekap[p]?.tanggal || "";
  const update = (p: number, key: keyof Entri, value: string) =>
    setEntri((prev) => ({ ...prev, [p]: { ...(prev[p] ?? KOSONG), [key]: value } }));

  async function simpan() {
    if (!kelas) return;
    setSaving(true);
    const rows = PERTEMUAN_LIST.filter((p) => entri[p]).map((p) => ({
      kelas_id: kelas.id,
      pertemuan: p,
      tanggal: get(p).tanggal || null,
      pokok_bahasan: get(p).pokok_bahasan,
      metode: get(p).metode,
      keterangan: get(p).keterangan,
      updated_at: new Date().toISOString(),
    }));
    const { error } = rows.length
      ? await supabase.from("berita_acara").upsert(rows, { onConflict: "kelas_id,pertemuan" })
      : { error: null };
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Berita acara tersimpan.");
    qc.invalidateQueries({ queryKey: ["berita-acara", kelasId] });
  }

  const info = data && kelas
    ? {
        left: [
          ["TAHUN AKADEMIK", kelas.tahun_akademik],
          ["KODE MATAKULIAH", data.mk.kode],
          ["NAMA MATAKULIAH", data.mk.nama],
        ] as [string, string][],
        right: [
          ["KELAS", kelas.nama],
          ["PROGRAM STUDI", data.prodi],
          ["NAMA DOSEN", kelas.dosen],
        ] as [string, string][],
      }
    : null;

  async function downloadPdf() {
    if (!data || !kelas || !info) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INSTITUT AZ ZUHRA", W / 2, 13, { align: "center" });
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("BERITA ACARA PERKULIAHAN (BAP)", W / 2, 19.5, { align: "center" });
    doc.text("FAKULTAS VOKASI", W / 2, 25, { align: "center" });

    doc.setFontSize(9);
    const drawInfo = (items: [string, string][], x: number, labelW: number, valueW: number) => {
      items.forEach(([k, v], i) => {
        const y = 33 + i * 5;
        doc.setFont("times", "bold");
        doc.text(k, x, y);
        doc.setFont("times", "normal");
        const line = (doc.splitTextToSize(v, valueW - 3) as string[])[0];
        doc.text(`: ${line}`, x + labelW, y);
        doc.setLineDashPattern([0.4, 0.6], 0);
        doc.setLineWidth(0.15);
        doc.line(x + labelW + 2, y + 0.8, x + labelW + valueW, y + 0.8);
        doc.setLineDashPattern([], 0);
      });
    };
    drawInfo(info.left, 10, 40, 85);
    drawInfo(info.right, 160, 33, 94);

    const body = PERTEMUAN_LIST.map((p) => [
      String(p),
      fmtHariTgl(tglOf(p)),
      get(p).pokok_bahasan,
      get(p).metode,
      rekap[p] ? String(rekap[p].hadir) : "",
      rekap[p] ? String(rekap[p].tidak) : "",
      "",
      "",
      get(p).keterangan,
    ]);

    autoTable(doc, {
      startY: 47,
      head: [
        [
          { content: "PERTEMUAN", rowSpan: 2 },
          { content: "HARI/ TANGGAL", rowSpan: 2 },
          { content: "POKOK/ SUB\nPOKOK BAHASAN", rowSpan: 2 },
          { content: "METODE", rowSpan: 2 },
          { content: "JUMLAH\nMAHASISWA\nHADIR", rowSpan: 2 },
          { content: "JUMLAH\nMAHASISWA\nTIDAK HADIR", rowSpan: 2 },
          { content: "TANDA TANGAN", colSpan: 2 },
          { content: "KETERANGAN", rowSpan: 2 },
        ],
        ["TEORI", "PRAKTEK"],
      ] as never,
      body,
      theme: "grid",
      margin: { left: 10, right: 10, top: 12, bottom: 12 },
      tableWidth: W - 20,
      rowPageBreak: "avoid",
      showHead: "everyPage",
      styles: {
        font: "times",
        fontSize: 8.5,
        halign: "center",
        valign: "middle",
        cellPadding: 1.2,
        lineColor: 0,
        lineWidth: 0.25,
        textColor: 0,
        minCellHeight: 11,
      },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "normal", minCellHeight: 6 },
      bodyStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 23 },
        1: { cellWidth: 30 },
        2: { cellWidth: 62, halign: "left" },
        3: { cellWidth: 22 },
        4: { cellWidth: 23 },
        5: { cellWidth: 25 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
        8: { cellWidth: W - 20 - 221, halign: "left" },
      },
    });

    const last = doc as unknown as { lastAutoTable?: { finalY: number } };
    let y = (last.lastAutoTable?.finalY ?? 47) + 8;
    if (y + 38 > H - 8) {
      doc.addPage("a4", "landscape");
      y = 20;
    }
    const x = W - 85;
    const now = new Date();
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(`Pekanbaru, ${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`, x, y);
    doc.text("Mengetahui,", x, y + 5);
    doc.text("Dekan Fakultas Vokasi", x, y + 10);
    doc.setFont("times", "bold");
    const nama = "Achmad Harpin Asrori, S.Kom., M.T.";
    doc.text(nama, x, y + 30);
    doc.setLineWidth(0.2);
    doc.line(x, y + 31, x + doc.getTextWidth(nama), y + 31);
    doc.setFont("times", "normal");
    doc.text("NUPTK. 0242774675130243", x, y + 35.5);

    doc.save(`BAP_${data.mk.kode}_${kelas.nama}.pdf`.replace(/\s+/g, "_"));
  }

  return (
    <AppLayout title="Berita Acara Perkuliahan">
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-5">
          <div className="min-w-64 space-y-2">
            <Label>Kelas</Label>
            <Select value={kelasId} onValueChange={setKelasId}>
              <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
              <SelectContent>
                {kelasList.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama} — {k.mata_kuliah?.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {data && (
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={simpan} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button onClick={downloadPdf}>
                <Download className="mr-2 h-4 w-4" /> DOWNLOAD PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {data && info && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="text-center">
              <h2 className="text-2xl font-extrabold text-primary">INSTITUT AZ ZUHRA</h2>
              <p className="font-bold">BERITA ACARA PERKULIAHAN (BAP)</p>
              <p className="font-bold">FAKULTAS VOKASI</p>
            </div>
            <div className="grid gap-x-10 gap-y-1 text-sm md:grid-cols-2">
              {[info.left, info.right].map((col, i) => (
                <div key={i} className="space-y-1">
                  {col.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[150px_1fr]">
                      <span className="font-semibold">{k}</span>
                      <span>: {v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:p-2">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th rowSpan={2}>PERTEMUAN</th>
                    <th rowSpan={2}>HARI/ TANGGAL</th>
                    <th rowSpan={2}>POKOK/ SUB POKOK BAHASAN</th>
                    <th rowSpan={2}>METODE</th>
                    <th rowSpan={2}>JUMLAH MAHASISWA HADIR</th>
                    <th rowSpan={2}>JUMLAH MAHASISWA TIDAK HADIR</th>
                    <th colSpan={2}>TANDA TANGAN</th>
                    <th rowSpan={2}>KETERANGAN</th>
                  </tr>
                  <tr><th>TEORI</th><th>PRAKTEK</th></tr>
                </thead>
                <tbody>
                  {PERTEMUAN_LIST.map((p) => (
                    <tr key={p}>
                      <td className="text-center">{p}</td>
                      <td className="min-w-40">
                        <Input type="date" value={tglOf(p)} onChange={(e) => update(p, "tanggal", e.target.value)} />
                        <div className="mt-1 text-xs text-muted-foreground">{fmtHariTgl(tglOf(p))}</div>
                      </td>
                      <td className="min-w-64">
                        <Input value={get(p).pokok_bahasan} onChange={(e) => update(p, "pokok_bahasan", e.target.value)} />
                      </td>
                      <td className="min-w-28">
                        <Input value={get(p).metode} placeholder="Diskusi" onChange={(e) => update(p, "metode", e.target.value)} />
                      </td>
                      <td className="text-center font-semibold">{rekap[p]?.hadir ?? "-"}</td>
                      <td className="text-center font-semibold">{rekap[p]?.tidak ?? "-"}</td>
                      <td className="min-w-16" />
                      <td className="min-w-16" />
                      <td className="min-w-40">
                        <Input value={get(p).keterangan} onChange={(e) => update(p, "keterangan", e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Jumlah hadir dan tidak hadir diambil otomatis dari menu Absensi.
            </p>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
