import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Download,
  Printer,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Building2,
  Info,
  Edit3,
  Eye,
  Award,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/honor-dosen")({
  head: () => ({
    meta: [
      { title: "Rekap Honor & Kehadiran Dosen | Fakultas Vokasi Institut Az Zuhra" },
      {
        name: "description",
        content:
          "Rekapitulasi absensi kehadiran dosen berdasarkan SK Mengajar Fakultas Vokasi untuk pencairan gaji dan honor perkuliahan.",
      },
      { property: "og:title", content: "Rekap Honor & Kehadiran Dosen | Fakultas Vokasi" },
      {
        property: "og:description",
        content: "Pencairan honor mengajar dosen Fakultas Vokasi berdasarkan SK dan kehadiran riil.",
      },
    ],
  }),
  component: HonorDosenPage,
});

// Default Configuration for SK Mengajar & Rates
interface SkConfig {
  nomorSk: string;
  semester: string;
  tahunAkademik: string;
  tarifPraktik: number; // Rp. 30.000 / SKS pertemuan
  tarifTeori: number; // Rp. 28.000 / SKS pertemuan
  namaDekan: string;
  gelarDekan: string;
  namaWadekKeuangan: string;
  jabatanKeuangan: string;
  kotaTandaTangan: string;
  tanggalDokumen: string;
}

const DEFAULT_CONFIG: SkConfig = {
  nomorSk: "SK/048/DEKAN-VOKASI/IAZ/2025-2026",
  semester: "Ganjil",
  tahunAkademik: "2025/2026",
  tarifPraktik: 30000,
  tarifTeori: 28000,
  namaDekan: "Achmad Harpin Asrori, S.Kom., M.T.",
  gelarDekan: "Dekan Fakultas Vokasi",
  namaWadekKeuangan: "Dr. Putra Budi Ansori, S.E., M.M",
  jabatanKeuangan: "Wakil Dekan Bidang Keuangan",
  kotaTandaTangan: "Pekanbaru",
  tanggalDokumen: new Date().toISOString().split("T")[0] ?? "",
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDosenNuptk(dosen: string): string {
  const normalized = dosen.toLocaleLowerCase("id-ID");
  if (normalized.includes("achmad harpin asrori")) return "0242774675130243";
  if (normalized.includes("putra budi ansori")) return "4033750651130163";
  return "024" + Math.abs(dosen.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) % 9000000000 + 1000000000);
}

// Automatic deduction of Theory vs Practice SKS
function deduceSksBreakdown(courseName: string, totalSks: number): { teori: number; praktik: number } {
  const lower = courseName.toLowerCase();
  const isPraktikHeavy =
    lower.includes("praktik") ||
    lower.includes("praktikum") ||
    lower.includes("lab") ||
    lower.includes("pemrograman") ||
    lower.includes("desain") ||
    lower.includes("workshop") ||
    lower.includes("studio") ||
    lower.includes("jaringan") ||
    lower.includes("basis data") ||
    lower.includes("web") ||
    lower.includes("animasi");

  if (isPraktikHeavy) {
    if (totalSks <= 1) return { teori: 0, praktik: 1 };
    if (totalSks === 2) return { teori: 1, praktik: 1 };
    if (totalSks === 3) return { teori: 1, praktik: 2 };
    if (totalSks === 4) return { teori: 2, praktik: 2 };
    return { teori: Math.floor(totalSks / 2), praktik: Math.ceil(totalSks / 2) };
  }

  // Pure Theory default
  return { teori: totalSks, praktik: 0 };
}

type SksCustomMapping = Record<string, { sksTeori: number; sksPraktik: number; overrideHadir?: number }>;

function HonorDosenPage() {
  // View mode: 'detailed' (per course class) or 'dosen' (grouped per lecturer)
  const [viewMode, setViewMode] = useState<"detailed" | "dosen">("detailed");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDosenFilter, setSelectedDosenFilter] = useState("all");

  // Config State (persisted in localStorage)
  const [config, setConfig] = useState<SkConfig>(() => {
    try {
      const saved = localStorage.getItem("sk_mengajar_vokasi_config");
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  // Custom SKS and meeting overrides (persisted in localStorage)
  const [sksMap, setSksMap] = useState<SksCustomMapping>(() => {
    try {
      const saved = localStorage.getItem("sk_mengajar_sks_mapping");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Dialog states
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editRowItem, setEditRowItem] = useState<{
    id: string;
    namaDosen: string;
    mataKuliah: string;
    kelas: string;
    sksTeori: number;
    sksPraktik: number;
    hadir: number;
  } | null>(null);

  // BAP Drilldown modal
  const [bapModalItem, setBapModalItem] = useState<{
    kelasId: string;
    kelasNama: string;
    mataKuliah: string;
    dosen: string;
  } | null>(null);

  // Fetch classes with mata kuliah
  const { data: kelasList = [], isLoading: loadingKelas } = useQuery({
    queryKey: ["kelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kelas")
        .select("*, mata_kuliah(id, kode, nama, sks, semester)")
        .order("nama");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all berita acara to count realized meetings per class
  const { data: bapList = [] } = useQuery({
    queryKey: ["berita_acara_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("berita_acara").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch absensi to supplement meeting realization
  const { data: absensiList = [] } = useQuery({
    queryKey: ["absensi_meetings_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("absensi").select("kelas_id, pertemuan, tanggal");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch profiles for lecturer details
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Save config changes
  const saveConfig = (newConfig: SkConfig) => {
    setConfig(newConfig);
    localStorage.setItem("sk_mengajar_vokasi_config", JSON.stringify(newConfig));
    toast.success("Pengaturan SK Mengajar & Tarif berhasil disimpan.");
    setConfigModalOpen(false);
  };

  // Save row override
  const saveRowOverride = (
    kelasId: string,
    sksTeori: number,
    sksPraktik: number,
    overrideHadir?: number,
  ) => {
    const updated = {
      ...sksMap,
      [kelasId]: {
        sksTeori,
        sksPraktik,
        ...(overrideHadir !== undefined ? { overrideHadir } : {}),
      },
    };
    setSksMap(updated);
    localStorage.setItem("sk_mengajar_sks_mapping", JSON.stringify(updated));
    toast.success("Beban SKS & kehadiran mata kuliah berhasil diperbarui.");
    setEditRowItem(null);
  };

  // Compute meetings per class from BAP and Absensi
  const meetingsPerClass = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const b of bapList) {
      if (!map.has(b.kelas_id)) map.set(b.kelas_id, new Set());
      map.get(b.kelas_id)!.add(b.pertemuan);
    }
    for (const a of absensiList) {
      if (!map.has(a.kelas_id)) map.set(a.kelas_id, new Set());
      map.get(a.kelas_id)!.add(a.pertemuan);
    }
    const result: Record<string, number> = {};
    for (const [kId, set] of map.entries()) {
      result[kId] = set.size;
    }
    return result;
  }, [bapList, absensiList]);

  // Aggregate assignments data for the Dean's review
  const assignmentRows = useMemo(() => {
    return kelasList.map((k) => {
      const mk = k.mata_kuliah;
      const mkNama = mk?.nama ?? "Mata Kuliah";
      const totalSks = mk?.sks ?? 2;

      // Check if custom override exists
      const custom = sksMap[k.id];
      const autoBreakdown = deduceSksBreakdown(mkNama, totalSks);

      const sksTeori = custom?.sksTeori ?? autoBreakdown.teori;
      const sksPraktik = custom?.sksPraktik ?? autoBreakdown.praktik;

      const autoHadir = meetingsPerClass[k.id] ?? 0;
      const hadir = custom?.overrideHadir !== undefined ? custom.overrideHadir : autoHadir;

      const honorTeori = hadir * sksTeori * config.tarifTeori;
      const honorPraktik = hadir * sksPraktik * config.tarifPraktik;
      const totalHonor = honorTeori + honorPraktik;

      const dosenName = k.dosen?.trim() || "Dosen Pengampu";
      const profile = profiles.find((p) => p.nama_lengkap?.toLowerCase() === dosenName.toLowerCase());
      const nuptk = profile?.nuptk || getDosenNuptk(dosenName);

      return {
        kelasId: k.id,
        kelasNama: k.nama,
        mataKuliahId: mk?.id ?? "",
        mataKuliahKode: mk?.kode ?? "-",
        mataKuliahNama: mkNama,
        totalSks,
        sksTeori,
        sksPraktik,
        dosen: dosenName,
        nuptk,
        hadir,
        honorTeori,
        honorPraktik,
        totalHonor,
        semester: k.semester,
        tahunAkademik: k.tahun_akademik,
      };
    });
  }, [kelasList, sksMap, meetingsPerClass, config, profiles]);

  // Extract unique dosen list for filter
  const uniqueDosenList = useMemo(() => {
    const set = new Set<string>();
    assignmentRows.forEach((r) => {
      if (r.dosen) set.add(r.dosen);
    });
    return Array.from(set).sort();
  }, [assignmentRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return assignmentRows.filter((r) => {
      const matchesSearch =
        r.dosen.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.mataKuliahNama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.mataKuliahKode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.kelasNama.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDosen =
        selectedDosenFilter === "all" || r.dosen === selectedDosenFilter;

      return matchesSearch && matchesDosen;
    });
  }, [assignmentRows, searchTerm, selectedDosenFilter]);

  // Grouped by Dosen summary
  const dosenSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        dosen: string;
        nuptk: string;
        totalKelas: number;
        totalSksTeori: number;
        totalSksPraktik: number;
        totalHadir: number;
        totalHonorTeori: number;
        totalHonorPraktik: number;
        totalHonor: number;
        items: typeof assignmentRows;
      }
    >();

    filteredRows.forEach((r) => {
      if (!map.has(r.dosen)) {
        map.set(r.dosen, {
          dosen: r.dosen,
          nuptk: r.nuptk,
          totalKelas: 0,
          totalSksTeori: 0,
          totalSksPraktik: 0,
          totalHadir: 0,
          totalHonorTeori: 0,
          totalHonorPraktik: 0,
          totalHonor: 0,
          items: [],
        });
      }
      const entry = map.get(r.dosen)!;
      entry.totalKelas += 1;
      entry.totalSksTeori += r.sksTeori;
      entry.totalSksPraktik += r.sksPraktik;
      entry.totalHadir += r.hadir;
      entry.totalHonorTeori += r.honorTeori;
      entry.totalHonorPraktik += r.honorPraktik;
      entry.totalHonor += r.totalHonor;
      entry.items.push(r);
    });

    return Array.from(map.values()).sort((a, b) => b.totalHonor - a.totalHonor);
  }, [filteredRows]);

  // Executive Statistics
  const stats = useMemo(() => {
    const totalHonor = filteredRows.reduce((acc, r) => acc + r.totalHonor, 0);
    const totalHonorTeori = filteredRows.reduce((acc, r) => acc + r.honorTeori, 0);
    const totalHonorPraktik = filteredRows.reduce((acc, r) => acc + r.honorPraktik, 0);
    const totalHadir = filteredRows.reduce((acc, r) => acc + r.hadir, 0);
    const totalDosen = new Set(filteredRows.map((r) => r.dosen)).size;
    const totalKelas = filteredRows.length;
    return {
      totalHonor,
      totalHonorTeori,
      totalHonorPraktik,
      totalHadir,
      totalDosen,
      totalKelas,
    };
  }, [filteredRows]);

  // Export to Excel using SheetJS
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const headers = [
        "No",
        "Nama Dosen",
        "NUPTK",
        "Kode MK",
        "Mata Kuliah",
        "Kelas",
        "SKS Teori (T)",
        "SKS Praktik (P)",
        "Total SKS",
        "Realisasi Hadir (Pertemuan)",
        `Tarif Teori (@ ${formatRupiah(config.tarifTeori)})`,
        `Tarif Praktik (@ ${formatRupiah(config.tarifPraktik)})`,
        "Honor Teori (Rp)",
        "Honor Praktik (Rp)",
        "Total Honor Mengajar (Rp)",
      ];

      const dataRows = filteredRows.map((r, i) => [
        i + 1,
        r.dosen,
        r.nuptk,
        r.mataKuliahKode,
        r.mataKuliahNama,
        r.kelasNama,
        r.sksTeori,
        r.sksPraktik,
        r.totalSks,
        r.hadir,
        config.tarifTeori,
        config.tarifPraktik,
        r.honorTeori,
        r.honorPraktik,
        r.totalHonor,
      ]);

      // Total row
      const totalRow = [
        "",
        "TOTAL KESELURUHAN",
        "",
        "",
        "",
        `${stats.totalKelas} Kelas`,
        "",
        "",
        "",
        `${stats.totalHadir} Pertemuan`,
        "",
        "",
        stats.totalHonorTeori,
        stats.totalHonorPraktik,
        stats.totalHonor,
      ];

      const meta = [
        ["INSTITUT AZ ZUHRA - FAKULTAS VOKASI"],
        ["REKAPITULASI KEHADIRAN & PENGAJUAN HONOR MENGAJAR DOSEN"],
        [`Nomor SK Mengajar: ${config.nomorSk}`],
        [`Semester: ${config.semester} | Tahun Akademik: ${config.tahunAkademik}`],
        [`Aturan Honor: 1 SKS Praktik = ${formatRupiah(config.tarifPraktik)} | 1 SKS Teori = ${formatRupiah(config.tarifTeori)}`],
        [`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`],
        [],
      ];

      const ws = XLSX.utils.aoa_to_sheet([...meta, headers, ...dataRows, totalRow]);
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Honor Dosen");
      XLSX.writeFile(
        wb,
        `Rekap_Honor_Dosen_Vokasi_${config.tahunAkademik.replace("/", "-")}_${config.semester}.xlsx`,
      );
      toast.success("Berkas Excel berhasil diunduh.");
    } catch (err: unknown) {
      toast.error("Gagal mengekspor berkas Excel.");
    }
  };

  // Export to PDF using jsPDF & AutoTable
  const exportPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Official Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("INSTITUT AZ ZUHRA", pageWidth / 2, 12, { align: "center" });

      doc.setFontSize(12);
      doc.text("FAKULTAS VOKASI", pageWidth / 2, 18, { align: "center" });

      doc.setFontSize(10);
      doc.text(
        "REKAPITULASI KEHADIRAN DOSEN & PENETAPAN HONOR MENGAJAR",
        pageWidth / 2,
        24,
        { align: "center" },
      );

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.5);
      doc.line(14, 26, pageWidth - 14, 26);
      doc.setLineWidth(0.2);
      doc.line(14, 27, pageWidth - 14, 27);

      // Meta Information Box
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Nomor SK Mengajar : ${config.nomorSk}`, 14, 33);
      doc.text(`Semester / TA     : ${config.semester} / ${config.tahunAkademik}`, 14, 38);
      doc.text(
        `Ketentuan Honor   : 1 SKS Praktik = ${formatRupiah(config.tarifPraktik)} | 1 SKS Teori = ${formatRupiah(config.tarifTeori)}`,
        14,
        43,
      );

      doc.text(`Tanggal Rekap     : ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`, pageWidth - 80, 33);
      doc.text(`Total Dosen       : ${stats.totalDosen} Orang`, pageWidth - 80, 38);
      doc.text(`Total Realisasi   : ${stats.totalHadir} Pertemuan Tatap Muka`, pageWidth - 80, 43);

      const tableBody = filteredRows.map((r, i) => [
        i + 1,
        `${r.dosen}\nNUPTK: ${r.nuptk}`,
        `${r.mataKuliahNama}\n(${r.mataKuliahKode})`,
        r.kelasNama,
        `${r.sksTeori} T\n${r.sksPraktik} P`,
        `${r.hadir} / 16`,
        formatRupiah(r.honorTeori),
        formatRupiah(r.honorPraktik),
        formatRupiah(r.totalHonor),
        "",
      ]);

      autoTable(doc, {
        startY: 47,
        head: [
          [
            "NO",
            "NAMA DOSEN / NUPTK",
            "MATA KULIAH",
            "KELAS",
            "SKS (T/P)",
            "HADIR",
            "HONOR TEORI",
            "HONOR PRAKTIK",
            "TOTAL HONOR",
            "PARAF",
          ],
        ],
        body: tableBody,
        foot: [
          [
            { content: "TOTAL PENCIRAN GAJI / HONOR", colSpan: 6, styles: { halign: "right", fontStyle: "bold" } },
            { content: formatRupiah(stats.totalHonorTeori), styles: { fontStyle: "bold" } },
            { content: formatRupiah(stats.totalHonorPraktik), styles: { fontStyle: "bold" } },
            { content: formatRupiah(stats.totalHonor), styles: { fontStyle: "bold", textColor: [15, 23, 42] } },
            "",
          ],
        ],
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: "middle",
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 50 },
          2: { cellWidth: 48 },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 18, halign: "center" },
          5: { cellWidth: 18, halign: "center" },
          6: { cellWidth: 28, halign: "right" },
          7: { cellWidth: 28, halign: "right" },
          8: { cellWidth: 32, halign: "right" },
          9: { cellWidth: 18, halign: "center" },
        },
      });

      // Signature Block on final page
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      const sigY = finalY > 165 ? 175 : finalY;
      if (finalY > 165) doc.addPage("a4", "landscape");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      // Left: Vice Dean of Finance
      const leftColX = 35;
      doc.text("Mengetahui & Memverifikasi,", leftColX, sigY, { align: "center" });
      doc.text(config.jabatanKeuangan, leftColX, sigY + 5, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(config.namaWadekKeuangan, leftColX, sigY + 28, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text("NUPTK: 4033750651130163", leftColX, sigY + 33, { align: "center" });

      // Right: Dean of Vocational Faculty
      const rightColX = pageWidth - 45;
      doc.text(
        `${config.kotaTandaTangan}, ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`,
        rightColX,
        sigY,
        { align: "center" },
      );
      doc.text(config.gelarDekan, rightColX, sigY + 5, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(config.namaDekan, rightColX, sigY + 28, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text("NUPTK: 0242774675130243", rightColX, sigY + 33, { align: "center" });

      doc.save(`Rekap_Honor_Dosen_Vokasi_${config.tahunAkademik.replace("/", "-")}.pdf`);
      toast.success("Dokumen PDF Rekap Honor resmi berhasil diunduh.");
    } catch (err: unknown) {
      toast.error("Gagal membuat dokumen PDF.");
    }
  };

  return (
    <AppLayout
      title="Rekap Honor & Kehadiran Dosen"
      description="Rekapitulasi kehadiran dosen Fakultas Vokasi berdasarkan SK Mengajar untuk pencairan gaji."
    >
      <div className="space-y-6">
        {/* Official Banner Header */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary font-semibold">
                  <Building2 className="size-3.5" /> FAKULTAS VOKASI
                </Badge>
                <Badge variant="secondary" className="gap-1 font-mono text-xs">
                  <Award className="size-3.5 text-amber-500" /> {config.nomorSk}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Semester {config.semester} TA {config.tahunAkademik}
                </Badge>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Rekap Kehadiran & Pencairan Honor Dosen
              </h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Penetapan honor mengajar dosen berdasarkan Surat Keputusan Dekan dengan tarif resmi:{" "}
                <span className="font-semibold text-foreground">
                  1 SKS Praktik = {formatRupiah(config.tarifPraktik)}
                </span>{" "}
                dan{" "}
                <span className="font-semibold text-foreground">
                  1 SKS Teori = {formatRupiah(config.tarifTeori)}
                </span>{" "}
                per tatap muka kehadiran.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfigModalOpen(true)}
                className="gap-2 border-border shadow-xs"
              >
                <SlidersHorizontal className="size-4" /> Pengaturan SK & Tarif
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportExcel}
                className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
              >
                <FileSpreadsheet className="size-4 text-emerald-600" /> Ekspor Excel
              </Button>
              <Button
                size="sm"
                onClick={exportPdf}
                className="gap-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
              >
                <Printer className="size-4" /> Cetak Berkas PDF Resmi
              </Button>
            </div>
          </div>
        </div>

        {/* Executive KPI Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Banknote className="size-16 text-primary" />
            </div>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Anggaran Honor Dicairkan
              </p>
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                {formatRupiah(stats.totalHonor)}
              </h3>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center text-primary font-medium">
                  Teori: {formatRupiah(stats.totalHonorTeori)}
                </span>
                <span>•</span>
                <span className="inline-flex items-center text-emerald-600 font-medium">
                  Praktik: {formatRupiah(stats.totalHonorPraktik)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Realisasi Pertemuan
              </p>
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                {stats.totalHadir}{" "}
                <span className="text-sm font-normal text-muted-foreground">Tatap Muka</span>
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Dari {stats.totalKelas} penugasan kelas perkuliahan
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Dosen Aktif Mengajar
              </p>
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground mt-1.5">
                {stats.totalDosen}{" "}
                <span className="text-sm font-normal text-muted-foreground">Dosen Pengampu</span>
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Tercantum dalam SK Mengajar Vokasi
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-xs bg-muted/20">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Standar Honor Fakultas Vokasi
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">1 SKS Praktik (P):</span>
                  <span className="font-bold text-foreground">{formatRupiah(config.tarifPraktik)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">1 SKS Teori (T):</span>
                  <span className="font-bold text-foreground">{formatRupiah(config.tarifTeori)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and View Mode Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl border bg-card shadow-xs">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari Dosen, Mata Kuliah, Kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={selectedDosenFilter} onValueChange={setSelectedDosenFilter}>
              <SelectTrigger className="w-[190px] h-9 text-xs">
                <SelectValue placeholder="Filter Semua Dosen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Dosen ({uniqueDosenList.length})</SelectItem>
                {uniqueDosenList.map((d) => (
                  <SelectItem key={d} value={d} className="text-xs">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as "detailed" | "dosen")}
            className="w-auto"
          >
            <TabsList className="h-9">
              <TabsTrigger value="detailed" className="text-xs gap-1.5">
                <Layers className="size-3.5" /> Per Mata Kuliah / Kelas
              </TabsTrigger>
              <TabsTrigger value="dosen" className="text-xs gap-1.5">
                <Building2 className="size-3.5" /> Rekapitulasi Per Dosen
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content View */}
        {loadingKelas ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Memuat data kehadiran dan SK Mengajar Dosen...
          </div>
        ) : filteredRows.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-12 text-center space-y-2">
              <Info className="size-10 text-muted-foreground mx-auto" />
              <p className="font-semibold text-foreground">Tidak ada data penugasan kelas.</p>
              <p className="text-xs text-muted-foreground">
                Pastikan data kelas dan mata kuliah telah diinput pada menu Data Kelas.
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "detailed" ? (
          /* Mode 1: Detailed per Course / Class */
          <Card className="border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead className="min-w-[190px]">Dosen Pengampu & NUPTK</TableHead>
                    <TableHead className="min-w-[200px]">Mata Kuliah</TableHead>
                    <TableHead className="w-20 text-center">Kelas</TableHead>
                    <TableHead className="w-24 text-center">
                      <div className="flex flex-col items-center">
                        <span>SKS (T / P)</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Teori / Praktik</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-28 text-center">
                      <div className="flex flex-col items-center">
                        <span>Realisasi Hadir</span>
                        <span className="text-[10px] text-muted-foreground font-normal">BAP / Tatap Muka</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-right w-32">Honor Teori</TableHead>
                    <TableHead className="text-right w-32">Honor Praktik</TableHead>
                    <TableHead className="text-right w-36 font-bold">Total Honor</TableHead>
                    <TableHead className="w-24 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, idx) => (
                    <TableRow key={row.kelasId} className="hover:bg-muted/30">
                      <TableCell className="text-center font-medium text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-xs text-foreground">{row.dosen}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          NUPTK: {row.nuptk}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-xs text-foreground">{row.mataKuliahNama}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          Kode: {row.mataKuliahKode} ({row.totalSks} SKS Total)
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {row.kelasNama}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                            {row.sksTeori} T
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            {row.sksPraktik} P
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-xs">
                            {row.hadir} <span className="text-muted-foreground font-normal">/ 16</span>
                          </span>
                          <span
                            className={`text-[10px] ${
                              row.hadir >= 14
                                ? "text-emerald-600 font-medium"
                                : row.hadir >= 8
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {row.hadir >= 16 ? "Selesai 100%" : `${Math.round((row.hadir / 16) * 100)}% Berjalan`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {formatRupiah(row.honorTeori)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-emerald-700 dark:text-emerald-400">
                        {formatRupiah(row.honorPraktik)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold text-foreground">
                        {formatRupiah(row.totalHonor)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Lihat BAP Realisasi Pertemuan"
                            onClick={() =>
                              setBapModalItem({
                                kelasId: row.kelasId,
                                kelasNama: row.kelasNama,
                                mataKuliah: row.mataKuliahNama,
                                dosen: row.dosen,
                              })
                            }
                          >
                            <Eye className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-primary hover:text-primary"
                            title="Sesuaikan Beban SKS & Kehadiran"
                            onClick={() =>
                              setEditRowItem({
                                id: row.kelasId,
                                namaDosen: row.dosen,
                                mataKuliah: row.mataKuliahNama,
                                kelas: row.kelasNama,
                                sksTeori: row.sksTeori,
                                sksPraktik: row.sksPraktik,
                                hadir: row.hadir,
                              })
                            }
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          /* Mode 2: Summary grouped per Dosen */
          <div className="space-y-4">
            {dosenSummary.map((ds, i) => (
              <Card key={ds.dosen} className="border-border shadow-xs overflow-hidden">
                <div className="p-4 bg-muted/30 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        {i + 1}
                      </span>
                      <h4 className="font-bold text-base text-foreground">{ds.dosen}</h4>
                      <Badge variant="outline" className="text-[11px] font-mono">
                        NUPTK: {ds.nuptk}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-8">
                      Total Mengampu {ds.totalKelas} Kelas Perkuliahan • {ds.totalHadir} Pertemuan Tatap Muka
                    </p>
                  </div>

                  <div className="text-right sm:border-l sm:pl-6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Honor Dosen</p>
                    <p className="text-xl font-extrabold text-primary font-mono mt-0.5">
                      {formatRupiah(ds.totalHonor)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Teori: {formatRupiah(ds.totalHonorTeori)} | Praktik: {formatRupiah(ds.totalHonorPraktik)}
                    </p>
                  </div>
                </div>

                <div className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="text-xs">
                        <TableHead className="w-10">No</TableHead>
                        <TableHead>Mata Kuliah</TableHead>
                        <TableHead className="w-24 text-center">Kelas</TableHead>
                        <TableHead className="w-28 text-center">SKS (T / P)</TableHead>
                        <TableHead className="w-28 text-center">Realisasi Hadir</TableHead>
                        <TableHead className="text-right w-32">Honor Teori</TableHead>
                        <TableHead className="text-right w-32">Honor Praktik</TableHead>
                        <TableHead className="text-right w-36 font-semibold">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ds.items.map((it, idx) => (
                        <TableRow key={it.kelasId} className="text-xs hover:bg-muted/20">
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <span className="font-medium text-foreground">{it.mataKuliahNama}</span>
                            <span className="text-muted-foreground ml-2 font-mono">({it.mataKuliahKode})</span>
                          </TableCell>
                          <TableCell className="text-center font-mono">{it.kelasNama}</TableCell>
                          <TableCell className="text-center">
                            {it.sksTeori} T / {it.sksPraktik} P
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {it.hadir} Pertemuan
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatRupiah(it.honorTeori)}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600">
                            {formatRupiah(it.honorPraktik)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatRupiah(it.totalHonor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Modal: Pengaturan SK Mengajar & Tarif Honor */}
        <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-5 text-primary" /> Pengaturan SK Mengajar & Tarif Honor
              </DialogTitle>
              <DialogDescription>
                Sesuaikan nomor SK penugasan mengajar dan besaran tarif honor per SKS kehadiran.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                saveConfig({
                  ...config,
                  nomorSk: String(fd.get("nomorSk") || config.nomorSk),
                  semester: String(fd.get("semester") || config.semester),
                  tahunAkademik: String(fd.get("tahunAkademik") || config.tahunAkademik),
                  tarifPraktik: Number(fd.get("tarifPraktik") || config.tarifPraktik),
                  tarifTeori: Number(fd.get("tarifTeori") || config.tarifTeori),
                  namaDekan: String(fd.get("namaDekan") || config.namaDekan),
                  namaWadekKeuangan: String(fd.get("namaWadekKeuangan") || config.namaWadekKeuangan),
                });
              }}
              className="space-y-4 py-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="nomorSk" className="text-xs font-semibold">
                  Nomor Surat Keputusan (SK) Mengajar Dosen
                </Label>
                <Input
                  id="nomorSk"
                  name="nomorSk"
                  defaultValue={config.nomorSk}
                  className="font-mono text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="semester" className="text-xs font-semibold">
                    Semester
                  </Label>
                  <Input id="semester" name="semester" defaultValue={config.semester} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tahunAkademik" className="text-xs font-semibold">
                    Tahun Akademik
                  </Label>
                  <Input
                    id="tahunAkademik"
                    name="tahunAkademik"
                    defaultValue={config.tahunAkademik}
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Banknote className="size-4 text-emerald-600" /> Tarif Honor Mengajar (Per SKS Tatap Muka)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tarifPraktik" className="text-xs">
                      1 SKS Praktik (Rp)
                    </Label>
                    <Input
                      id="tarifPraktik"
                      name="tarifPraktik"
                      type="number"
                      defaultValue={config.tarifPraktik}
                      className="font-mono text-sm"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">Aturan resmi: Rp. 30.000</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tarifTeori" className="text-xs">
                      1 SKS Teori (Rp)
                    </Label>
                    <Input
                      id="tarifTeori"
                      name="tarifTeori"
                      type="number"
                      defaultValue={config.tarifTeori}
                      className="font-mono text-sm"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">Aturan resmi: Rp. 28.000</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="namaDekan" className="text-xs font-semibold">
                    Nama Dekan Fakultas Vokasi
                  </Label>
                  <Input id="namaDekan" name="namaDekan" defaultValue={config.namaDekan} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="namaWadekKeuangan" className="text-xs font-semibold">
                    Wakil Dekan Bidang Keuangan
                  </Label>
                  <Input
                    id="namaWadekKeuangan"
                    name="namaWadekKeuangan"
                    defaultValue={config.namaWadekKeuangan}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setConfigModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit">Simpan Pengaturan</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit SKS Teori / Praktik & Kehadiran Per Mata Kuliah */}
        {editRowItem && (
          <Dialog open={Boolean(editRowItem)} onOpenChange={() => setEditRowItem(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit3 className="size-5 text-primary" /> Sesuaikan SKS & Kehadiran
                </DialogTitle>
                <DialogDescription>
                  {editRowItem.mataKuliah} ({editRowItem.kelas}) — {editRowItem.namaDosen}
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  saveRowOverride(
                    editRowItem.id,
                    Number(fd.get("sksTeori")),
                    Number(fd.get("sksPraktik")),
                    Number(fd.get("hadir")),
                  );
                }}
                className="space-y-4 py-2"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sksTeori" className="text-xs font-semibold">
                      SKS Teori (T)
                    </Label>
                    <Input
                      id="sksTeori"
                      name="sksTeori"
                      type="number"
                      min={0}
                      max={6}
                      defaultValue={editRowItem.sksTeori}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">@ {formatRupiah(config.tarifTeori)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sksPraktik" className="text-xs font-semibold">
                      SKS Praktik (P)
                    </Label>
                    <Input
                      id="sksPraktik"
                      name="sksPraktik"
                      type="number"
                      min={0}
                      max={6}
                      defaultValue={editRowItem.sksPraktik}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">@ {formatRupiah(config.tarifPraktik)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hadir" className="text-xs font-semibold">
                    Realisasi Kehadiran Dosen (Pertemuan)
                  </Label>
                  <Input
                    id="hadir"
                    name="hadir"
                    type="number"
                    min={0}
                    max={16}
                    defaultValue={editRowItem.hadir}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Standar perkuliahan satu semester penuh: 16 pertemuan.
                  </p>
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditRowItem(null)}>
                    Batal
                  </Button>
                  <Button type="submit">Simpan Perubahan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal: BAP Realisasi Pertemuan Drilldown */}
        {bapModalItem && (
          <Dialog open={Boolean(bapModalItem)} onOpenChange={() => setBapModalItem(null)}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" /> Bukti Realisasi Pertemuan (BAP)
                </DialogTitle>
                <DialogDescription>
                  Kelas {bapModalItem.kelasNama} • {bapModalItem.mataKuliah} • Dosen: {bapModalItem.dosen}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="text-xs">
                        <TableHead className="w-16 text-center">Ptm</TableHead>
                        <TableHead className="w-32">Tanggal</TableHead>
                        <TableHead>Pokok Bahasan / Materi</TableHead>
                        <TableHead className="w-24 text-center">Metode</TableHead>
                        <TableHead className="w-20 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 16 }, (_, i) => i + 1).map((p) => {
                        const bap = bapList.find(
                          (b) => b.kelas_id === bapModalItem.kelasId && b.pertemuan === p,
                        );
                        const hasAbsensi = absensiList.some(
                          (a) => a.kelas_id === bapModalItem.kelasId && a.pertemuan === p,
                        );
                        const isFilled = Boolean(bap?.pokok_bahasan || bap?.tanggal || hasAbsensi);

                        return (
                          <TableRow key={p} className={`text-xs ${isFilled ? "bg-card" : "opacity-40"}`}>
                            <TableCell className="text-center font-bold text-muted-foreground">
                              {p}
                            </TableCell>
                            <TableCell className="font-mono text-[11px]">
                              {bap?.tanggal || (hasAbsensi ? "Terlaksana" : "-")}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {bap?.pokok_bahasan || (hasAbsensi ? "Tatap muka tercatat di absensi" : "Belum diisi")}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground text-[11px]">
                              {bap?.metode || "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              {isFilled ? (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  Hadir
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBapModalItem(null)}>
                  Tutup
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
