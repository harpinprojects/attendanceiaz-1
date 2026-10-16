import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import { z } from "zod";

const MODEL = "openai/gpt-6-astra";
const BASE_URL = "https://ai.gateway.lovable.dev/v1";

const outputSchema = z.object({
  mahasiswa: z.array(
    z.object({
      nama: z.string(),
      npm: z.string(),
      kelas: z.string(),
    }),
  ),
});

const INSTRUCTIONS = `Anda mengekstrak daftar mahasiswa dari dokumen (daftar hadir, tabel, foto, atau teks).
Untuk setiap mahasiswa ambil: nama lengkap (huruf sesuai dokumen, rapikan spasi), NPM/NIM (hanya kode, tanpa label), dan kelas.
Jika kelas hanya disebut sekali di judul/header dokumen, pakai kelas itu untuk semua mahasiswa. Jika tidak ada, isi string kosong.
Jangan mengarang data. Lewati baris kosong, judul, tanda tangan, atau baris yang bukan mahasiswa.`;

type Input = { fileName: string; mimeType: string; text: string | null; dataBase64: string | null };

export async function runExtraction(input: Input) {
  const isLovable = Boolean(process.env["LOVABLE_API_KEY"]);
  const apiKey =
    process.env["LOVABLE_API_KEY"] ||
    process.env["AI_GATEWAY_API_KEY"] ||
    process.env["OPENAI_API_KEY"];

  if (!apiKey) {
    throw new Error(
      "Layanan AI belum dikonfigurasi. Pastikan LOVABLE_API_KEY atau OPENAI_API_KEY telah diatur pada environment.",
    );
  }

  const BASE_URL =
    process.env["AI_GATEWAY_BASE_URL"] ||
    (isLovable ? "https://ai.gateway.lovable.dev/v1" : undefined);
  const MODEL =
    process.env["AI_MODEL"] || (isLovable ? "openai/gpt-6-astra" : "gpt-4o-mini");

  const content: Exclude<ModelMessage["content"], string> = [
    { type: "text", text: `Nama file: ${input.fileName}` },
  ] as never;
  if (input.text) {
    (content as unknown[]).push({ type: "text", text: input.text });
  } else if (input.dataBase64) {
    const rawBase64 = input.dataBase64.replace(/^data:[^;]+;base64,/, "");
    (content as unknown[]).push(
      input.mimeType.startsWith("image/")
        ? { type: "image", image: rawBase64, mediaType: input.mimeType }
        : { type: "file", data: rawBase64, mediaType: input.mimeType, filename: input.fileName },
    );
  } else {
    throw new Error("File kosong.");
  }

  let runId: string | undefined;
  const defaultHeaders: Record<string, string> = { "X-Lovable-AIG-SDK": "vercel-ai-sdk" };
  if (isLovable) {
    defaultHeaders["Lovable-API-Key"] = apiKey;
  }

  const provider = createOpenAI({
    ...(BASE_URL ? { baseURL: BASE_URL } : {}),
    apiKey,
    headers: defaultHeaders,
    fetch: async (url, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(url, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!res.ok) {
        const body = await res.clone().text().catch(() => "");
        if (res.status === 402) throw new Error("Kredit AI habis. Tambahkan kredit di pengaturan workspace.");
        if (res.status === 429) throw new Error("Terlalu banyak permintaan. Coba lagi sebentar lagi.");
        if (res.status === 403) throw new Error("Akses AI ditolak untuk workspace ini.");
        console.error("AI gateway error", res.status, body.slice(0, 500));
      }
      return res;
    },
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages: [{ role: "user", content } as ModelMessage],
    output: Output.object({ schema: outputSchema }),
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    const out = await result.output;
    const rows = out.mahasiswa
      .map((m) => ({ nama: m.nama.trim(), npm: m.npm.replace(/\s+/g, ""), kelas: m.kelas.trim() }))
      .filter((m) => m.nama || m.npm);
    return { mahasiswa: rows };
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) {
      throw new Error("AI tidak dapat membaca daftar mahasiswa dari file ini.");
    }
    throw e instanceof Error ? e : new Error("Gagal mengekstrak data.");
  }
}
