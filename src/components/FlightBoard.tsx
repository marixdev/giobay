import { Link } from "@tanstack/react-router";

import type { FlightRow } from "@/lib/flights.functions";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("hủy")) return "text-destructive border-destructive/30";
  if (s.includes("trễ") || s.includes("chậm")) return "text-accent border-accent/30";
  if (s.includes("hạ cánh") || s.includes("đang lên") || s.includes("đang bay"))
    return "bg-foreground text-background border-foreground";
  return "text-muted-foreground border-foreground/15";
}

export function FlightBoard({
  rows,
  direction,
}: {
  rows: FlightRow[];
  direction: "departure" | "arrival";
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-foreground/20 rounded p-12 text-center text-sm text-muted-foreground font-mono">
        Không có dữ liệu chuyến bay.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border-t border-foreground">
        <thead>
          <tr className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="py-4 px-2 font-medium">Chuyến bay</th>
            <th className="py-4 px-2 font-medium">Hãng</th>
            <th className="py-4 px-2 font-medium">{direction === "departure" ? "Điểm đến" : "Điểm đi"}</th>
            <th className="py-4 px-2 font-medium">Giờ</th>
            <th className="py-4 px-2 font-medium">Trạng thái</th>
            <th className="py-4 px-2 font-medium text-right">Cửa</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {rows.map((r, i) => {
            const other = direction === "departure" ? r.arr_iata : r.dep_iata;
            const delayed = (r.delay_minutes ?? 0) > 0;
            return (
              <tr
                key={`${r.flight_iata}-${i}`}
                className="border-b border-border hover:bg-foreground/5 transition-colors animate-row-entry"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <td className="py-4 px-2 font-semibold">
                  <Link to="/flights/$number" params={{ number: r.flight_iata }} className="hover:text-accent">
                    {r.flight_iata}
                  </Link>
                </td>
                <td className="py-4 px-2 text-muted-foreground">{r.airline_name}</td>
                <td className="py-4 px-2">{other || "—"}</td>
                <td className="py-4 px-2">
                  {fmtTime(r.scheduled)}
                  {delayed && (
                    <span className="ml-2 text-xs text-accent italic">/ {fmtTime(r.estimated)}</span>
                  )}
                </td>
                <td className="py-4 px-2">
                  <span className={`text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-full ${statusClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-4 px-2 text-right">{r.gate ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}