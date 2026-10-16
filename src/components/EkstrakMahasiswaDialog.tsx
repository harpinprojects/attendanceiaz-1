import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Loader2,
  X,
  FileCheck,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ekstrakMahasiswa, type MahasiswaEkstrak } from "@/lib/ekstrak-mahasiswa.functions";
import { parseLocalCsvOrText } from "@/lib/csv-parser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReviewRow = {
  id: string;
  npm: string;
  nama: string;
  kelas: string;
  program_studi: string;
  selected: boolean;
};

interface EkstrakMahasiswaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_PRODI_LIST = [
  "Manajemen Informatika",
  "Manajemen",
  "Teknik Informatika",
  "Sistem Informasi",
  "Akuntansi",
];

export function EkstrakMahasiswaDialog({ open, onOpenChange }: EkstrakMahasiswaDialogProps) {
  const qc = useQueryClient();

  // Mode: "input" | "review"
  const [step, setStep] = useState<"input" | "review">("input");
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text state
  const [rawText, setRawText] = useState("");

  // Default values to apply if missing in document
  const [defaultKelas, setDefaultKelas] = useState("");
  const [defaultProdi, setDefaultProdi] = useState("Manajemen Informatika");

  // Processing state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Extracted rows for review
  const [rows, setRows] = useState<ReviewRow[]>([]);

  // Fetch existing classes for suggestions
  const { data: kelasList = [] } = useQuery({
    queryKey: ["kelas"],
    queryFn: async () => {
      const { data } = await supabase.from("kelas").select("nama").order("nama");
      return (data ?? []).map((k) => k.nama);
    },
    enabled: open,
  });

  const resetAll = () => {
    setStep("input");
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRawText("");
    setIsExtracting(false);
    setIsSaving(false);
    setRows([]);
    setExtractStatus("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran berkas maksimal 5 MB.");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran berkas maksimal 5 MB.");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleStartExtraction = async () => {
    if (activeTab === "file" && !selectedFile) {
      toast.error("Pilih atau unggah berkas terlebih dahulu.");
      return;
    }
    if (activeTab === "text" && !rawText.trim()) {
      toast.error("Ketik atau tempel teks daftar mahasiswa terlebih dahulu.");
      return;
    }

    setIsExtracting(true);
    setExtractStatus("Mempersiapkan data berkas...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("Sesi login Dosen tidak ditemukan. Silakan login ulang.");
      }

      let payloadFileName = "input_text.txt";
      let payloadMimeType = "text/plain";
      let payloadText: string | null = null;
      let payloadDataBase64: string | null = null;

      if (activeTab === "text") {
        payloadFileName = "daftar_mahasiswa.txt";
        payloadMimeType = "text/plain";
        payloadText = rawText.trim();
      } else if (selectedFile) {
        payloadFileName = selectedFile.name;
        payloadMimeType = selectedFile.type || "application/octet-stream";

        const ext = selectedFile.name.split(".").pop()?.toLowerCase();
        if (ext === "csv" || ext === "txt") {
          payloadText = await selectedFile.text();
          payloadMimeType = ext === "csv" ? "text/csv" : "text/plain";
        } else {
          setExtractStatus("Mengonversi berkas dokumen...");
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
          payloadDataBase64 = base64Data;
        }
      }

      setExtractStatus("Mengirim ke AI Gateway & menganalisis dokumen...");

      let extractedList: MahasiswaEkstrak[] = [];

      try {
        const response = await ekstrakMahasiswa({
          data: {
            fileName: payloadFileName,
            mimeType: payloadMimeType,
            text: payloadText,
            dataBase64: payloadDataBase64,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        extractedList = response.mahasiswa || [];
      } catch (aiErr: unknown) {
        console.warn("AI extraction encountered an issue:", aiErr);
        // If it was CSV/text and AI Gateway was unavailable or threw an error, attempt local fallback parser
        if (payloadText) {
          const fallback = parseLocalCsvOrText(payloadText, defaultKelas, defaultProdi);
          if (fallback.length > 0) {
            toast.info(
              "AI Gateway tidak aktif atau terkendala, menggunakan ekstraksi lokal CSV/Teks.",
            );
            extractedList = fallback.map((f) => ({
              nama: f.nama,
              npm: f.npm,
              kelas: f.kelas || defaultKelas,
            }));
          } else {
            throw aiErr;
          }
        } else {
          throw aiErr;
        }
      }

      if (extractedList.length === 0) {
        toast.warning(
          "Tidak ada data mahasiswa yang terdeteksi dari berkas tersebut. Coba periksa format atau gunakan teks langsung.",
        );
        return;
      }

      // Prepare review rows
      const formattedRows: ReviewRow[] = extractedList.map((item, idx) => ({
        id: `row-${Date.now()}-${idx}`,
        npm: item.npm,
        nama: item.nama,
        kelas: item.kelas || defaultKelas,
        program_studi: defaultProdi,
        selected: true,
      }));

      setRows(formattedRows);
      setStep("review");
      toast.success(`Berhasil mengekstrak ${formattedRows.length} mahasiswa.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat ekstraksi.";
      toast.error(msg);
    } finally {
      setIsExtracting(false);
      setExtractStatus("");
    }
  };

  // Review row actions
  const toggleSelectAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const updateRowField = (id: string, field: keyof ReviewRow, value: string | boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addNewRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${prev.length}`,
        npm: "",
        nama: "",
        kelas: defaultKelas,
        program_studi: defaultProdi,
        selected: true,
      },
    ]);
  };

  const applyBatchKelas = (newKelas: string) => {
    if (!newKelas) return;
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, kelas: newKelas } : r)),
    );
    toast.info(`Kelas "${newKelas}" diterapkan ke mahasiswa terpilih.`);
  };

  const applyBatchProdi = (newProdi: string) => {
    if (!newProdi) return;
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, program_studi: newProdi } : r)),
    );
    toast.info(`Prodi "${newProdi}" diterapkan ke mahasiswa terpilih.`);
  };

  const handleSaveToDatabase = async () => {
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      toast.error("Pilih setidaknya satu mahasiswa untuk disimpan.");
      return;
    }

    // Validation
    const invalidRows = selectedRows.filter(
      (r) => !r.npm.trim() || !r.nama.trim() || !r.kelas.trim() || !r.program_studi.trim(),
    );
    if (invalidRows.length > 0) {
      toast.error(
        `Ada ${invalidRows.length} baris dengan kolom NPM, Nama, Kelas, atau Program Studi yang masih kosong. Silakan lengkapi atau hapus.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi pengguna telah berakhir.");

      const payload = selectedRows.map((r) => ({
        owner_id: user.id,
        npm: r.npm.trim(),
        nama: r.nama.trim(),
        kelas: r.kelas.trim(),
        program_studi: r.program_studi.trim(),
      }));

      const { error } = await supabase
        .from("mahasiswa")
        .upsert(payload, { onConflict: "owner_id,npm" });

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["mahasiswa"] });
      toast.success(`${selectedRows.length} mahasiswa berhasil disimpan ke sistem!`);
      onOpenChange(false);
      resetAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan data ke database.";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetAll();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {step === "input" ? "Unggah & Ekstrak Data Mahasiswa" : "Tinjau Data Mahasiswa (Hasil AI)"}
              </DialogTitle>
              <DialogDescription>
                {step === "input"
                  ? "Ekstrak otomatis NPM, Nama, dan Kelas dari Teks, CSV, Foto/Gambar, atau PDF dengan AI Gateway."
                  : "Periksa dan sesuaikan data hasil ekstraksi AI sebelum disimpan ke database."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-6 py-2">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "file" | "text")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="gap-2">
                  <Upload className="size-4" /> Unggah Berkas (PDF / Foto / CSV / TXT)
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-2">
                  <FileText className="size-4" /> Tempel Teks Langsung
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4 pt-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    selectedFile
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.csv,.txt,.jpg,.jpeg,.png,.webp,image/*,application/pdf,text/csv,text/plain"
                    onChange={handleFileChange}
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-3">
                      {previewUrl ? (
                        <div className="relative group">
                          <img
                            src={previewUrl}
                            alt="Pratinjau Foto"
                            className="h-32 object-contain rounded-lg border shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setPreviewUrl(null);
                            }}
                            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-md hover:bg-destructive/90"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          {selectedFile.name.endsWith(".pdf") ? (
                            <FileText className="size-8" />
                          ) : selectedFile.name.endsWith(".csv") ? (
                            <FileSpreadsheet className="size-8" />
                          ) : (
                            <FileCheck className="size-8" />
                          )}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(selectedFile.size / 1024).toFixed(1)} KB • Klik untuk mengganti berkas
                        </p>
                      </div>
                      <Badge variant="secondary" className="mt-1">
                        Berkas siap diekstrak
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <Upload className="size-6" />
                      </div>
                      <p className="text-sm font-medium">
                        Klik untuk memilih berkas atau seret berkas ke sini
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mendukung dokumen PDF, Foto scan/absen (JPG, PNG), file CSV, dan TXT (Maks. 5 MB)
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileText className="size-3" /> PDF
                        </Badge>
                        <Badge variant="outline" className="text-xs gap-1">
                          <ImageIcon className="size-3" /> Foto / Scan
                        </Badge>
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileSpreadsheet className="size-3" /> CSV / Excel
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="raw-text" className="text-sm font-medium">
                    Salin & Tempel Daftar Mahasiswa
                  </Label>
                  <Textarea
                    id="raw-text"
                    placeholder={`Contoh teks:\n1. 2355201001 - Budi Santoso - 26E3\n2. 2355201002 - Siti Aminah - 26E3\natau salin langsung dari tabel Excel/WhatsApp...`}
                    rows={7}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="font-mono text-sm resize-y"
                  />
                  <p className="text-xs text-muted-foreground">
                    Model AI Gateway akan otomatis mengenali pola nomor induk (NPM/NIM), nama mahasiswa, dan kelas.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Default Kelas & Prodi Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border bg-muted/30">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kelas Default (Opsional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Contoh: 26E3"
                    value={defaultKelas}
                    onChange={(e) => setDefaultKelas(e.target.value)}
                  />
                  {kelasList.length > 0 && (
                    <Select value={defaultKelas} onValueChange={setDefaultKelas}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                      <SelectContent>
                        {kelasList.map((k) => (
                          <SelectItem key={k} value={k}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Diterapkan jika berkas tidak mencantumkan kelas mahasiswa.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Program Studi Default
                </Label>
                <Select value={defaultProdi} onValueChange={setDefaultProdi}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih program studi" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_PRODI_LIST.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Program studi wajib diisi untuk setiap mahasiswa di sistem.
                </p>
              </div>
            </div>

            {isExtracting && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary animate-pulse">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm font-medium">{extractStatus}</span>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Structured Review Table */
          <div className="space-y-4 py-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Ditemukan {rows.length} mahasiswa ({selectedCount} terpilih)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Periksa kembali data sebelum disimpan. Anda dapat mengedit nama, NPM, kelas, atau prodi secara langsung.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNewRow}
                  className="gap-1.5 text-xs h-8"
                >
                  <Plus className="size-3.5" /> Tambah Baris
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("input")}
                  className="gap-1.5 text-xs h-8"
                >
                  <RotateCcw className="size-3.5" /> Ganti Dokumen
                </Button>
              </div>
            </div>

            {/* Quick Batch Apply Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/20 text-xs">
              <span className="font-medium text-muted-foreground">Terapkan Massal ke Terpilih:</span>
              <div className="flex items-center gap-1.5">
                <Input
                  id="batch-kelas-input"
                  placeholder="Nama Kelas..."
                  defaultValue={defaultKelas}
                  className="h-7 w-28 text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const el = document.getElementById("batch-kelas-input") as HTMLInputElement;
                    if (el?.value) applyBatchKelas(el.value);
                  }}
                >
                  Set Kelas
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Select onValueChange={applyBatchProdi}>
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue placeholder="Pilih Prodi Massal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_PRODI_LIST.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Editable Review Table */}
            <div className="border rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={rows.length > 0 && rows.every((r) => r.selected)}
                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead className="w-40">NPM / NIM</TableHead>
                    <TableHead>Nama Mahasiswa</TableHead>
                    <TableHead className="w-32">Kelas</TableHead>
                    <TableHead className="w-48">Program Studi</TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                        Tidak ada baris data. Klik "Tambah Baris" untuk menambahkan manual.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id} className={!row.selected ? "opacity-40" : ""}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={(c) => updateRowField(row.id, "selected", !!c)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.npm}
                            onChange={(e) => updateRowField(row.id, "npm", e.target.value)}
                            placeholder="NPM"
                            className={`h-8 font-mono text-xs ${
                              !row.npm.trim() ? "border-destructive focus-visible:ring-destructive" : ""
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.nama}
                            onChange={(e) => updateRowField(row.id, "nama", e.target.value)}
                            placeholder="Nama Lengkap"
                            className={`h-8 text-xs ${
                              !row.nama.trim() ? "border-destructive focus-visible:ring-destructive" : ""
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.kelas}
                            onChange={(e) => updateRowField(row.id, "kelas", e.target.value)}
                            placeholder="Kelas"
                            className={`h-8 text-xs ${
                              !row.kelas.trim() ? "border-destructive focus-visible:ring-destructive" : ""
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.program_studi}
                            onChange={(e) => updateRowField(row.id, "program_studi", e.target.value)}
                            placeholder="Program Studi"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteRow(row.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          {step === "input" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button
                onClick={handleStartExtraction}
                disabled={isExtracting}
                className="gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-md"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sedang Mengekstrak...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Ekstrak dengan AI Gateway
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("input")}
                disabled={isSaving}
              >
                Kembali
              </Button>
              <Button
                onClick={handleSaveToDatabase}
                disabled={isSaving || selectedCount === 0}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan ke Database...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Simpan {selectedCount} Mahasiswa
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
