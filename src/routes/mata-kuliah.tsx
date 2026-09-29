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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/mata-kuliah")({
  head: () => ({
    meta: [
      { title: "Data Mata Kuliah | Sistem Absensi Institut Az Zuhra" },
      { name: "description", content: "Kelola mata kuliah: kode, nama, SKS, dan semester." },
      { property: "og:title", content: "Data Mata Kuliah | Sistem Absensi Institut Az Zuhra" },
      { property: "og:description", content: "Kelola mata kuliah Institut Az Zuhra." },
    ],
  }),
  component: MataKuliahPage,
});

type Form = { id?: string; kode: string; nama: string; sks: string; semester: string };
const empty: Form = { kode: "", nama: "", sks: "2", semester: "1" };

function MataKuliahPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["mata_kuliah"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mata_kuliah").select("*").order("kode");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (v: Form) => {
      const payload = {
        kode: v.kode.trim(),
        nama: v.nama.trim(),
        sks: Number(v.sks),
        semester: Number(v.semester),
      };
      const { error } = v.id
        ? await supabase.from("mata_kuliah").update(payload).eq("id", v.id)
        : await supabase.from("mata_kuliah").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mata_kuliah"] });
      setOpen(false);
      toast.success("Data mata kuliah tersimpan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mata_kuliah").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mata_kuliah"] });
      toast.success("Data mata kuliah dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.kode.trim() || !form.nama.trim()) {
      toast.error("Kode dan nama mata kuliah wajib diisi");
      return;
    }
    const sks = Number(form.sks);
    const smt = Number(form.semester);
    if (!Number.isInteger(sks) || sks < 1 || sks > 6) return toast.error("SKS harus 1 - 6");
    if (!Number.isInteger(smt) || smt < 1 || smt > 14)
      return toast.error("Semester harus 1 - 14");
    save.mutate(form);
  };

  return (
    <AppLayout title="Data Mata Kuliah" description="Tambah, ubah, dan hapus mata kuliah.">
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Tambah Mata Kuliah
        </Button>
      </div>

      <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Mata Kuliah</TableHead>
                <TableHead>SKS</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Belum ada mata kuliah.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.kode}</TableCell>
                    <TableCell>{m.nama}</TableCell>
                    <TableCell>{m.sks}</TableCell>
                    <TableCell>{m.semester}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm({
                            id: m.id,
                            kode: m.kode,
                            nama: m.nama,
                            sks: String(m.sks),
                            semester: String(m.semester),
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
                          if (confirm(`Hapus mata kuliah ${m.nama}?`)) remove.mutate(m.id);
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
            <DialogTitle>{form.id ? "Ubah Mata Kuliah" : "Tambah Mata Kuliah"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kode</Label>
              <Input
                maxLength={20}
                value={form.kode}
                onChange={(e) => setForm({ ...form, kode: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Mata Kuliah</Label>
              <Input
                maxLength={120}
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKS</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={form.sks}
                  onChange={(e) => setForm({ ...form, sks: e.target.value })}
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
