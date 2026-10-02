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

export const Route = createFileRoute("/_authenticated/mahasiswa")({
  head: () => ({
    meta: [
      { title: "Data Mahasiswa | Sistem Absensi Institut Az Zuhra" },
      { name: "description", content: "Kelola data mahasiswa: NPM, nama, program studi, dan kelas." },
      { property: "og:title", content: "Data Mahasiswa | Sistem Absensi Institut Az Zuhra" },
      { property: "og:description", content: "Kelola data mahasiswa Institut Az Zuhra." },
    ],
  }),
  component: MahasiswaPage,
});

type Form = { id?: string; npm: string; nama: string; program_studi: string; kelas: string };
const empty: Form = { npm: "", nama: "", program_studi: "", kelas: "" };

function MahasiswaPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["mahasiswa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mahasiswa").select("*").order("npm");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (v: Form) => {
      const payload = {
        npm: v.npm.trim(),
        nama: v.nama.trim(),
        program_studi: v.program_studi.trim(),
        kelas: v.kelas.trim(),
      };
      const { error } = v.id
        ? await supabase.from("mahasiswa").update(payload).eq("id", v.id)
        : await supabase.from("mahasiswa").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mahasiswa"] });
      setOpen(false);
      toast.success("Data mahasiswa tersimpan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mahasiswa").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mahasiswa"] });
      toast.success("Data mahasiswa dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.npm.trim() || !form.nama.trim() || !form.program_studi.trim() || !form.kelas.trim()) {
      toast.error("Semua kolom wajib diisi");
      return;
    }
    save.mutate(form);
  };

  return (
    <AppLayout title="Data Mahasiswa" description="Tambah, ubah, dan hapus data mahasiswa.">
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Tambah Mahasiswa
        </Button>
      </div>

      <Card className="border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NPM</TableHead>
                <TableHead>Nama Mahasiswa</TableHead>
                <TableHead>Program Studi</TableHead>
                <TableHead>Kelas</TableHead>
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
                    Belum ada data mahasiswa.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.npm}</TableCell>
                    <TableCell>{m.nama}</TableCell>
                    <TableCell>{m.program_studi}</TableCell>
                    <TableCell>{m.kelas}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setForm({
                            id: m.id,
                            npm: m.npm,
                            nama: m.nama,
                            program_studi: m.program_studi,
                            kelas: m.kelas,
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
                          if (confirm(`Hapus mahasiswa ${m.nama}?`)) remove.mutate(m.id);
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
            <DialogTitle>{form.id ? "Ubah Mahasiswa" : "Tambah Mahasiswa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>NPM</Label>
              <Input
                maxLength={20}
                value={form.npm}
                onChange={(e) => setForm({ ...form, npm: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Mahasiswa</Label>
              <Input
                maxLength={100}
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Program Studi</Label>
              <Input
                maxLength={100}
                value={form.program_studi}
                onChange={(e) => setForm({ ...form, program_studi: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Input
                maxLength={50}
                value={form.kelas}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
              />
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
