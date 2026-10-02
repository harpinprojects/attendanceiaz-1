import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

export const Route = createFileRoute("/_authenticated/kelas")({
  head: () => ({
    meta: [
      { title: "Data Kelas | Sistem Absensi Institut Az Zuhra" },
      {
        name: "description",
        content: "Kelola kelas perkuliahan: nama kelas, mata kuliah, dosen, tahun akademik.",
      },
      { property: "og:title", content: "Data Kelas | Sistem Absensi Institut Az Zuhra" },
      { property: "og:description", content: "Kelola kelas perkuliahan Institut Az Zuhra." },
    ],
  }),
  component: KelasPage,
});

type Form = {
  id?: string;
  nama: string;
  mata_kuliah_id: string;
  dosen: string;
  tahun_akademik: string;
  semester: string;
};
const empty: Form = {
  nama: "",
  mata_kuliah_id: "",
  dosen: "",
  tahun_akademik: "2025/2026",
  semester: "1",
};

function KelasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: mataKuliah = [] } = useQuery({
    queryKey: ["mata_kuliah"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mata_kuliah").select("*").order("kode");
      if (error) throw error;
      return data;
    },
  });

  const { data = [], isLoading } = useQuery({
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

  const save = useMutation({
    mutationFn: async (v: Form) => {
      const payload = {
        nama: v.nama.trim(),
        mata_kuliah_id: v.mata_kuliah_id,
        dosen: v.dosen.trim(),
        tahun_akademik: v.tahun_akademik.trim(),
        semester: Number(v.semester),
      };
      const { error } = v.id
        ? await supabase.from("kelas").update(payload).eq("id", v.id)
        : await supabase.from("kelas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kelas"] });
      setOpen(false);
      toast.success("Data kelas tersimpan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kelas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kelas"] });
      toast.success("Data kelas dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.nama.trim() || !form.mata_kuliah_id || !form.dosen.trim() || !form.tahun_akademik.trim()) {
      toast.error("Semua kolom wajib diisi");
      return;
    }
    save.mutate(form);
  };

  return (
    <AppLayout title="Data Kelas" description="Tambah, ubah, dan hapus kelas perkuliahan.">
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Tambah Kelas
        </Button>
      </div>

      <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Kelas</TableHead>
                <TableHead>Mata Kuliah</TableHead>
                <TableHead>Dosen</TableHead>
                <TableHead>Tahun Akademik</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Belum ada kelas.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.nama}</TableCell>
                    <TableCell>
                      {k.mata_kuliah ? `${k.mata_kuliah.kode} - ${k.mata_kuliah.nama}` : "-"}
                    </TableCell>
                    <TableCell>{k.dosen}</TableCell>
                    <TableCell>{k.tahun_akademik}</TableCell>
                    <TableCell>{k.semester}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm({
                            id: k.id,
                            nama: k.nama,
                            mata_kuliah_id: k.mata_kuliah_id,
                            dosen: k.dosen,
                            tahun_akademik: k.tahun_akademik,
                            semester: String(k.semester),
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Hapus kelas ${k.nama}?`)) remove.mutate(k.id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Ubah Kelas" : "Tambah Kelas"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Kelas</Label>
              <Input
                maxLength={50}
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mata Kuliah</Label>
              <Select
                value={form.mata_kuliah_id}
                onValueChange={(v) => setForm({ ...form, mata_kuliah_id: v })}
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
              <Label>Dosen</Label>
              <Input
                maxLength={100}
                value={form.dosen}
                onChange={(e) => setForm({ ...form, dosen: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tahun Akademik</Label>
                <Input
                  maxLength={20}
                  value={form.tahun_akademik}
                  onChange={(e) => setForm({ ...form, tahun_akademik: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Semester</Label>
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
