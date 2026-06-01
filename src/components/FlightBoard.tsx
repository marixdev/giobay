import { Link } from "@tanstack/react-router";

import type { FlightRow } from "@/lib/flights.functions";

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
    <>
    {/* Mobile: card list */}
    <ul className="md:hidden divide-y divide-border border-t border-foreground">
      {rows.map((r, i) => {
        const other = direction === "departure" ? r.arr_iata : r.dep_iata;
        const delayed = (r.delay_minutes ?? 0) > 0;
        const depTime = fmtTime(r.dep_estimated ?? r.dep_scheduled ?? r.scheduled);
        const arrTime = fmtTime(r.arr_estimated ?? r.arr_scheduled);
        return (
          <li
            key={`m-${r.flight_iata}-${i}`}
            className="py-3 px-1 animate-row-entry"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <Link
                to="/flights/$number"
                params={{ number: r.flight_iata }}
                className="font-mono text-base font-semibold hover:text-accent"
              >
                {r.flight_iata}
              </Link>
              <span className={`text-[9px] uppercase tracking-wider border px-2 py-0.5 rounded-full ${statusClass(r.status)}`}>
                {r.status}
              </span>
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground truncate">
              {r.airline_name}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2 font-mono text-sm">
              <span className="flex items-baseline gap-1.5">
                <span className={delayed ? "text-accent italic" : ""}>{depTime}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold">{other || "—"}</span>
                <span className={delayed ? "text-accent italic" : ""}>{arrTime}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.type === "domestic" ? "Nội địa" : "Quốc tế"}
              </span>
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Nhà ga: {r.terminal ?? "—"}</span>
              <span>Cửa: {r.gate ?? "—"}</span>
            </div>
          </li>
        );
      })}
    </ul>

    {/* Desktop: table */}
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full border-collapse border-t border-foreground">
        <thead>
          <tr className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="py-4 px-2 font-medium">Chuyến bay</th>
            <th className="py-4 px-2 font-medium">Hãng</th>
            <th className="py-4 px-2 font-medium">{direction === "departure" ? "Điểm đến" : "Điểm đi"}</th>
            <th className="py-4 px-2 font-medium">Giờ đi</th>
            <th className="py-4 px-2 font-medium">Giờ đến</th>
            <th className="py-4 px-2 font-medium">Trạng thái</th>
            <th className="py-4 px-2 font-medium">Loại</th>
            <th className="py-4 px-2 font-medium">Nhà ga</th>
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
                <TimeCell scheduled={r.dep_scheduled ?? r.scheduled} estimated={r.dep_estimated ?? r.estimated} delayed={delayed} />
                <TimeCell scheduled={r.arr_scheduled} estimated={r.arr_estimated} delayed={delayed} />
                <td className="py-4 px-2">
                  <span className={`text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-full ${statusClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-4 px-2 text-muted-foreground">
                  {r.type === "domestic" ? "Nội địa" : "Quốc tế"}
                </td>
                <td className="py-4 px-2 text-muted-foreground">{r.terminal ?? "—"}</td>
                <td className="py-4 px-2 text-right">{r.gate ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function TimeCell({
  scheduled,
  estimated,
  delayed,
}: {
  scheduled: string | null;
  estimated: string | null;
  delayed: boolean;
}) {
  const showEstimated = delayed && estimated && estimated !== scheduled;
  return (
    <td className="py-4 px-2 whitespace-nowrap">
      <div className="flex flex-col gap-0.5 leading-tight">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Lịch</span>
          <span>{fmtTime(scheduled)}</span>
        </span>
        {showEstimated && (
          <span className="flex items-baseline gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-accent">Dự kiến</span>
            <span className="text-accent italic">{fmtTime(estimated)}</span>
          </span>
        )}
      </div>
    </td>
  );
}