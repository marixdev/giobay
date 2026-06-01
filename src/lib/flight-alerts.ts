import { toast } from "sonner";

import type { FlightRow } from "@/lib/flights.functions";

export type FlightSnapshot = {
  gate: string | null;
  status: string;
  dep_estimated: string | null;
  arr_estimated: string | null;
};

function snap(r: FlightRow): FlightSnapshot {
  return {
    gate: r.gate ?? null,
    status: r.status,
    dep_estimated: r.dep_estimated ?? null,
    arr_estimated: r.arr_estimated ?? null,
  };
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

/**
 * Compare new rows against a previous snapshot map and emit toast notifications
 * for any gate / status / estimated-time changes. Mutates `prev` in place so the
 * caller can keep a stable ref across renders.
 * Returns the number of alerts fired.
 */
export function diffAndNotify(
  rows: FlightRow[],
  prev: Map<string, FlightSnapshot>,
  opts: { silent?: boolean } = {},
): number {
  let fired = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const key = r.flight_iata;
    if (!key) continue;
    seen.add(key);
    const next = snap(r);
    const before = prev.get(key);
    prev.set(key, next);
    if (!before || opts.silent) continue;

    const changes: string[] = [];
    if (before.gate !== next.gate) {
      changes.push(`Cửa: ${before.gate ?? "—"} → ${next.gate ?? "—"}`);
    }
    if (before.status !== next.status) {
      changes.push(`Trạng thái: ${before.status} → ${next.status}`);
    }
    if (before.dep_estimated !== next.dep_estimated) {
      changes.push(`Giờ đi (dự kiến): ${fmtTime(before.dep_estimated)} → ${fmtTime(next.dep_estimated)}`);
    }
    if (before.arr_estimated !== next.arr_estimated) {
      changes.push(`Giờ đến (dự kiến): ${fmtTime(before.arr_estimated)} → ${fmtTime(next.arr_estimated)}`);
    }
    if (changes.length === 0) continue;

    fired++;
    const isCancel = next.status.toLowerCase().includes("hủy");
    const fn = isCancel ? toast.error : toast.info;
    fn(`${r.flight_iata} · ${r.airline_name}`, {
      description: changes.join(" · "),
      duration: 8000,
    });
  }
  // Drop entries for flights no longer in the list so the map doesn't grow forever.
  for (const k of Array.from(prev.keys())) {
    if (!seen.has(k)) prev.delete(k);
  }
  return fired;
}