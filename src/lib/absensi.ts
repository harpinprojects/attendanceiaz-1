export const STATUS_LIST = ["Hadir", "Izin", "Sakit", "Alpa"] as const;
export type Status = (typeof STATUS_LIST)[number];

export const PERTEMUAN_LIST = Array.from({ length: 16 }, (_, i) => i + 1);

export const statusClass: Record<Status, string> = {
  Hadir: "bg-success/12 text-success border-success/30",
  Izin: "bg-info/12 text-info border-info/30",
  Sakit: "bg-warning/15 text-warning border-warning/30",
  Alpa: "bg-destructive/10 text-destructive border-destructive/30",
};
