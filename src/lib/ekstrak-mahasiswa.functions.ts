import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  fileName: z.string().max(255),
  mimeType: z.string().max(100),
  text: z.string().max(400_000).nullable(),
  dataBase64: z.string().max(7_000_000).nullable(),
});

export type MahasiswaEkstrak = { nama: string; npm: string; kelas: string };

export const ekstrakMahasiswa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { runExtraction } = await import("./ekstrak-mahasiswa.server");
    return runExtraction(data);
  });
