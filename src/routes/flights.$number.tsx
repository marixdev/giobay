import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { searchFlight } from "@/lib/flights.functions";

const flightQO = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchFlight({ data: { query: q } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/flights/$number")({
  head: ({ params }) => ({
    meta: [
      { title: `Chuyến bay ${params.number} — Bay Live` },
      { name: "description", content: `Thông tin chi tiết chuyến bay ${params.number}: lộ trình, giờ bay, trạng thái.` },
    ],
  }),
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(flightQO(params.number.toUpperCase())),
  component: FlightPage,
});

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function FlightPage() {
  const { number } = Route.useParams();
  const { data } = useSuspenseQuery(flightQO(number.toUpperCase()));
  const f = data.rows[0];
  if (!f) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Không tìm thấy</p>
        <h1 className="font-display italic text-4xl">Không có chuyến bay {number}</h1>
        <Link to="/" className="inline-block mt-6 underline">Về trang chủ</Link>
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        Chuyến bay · {f.airline_name}
      </p>
      <h1 className="font-display italic text-5xl md:text-7xl mt-2">{f.flight_iata}</h1>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-y border-foreground py-10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Khởi hành</p>
          <p className="font-display italic text-5xl mt-1">{f.dep_iata || "—"}</p>
          <p className="font-mono text-sm mt-2">{fmt(f.scheduled)}</p>
        </div>
        <div className="text-center text-accent font-mono text-xs uppercase tracking-[0.3em]">───── ✈ ─────</div>
        <div className="md:text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Điểm đến</p>
          <p className="font-display italic text-5xl mt-1">{f.arr_iata || "—"}</p>
          <p className="font-mono text-sm mt-2">{fmt(f.estimated ?? f.scheduled)}</p>
        </div>
      </div>

      <dl className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Trạng thái</dt>
          <dd className="mt-1">{f.status}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Cửa</dt>
          <dd className="mt-1">{f.gate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Nhà ga</dt>
          <dd className="mt-1">{f.terminal ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Trễ</dt>
          <dd className="mt-1">{f.delay_minutes ? `${f.delay_minutes} phút` : "—"}</dd>
        </div>
      </dl>

      <p className="mt-12 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Nguồn: {data.source === "live" ? "AviationStack" : "Dữ liệu mẫu"}
      </p>
    </div>
  );
}