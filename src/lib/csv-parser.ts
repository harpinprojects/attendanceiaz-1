export type ParsedMahasiswa = {
  npm: string;
  nama: string;
  kelas: string;
  program_studi?: string;
};

/**
 * Fallback parser for text/CSV/TSV files when AI Gateway is offline or when quick local parsing is preferred.
 */
export function parseLocalCsvOrText(rawText: string, defaultKelas = "", defaultProdi = ""): ParsedMahasiswa[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const firstLine = lines[0] ?? "";
  if (!firstLine) return [];

  const results: ParsedMahasiswa[] = [];

  // Detect delimiter: comma, semicolon, tab, pipe
  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";")) delimiter = ";";
  else if (firstLine.includes("|")) delimiter = "|";

  // Check if first line is a header
  const headerTokens = firstLine.split(delimiter).map((h) => h.trim().toLowerCase());
  const hasNpmHeader = headerTokens.some((h) => h.includes("npm") || h.includes("nim") || h.includes("no. induk"));
  const hasNamaHeader = headerTokens.some((h) => h.includes("nama") || h.includes("name") || h.includes("mahasiswa"));

  const isTabular = hasNpmHeader || hasNamaHeader || firstLine.split(delimiter).length >= 2;
  const startIndex = hasNpmHeader || hasNamaHeader ? 1 : 0;

  let npmIdx = -1;
  let namaIdx = -1;
  let kelasIdx = -1;
  let prodiIdx = -1;

  if (hasNpmHeader || hasNamaHeader) {
    headerTokens.forEach((col, idx) => {
      if (col.includes("npm") || col.includes("nim")) npmIdx = idx;
      else if (col.includes("nama") || col.includes("mahasiswa")) namaIdx = idx;
      else if (col.includes("kelas") || col.includes("kls")) kelasIdx = idx;
      else if (col.includes("prodi") || col.includes("jurusan") || col.includes("program studi")) prodiIdx = idx;
    });
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line) continue;

    const parts = line.split(delimiter).map((p) => p.replace(/^["']|["']$/g, "").trim());

    if (isTabular && parts.length >= 2) {
      let npm = "";
      let nama = "";
      let kelas = defaultKelas;
      let prodi = defaultProdi;

      if (npmIdx >= 0 && parts[npmIdx]) npm = parts[npmIdx] ?? "";
      if (namaIdx >= 0 && parts[namaIdx]) nama = parts[namaIdx] ?? "";
      if (kelasIdx >= 0 && parts[kelasIdx]) kelas = parts[kelasIdx] ?? "";
      if (prodiIdx >= 0 && parts[prodiIdx]) prodi = parts[prodiIdx] ?? "";

      // If headers weren't found, deduce columns by pattern
      if (!npm && !nama) {
        const digitsIdx = parts.findIndex((p) => /^\d{6,15}$/.test(p.replace(/\s+/g, "")));
        if (digitsIdx >= 0) {
          npm = (parts[digitsIdx] ?? "").replace(/\s+/g, "");
          const textParts = parts.filter((_, idx) => idx !== digitsIdx && idx !== 0);
          nama = textParts[0] ?? "";
          if (textParts[1]) kelas = textParts[1];
        } else {
          npm = parts[0] ?? "";
          nama = parts[1] ?? "";
          if (parts[2]) kelas = parts[2];
        }
      }

      if (npm || nama) {
        results.push({
          npm: npm.replace(/[^\w-]/g, ""),
          nama: nama.trim(),
          kelas: kelas.trim(),
          program_studi: prodi.trim(),
        });
      }
    } else {
      // Freeform line: e.g. "20241001 - John Doe - 26E3" or "20241001 John Doe"
      const match = line.match(/^(\d{6,15})\s*[-–—:|,\t]?\s*([A-Za-z\s.,'\-()]+?)(?:\s*[-–—:|,\t]\s*([A-Za-z0-9]+))?$/);
      if (match && match[1] && match[2]) {
        results.push({
          npm: match[1].trim(),
          nama: match[2].trim(),
          kelas: (match[3] || defaultKelas).trim(),
          program_studi: defaultProdi.trim(),
        });
      }
    }
  }

  return results;
}
