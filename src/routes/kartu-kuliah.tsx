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

const DISTRIBUSI_NILAI = [
  ["A", "4", "85 - 100"],
  ["A-", "3.75", "80 - 84"],
  ["B", "3.00", "70 - 74"],
  ["B-", "2.75", "65 - 69"],
  ["B+", "3.5", "75 - 79"],
  ["C", "2.00", "55 - 59"],
  ["C+", "2.50", "60 - 64"],
  ["D", "1.50", "50 - 54"],
  ["E", "0.00", "0 - 49"],
] as const;

type KetuaProdi = { nama: string; nuptk: string };
type KartuRow = {
  npm: string;
  nama: string;
  prodi: string;
  cells: string[];
  persen: number;
};

function getKetuaProdi(prodi: string): KetuaProdi {
  const normalized = prodi.toLocaleLowerCase("id-ID");
  if (normalized.includes("manajemen informatika")) {
    return {
      nama: "Achmad Harpin Asrori, S.Kom., M.T.",
      nuptk: "0242774675130243",
    };
  }
  if (normalized.includes("manajemen")) {
    return {
      nama: "Dr. Putra Budi Ansori, S.E., M.M",
      nuptk: "4033750651130163",
    };
  }
  return { nama: "", nuptk: "" };
}

function getDosenNuptk(dosen: string) {
  const normalized = dosen.toLocaleLowerCase("id-ID");
  if (normalized.includes("achmad harpin asrori")) return "0242774675130243";
  if (normalized.includes("putra budi ansori")) return "4033750651130163";
  return "";
}

function fmtTgl(tanggal?: string) {
  if (!tanggal) return "";
  const [y, m, d] = tanggal.split("-");
  return y && m && d ? `${d}/${m}/${y}` : tanggal;
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

  const kelas = kelasList.find((item) => item.id === kelasId);

  const { data } = useQuery({
    queryKey: ["kartu-kuliah", kelasId],
    enabled: Boolean(kelas),
    queryFn: async () => {
      if (!kelas) throw new Error("Kelas belum dipilih.");
      const [mk, mhs, abs] = await Promise.all([
        supabase.from("mata_kuliah").select("*").eq("id", kelas.mata_kuliah_id).single(),
        supabase.from("mahasiswa").select("*").eq("kelas", kelas.nama).order("npm"),
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

  const tanggal: Record<number, string> = {};
  const students = new Map<string, { npm: string; nama: string; prodi: string }>();
  const status = new Map<string, string>();
  if (data) {
    for (const mahasiswa of data.mhs) {
      students.set(mahasiswa.id, {
        npm: mahasiswa.npm,
        nama: mahasiswa.nama,
        prodi: mahasiswa.program_studi,
      });
    }
    for (const absensi of data.abs) {
      if (!tanggal[absensi.pertemuan]) tanggal[absensi.pertemuan] = absensi.tanggal;
      if (absensi.mahasiswa && !students.has(absensi.mahasiswa_id)) {
        students.set(absensi.mahasiswa_id, {
          npm: absensi.mahasiswa.npm,
          nama: absensi.mahasiswa.nama,
          prodi: absensi.mahasiswa.program_studi,
        });
      }
      status.set(`${absensi.mahasiswa_id}-${absensi.pertemuan}`, absensi.status);
    }
  }

  const rows: KartuRow[] = [...students.entries()]
    .sort((a, b) => a[1].npm.localeCompare(b[1].npm))
    .map(([id, student]) => {
      const cells = PERTEMUAN_LIST.map((pertemuan) => status.get(`${id}-${pertemuan}`) ?? "");
      const tercatat = cells.filter(Boolean).length;
      const hadir = cells.filter((cell) => cell === "Hadir").length;
      return { ...student, cells, persen: tercatat ? Math.round((hadir / tercatat) * 100) : 0 };
    });

  const prodi = rows[0]?.prodi ?? "-";
  const ketuaProdi = getKetuaProdi(prodi);
  const dosenNuptk = kelas ? getDosenNuptk(kelas.dosen) : "";
  const info: [string, string][] = data && kelas
    ? [
        ["MATAKULIAH", data.mk.nama],
        ["PRODI", prodi],
        ["DOSEN (KOORDINATOR)", kelas.dosen],
        ["SKS / SEM", `${data.mk.sks} / ${kelas.semester}`],
        ["THN. AKD", kelas.tahun_akademik],
        ["KELAS", kelas.nama],
      ]
    : [];

  async function downloadPdf() {
    if (!data || !kelas) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageRows = rows.length > 16
      ? [rows.slice(0, 16), ...Array.from({ length: Math.ceil((rows.length - 16) / 20) }, (_, i) => rows.slice(16 + i * 20, 36 + i * 20))]
      : [rows];

    const tableHead = [
      [
        { content: "NO", rowSpan: 4 },
        { content: "NAMA MAHASISWA", rowSpan: 4 },
        { content: "NPM", rowSpan: 4 },
        { content: "PERTEMUAN KE - (TANDA TANGAN / PARAF MAHASISWA)", colSpan: 16 },
        { content: "% HADIR", rowSpan: 4 },
        { content: "NILAI AKHIR", colSpan: 2, rowSpan: 3 },
      ],
      [{ content: "TANGGAL PERTEMUAN", colSpan: 16 }],
      PERTEMUAN_LIST.map((pertemuan) => fmtTgl(tanggal[pertemuan])),
      [...PERTEMUAN_LIST.map(String), "HURUF", "ANGKA"],
    ];

    pageRows.forEach((chunk, pageIndex) => {
      if (pageIndex > 0) doc.addPage("a4", "landscape");
      let startY = 8;
      if (pageIndex === 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("INSTITUT AZ ZUHRA", pageWidth / 2, 10, { align: "center" });
        doc.setFontSize(12);
        doc.text("KARTU KULIAH MAHASISWA", pageWidth / 2, 16, { align: "center" });
        doc.setFontSize(8.5);
        info.forEach(([key, value], index) => {
          const column = index % 3;
          const row = Math.floor(index / 3);
          const x = 10 + column * 98;
          const y = 25 + row * 7;
          const labelWidth = column === 2 ? 39 : 23;
          doc.setFont("helvetica", "bold");
          doc.text(key, x, y);
          doc.setFont("helvetica", "normal");
          doc.text(`: ${value.toLocaleUpperCase("id-ID")}`, x + labelWidth, y, { maxWidth: 59 });
        });
        startY = 42;
      }

      const body = chunk.map((row, index) => [
        String(pageIndex === 0 ? index + 1 : 17 + (pageIndex - 1) * 20 + index),
        row.nama.toLocaleUpperCase("id-ID"),
        row.npm,
        ...row.cells.map((cell) => (cell && cell !== "Hadir" ? (KODE[cell] ?? "") : "")),
        `${row.persen}%`,
        "",
        "",
      ]);

      const isLastPage = pageIndex === pageRows.length - 1;
      if (isLastPage) {
        body.push([
          { content: "TANDA TANGAN DOSEN", colSpan: 3 },
          ...PERTEMUAN_LIST.map(() => ""),
          "",
          "",
          "",
        ] as never);
        body.push([
          { content: "Tanggal Perkuliahan", colSpan: 3 },
          ...PERTEMUAN_LIST.map((pertemuan) => fmtTgl(tanggal[pertemuan])),
          "",
          "",
          "",
        ] as never);
      }

      const hadirMark = new Set<string>();
      chunk.forEach((row, rowIndex) => {
        row.cells.forEach((cell, cellIndex) => {
          if (cell === "Hadir") hadirMark.add(`${rowIndex}-${cellIndex + 3}`);
        });
      });

      autoTable(doc, {
        startY,
        head: tableHead as never,
        body,
        theme: "grid",
        margin: { left: 10, right: 10 },
        tableWidth: pageWidth - 20,
        styles: {
          fontSize: 6.3,
          halign: "center",
          valign: "middle",
          cellPadding: 0.7,
          lineColor: 0,
          lineWidth: 0.15,
          textColor: 0,
          minCellHeight: 5,
        },
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold", fontSize: 6.2 },
        bodyStyles: { fillColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 7 },
          1: { cellWidth: 42, halign: "left" },
          2: { cellWidth: 25 },
          19: { cellWidth: 17 },
          20: { cellWidth: 17 },
          21: { cellWidth: 17 },
          ...Object.fromEntries(PERTEMUAN_LIST.map((pertemuan) => [pertemuan + 2, { cellWidth: 6.65 }])),
        },
        didParseCell: (hookData) => {
          if (hookData.section === "body" && hookData.column.index === 1) hookData.cell.styles.halign = "left";
        },
        didDrawCell: (hookData) => {
          if (hookData.section === "body" && hadirMark.has(`${hookData.row.index}-${hookData.column.index}`)) {
            const centerX = hookData.cell.x + hookData.cell.width / 2;
            const centerY = hookData.cell.y + hookData.cell.height / 2;
            doc.setLineWidth(0.35);
            doc.line(centerX - 1.3, centerY, centerX - 0.35, centerY + 1);
            doc.line(centerX - 0.35, centerY + 1, centerX + 1.5, centerY - 1.2);
          }
        },
      });

      if (isLastPage) {
        const tableResult = doc as unknown as { lastAutoTable?: { finalY: number } };
        let detailY = (tableResult.lastAutoTable?.finalY ?? startY) + 5;
        if (detailY > pageHeight - 50) {
          doc.addPage("a4", "landscape");
          detailY = 10;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Ket", 10, detailY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("A.", 10, detailY + 8);
        doc.rect(15, detailY + 4, 61, 12);
        doc.text("Nilai Akhir = Absensi (10%) + Tugas (10%) +", 17, detailY + 8.5);
        doc.text("KUIS (20%) + UTS (25%) + UAS (35%)", 20, detailY + 12.5);
        doc.text("B.  Penilaian Hasil Belajar", 10, detailY + 20);
        doc.text("Distribusi Nilai", 10, detailY + 45);
        doc.text("Kehadiran Minimal 75%", 10, detailY + 65);
        doc.text("(14 kali pertemuan)", 10, detailY + 69);

        autoTable(doc, {
          startY: detailY + 17,
          margin: { left: 42 },
          tableWidth: 50,
          head: [["Nilai", "Bobot", "Derajat\nPenugasan", "Jumlah\nMahasiswa"]],
          body: DISTRIBUSI_NILAI.map(([nilai, bobot, derajat]) => [nilai, bobot, derajat, ""]),
          theme: "grid",
          styles: { fontSize: 5.8, cellPadding: 0.65, halign: "center", valign: "middle", lineColor: 0, lineWidth: 0.15, textColor: 0 },
          headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
          bodyStyles: { fillColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });

        const signatureY = detailY + 3;
        drawPdfSignature(doc, pageWidth * 0.57, signatureY, "Ketua Prodi,", ketuaProdi.nama, ketuaProdi.nuptk);
        drawPdfSignature(doc, pageWidth * 0.86, signatureY, "Dosen Pengampu,", kelas.dosen, dosenNuptk);
      }
    });

    doc.save(`Kartu-Kuliah-${kelas.nama}-${data.mk.kode}.pdf`);
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
                {kelasList.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nama} — {item.mata_kuliah?.kode} {item.mata_kuliah?.nama}
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

      {data && kelas ? (
        <Card className="mt-6 border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
          <CardContent className="p-6">
            <div className="min-w-[1080px] font-sans text-foreground">
              <div className="text-center text-sm font-bold leading-tight">
                <p>INSTITUT AZ ZUHRA</p>
                <p>KARTU KULIAH MAHASISWA</p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-x-8 gap-y-2 text-xs">
                {info.map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className={`shrink-0 font-bold ${key === "DOSEN (KOORDINATOR)" ? "w-40" : "w-24"}`}>{key}</span>
                    <span>: {value.toLocaleUpperCase("id-ID")}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 overflow-x-auto">
                <KartuTable rows={rows} tanggal={tanggal} />
              </div>
              <KeteranganDanTandaTangan
                ketuaProdi={ketuaProdi}
                dosen={kelas.dosen}
                dosenNuptk={dosenNuptk}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AppLayout>
  );
}

function KartuTable({ rows, tanggal }: { rows: KartuRow[]; tanggal: Record<number, string> }) {
  return (
    <table className="w-full table-fixed border-collapse text-[10px]">
      <colgroup>
        <col className="w-8" />
        <col className="w-48" />
        <col className="w-24" />
        {PERTEMUAN_LIST.map((pertemuan) => <col key={pertemuan} className="w-10" />)}
        <col className="w-16" />
        <col className="w-14" />
        <col className="w-14" />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={4} className="border border-foreground p-1">NO</th>
          <th rowSpan={4} className="border border-foreground p-1">NAMA MAHASISWA</th>
          <th rowSpan={4} className="border border-foreground p-1">NPM</th>
          <th colSpan={16} className="border border-foreground p-1">PERTEMUAN KE - (TANDA TANGAN / PARAF MAHASISWA)</th>
          <th rowSpan={4} className="border border-foreground p-1">% HADIR</th>
          <th colSpan={2} rowSpan={3} className="border border-foreground p-1">NILAI AKHIR</th>
        </tr>
        <tr>
          <th colSpan={16} className="border border-foreground p-1">TANGGAL PERTEMUAN</th>
        </tr>
        <tr>
          {PERTEMUAN_LIST.map((pertemuan) => (
            <th key={pertemuan} className="h-6 border border-foreground px-0.5 text-[8px] font-normal">
              {fmtTgl(tanggal[pertemuan])}
            </th>
          ))}
        </tr>
        <tr>
          {PERTEMUAN_LIST.map((pertemuan) => <th key={pertemuan} className="border border-foreground p-1">{pertemuan}</th>)}
          <th className="border border-foreground p-1">HURUF</th>
          <th className="border border-foreground p-1">ANGKA</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={22} className="border border-foreground p-3 text-center">Belum ada mahasiswa.</td></tr>
        ) : rows.map((row, index) => (
          <tr key={row.npm} className="even:bg-muted/40">
            <td className="border border-foreground p-1 text-center">{index + 1}</td>
            <td className="border border-foreground p-1 uppercase">{row.nama}</td>
            <td className="border border-foreground p-1 text-center">{row.npm}</td>
            {row.cells.map((cell, cellIndex) => (
              <td key={cellIndex} className="border border-foreground p-1 text-center font-bold">{cell ? KODE[cell] : ""}</td>
            ))}
            <td className="border border-foreground p-1 text-center font-bold">{row.persen}%</td>
            <td className="border border-foreground p-1" />
            <td className="border border-foreground p-1" />
          </tr>
        ))}
        <tr>
          <td colSpan={3} className="border border-foreground p-1">TANDA TANGAN DOSEN</td>
          <td colSpan={19} className="border border-foreground p-1" />
        </tr>
        <tr>
          <td colSpan={3} className="border border-foreground p-1">Tanggal Perkuliahan</td>
          {PERTEMUAN_LIST.map((pertemuan) => (
            <td key={pertemuan} className="border border-foreground px-0.5 text-center text-[8px]">{fmtTgl(tanggal[pertemuan])}</td>
          ))}
          <td colSpan={3} className="border border-foreground p-1" />
        </tr>
      </tbody>
    </table>
  );
}

function KeteranganDanTandaTangan({
  ketuaProdi,
  dosen,
  dosenNuptk,
}: {
  ketuaProdi: KetuaProdi;
  dosen: string;
  dosenNuptk: string;
}) {
  return (
    <div className="mt-4 grid grid-cols-[360px_1fr_1fr] gap-10 text-[10px]">
      <div>
        <p className="font-bold">Ket</p>
        <div className="mt-2 grid grid-cols-[16px_1fr] gap-y-2">
          <span>A.</span>
          <p className="border border-foreground px-2 py-1 text-center">
            Nilai Akhir = Absensi (10%) + Tugas (10%) + KUIS (20%) + UTS (25%) + UAS (35%)
          </p>
          <span>B.</span>
          <p>Penilaian Hasil Belajar</p>
        </div>
        <div className="mt-1 grid grid-cols-[110px_1fr] items-center gap-2">
          <div className="space-y-16">
            <p>Distribusi Nilai</p>
            <p>Kehadiran Minimal 75%<br />(14 kali pertemuan)</p>
          </div>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr>
                <th className="border border-foreground p-1">Nilai</th>
                <th className="border border-foreground p-1">Bobot</th>
                <th className="border border-foreground p-1">Derajat<br />Penugasan</th>
                <th className="border border-foreground p-1">Jumlah<br />Mahasiswa</th>
              </tr>
            </thead>
            <tbody>
              {DISTRIBUSI_NILAI.map(([nilai, bobot, derajat]) => (
                <tr key={nilai} className="even:bg-muted/40">
                  <td className="border border-foreground p-1">{nilai}</td>
                  <td className="border border-foreground p-1">{bobot}</td>
                  <td className="border border-foreground p-1">{derajat}</td>
                  <td className="border border-foreground p-1" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Signature title="Ketua Prodi," name={ketuaProdi.nama} nuptk={ketuaProdi.nuptk} />
      <Signature title="Dosen Pengampu," name={dosen} nuptk={dosenNuptk} />
    </div>
  );
}

function Signature({ title, name, nuptk }: { title: string; name: string; nuptk: string }) {
  return (
    <div className="text-center">
      <p>{title}</p>
      <div className="h-28" />
      <p className="font-medium underline">{name || "................................................"}</p>
      <p>{nuptk ? `NUPTK. ${nuptk}` : "NUPTK. ................................"}</p>
    </div>
  );
}

function drawPdfSignature(
  doc: import("jspdf").jsPDF,
  centerX: number,
  y: number,
  title: string,
  name: string,
  nuptk: string,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(title, centerX, y, { align: "center" });
  const displayName = name || "................................................";
  doc.text(displayName, centerX, y + 35, { align: "center" });
  const nameWidth = doc.getTextWidth(displayName);
  doc.line(centerX - nameWidth / 2, y + 36, centerX + nameWidth / 2, y + 36);
  doc.text(nuptk ? `NUPTK. ${nuptk}` : "NUPTK. ................................", centerX, y + 40, { align: "center" });
}