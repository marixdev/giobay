import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { searchFlight, getLiveAircraft } from "@/lib/flights.functions";
import type { LiveAircraft } from "@/lib/flights.functions";

const flightQO = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchFlight({ data: { query: q } }),
    staleTime: 60_000,
  });

const liveQO = queryOptions({
  queryKey: ["live"],
  queryFn: () => getLiveAircraft(),
  staleTime: 30_000,
  refetchInterval: 30_000,
});

export const Route = createFileRoute("/flights/$number")({
  head: ({ params }) => ({
    meta: [
      { title: `Chuyến bay ${params.number} — Bay Live` },
      { name: "description", content: `Thông tin chi tiết chuyến bay ${params.number}: lộ trình, giờ bay, trạng thái.` },
    ],
  }),
  loader: async ({ params, context }) => {
    await context.queryClient.ensureQueryData(flightQO(params.number.toUpperCase()));
    await context.queryClient.ensureQueryData(liveQO);
  },
  component: FlightPage,
});

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
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
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        Chuyến bay · {f.airline_name}
      </p>
      <h1 className="font-display italic text-4xl md:text-7xl mt-2 break-words">{f.flight_iata}</h1>

      <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-center border-y border-foreground py-8 md:py-10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Khởi hành</p>
          <p className="font-display italic text-4xl md:text-5xl mt-1">{f.dep_iata || "—"}</p>
          <p className="font-mono text-sm mt-2">{fmt(f.scheduled)}</p>
        </div>
        <div className="text-center text-accent font-mono text-xs uppercase tracking-[0.3em]">───── ✈ ─────</div>
        <div className="md:text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Điểm đến</p>
          <p className="font-display italic text-4xl md:text-5xl mt-1">{f.arr_iata || "—"}</p>
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

      <FlightLiveMap flightNumber={f.flight_iata} />
    </div>
  );
}

function FlightLiveMap({ flightNumber }: { flightNumber: string }) {
  const { data: live } = useSuspenseQuery(liveQO);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const normalized = flightNumber.replace(/\s+/g, "").toUpperCase();
  const ac = live.aircraft.find(
    (a) => a.callsign?.replace(/\s+/g, "").toUpperCase() === normalized
  );

  if (!ac) return null;

  return (
    <div className="mt-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
        Vị trí trực tiếp
      </p>
      <div className="border border-foreground/20 rounded overflow-hidden" style={{ height: "50vh", minHeight: 280 }}>
        {mounted ? <FlightMapLeaflet aircraft={ac} /> : (
          <div className="w-full h-full grid place-items-center font-mono text-xs text-muted-foreground">
            Đang khởi tạo bản đồ…
          </div>
        )}
      </div>
    </div>
  );
}

function FlightMapLeaflet({ aircraft }: { aircraft: LiveAircraft }) {
  const [mods, setMods] = useState<null | { L: typeof import("leaflet"); RL: typeof import("react-leaflet") }>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
      import("leaflet/dist/leaflet.css" as string),
    ]).then(([L, RL]) => {
      if (!cancelled) setMods({ L, RL });
    });
    return () => { cancelled = true; };
  }, []);

  if (!mods) {
    return (
      <div className="w-full h-full grid place-items-center font-mono text-xs text-muted-foreground">
        Đang tải bản đồ…
      </div>
    );
  }

  const { L, RL } = mods;

  const planeIcon = (heading: number) =>
    L.divIcon({
      className: "plane-marker",
      html: `<div style="transform: rotate(${heading}deg); font-size: 18px; line-height: 1;">✈</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

  return (
    <RL.MapContainer
      center={[aircraft.lat, aircraft.lon]}
      zoom={8}
      style={{ height: "100%", width: "100%" }}
      attributionControl={false}
    >
      <RL.TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RL.Marker position={[aircraft.lat, aircraft.lon]} icon={planeIcon(aircraft.heading ?? 0)}>
        <RL.Popup>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>
            <strong>{aircraft.callsign ?? aircraft.icao24}</strong>
            <br />Alt: {aircraft.alt_m ? Math.round(aircraft.alt_m) + " m" : "—"}
            <br />Hướng: {aircraft.heading != null ? Math.round(aircraft.heading) + "°" : "—"}
          </div>
        </RL.Popup>
      </RL.Marker>
    </RL.MapContainer>
  );
}
