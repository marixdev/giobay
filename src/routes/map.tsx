import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { getLiveAircraft } from "@/lib/flights.functions";

const liveQO = queryOptions({
  queryKey: ["live"],
  queryFn: () => getLiveAircraft(),
  staleTime: 30_000,
  refetchInterval: 30_000,
});

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Bản đồ máy bay realtime — Bay Live" },
      { name: "description", content: "Vị trí máy bay đang bay trong vùng FIR Việt Nam, cập nhật theo thời gian thực." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(liveQO),
  component: MapPage,
});

function MapPage() {
  const { data } = useSuspenseQuery(liveQO);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <header className="border-b border-foreground pb-6 mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Bản đồ trực tuyến</p>
        <h1 className="font-display italic text-4xl md:text-6xl mt-2">
          Không phận <span className="text-accent">Việt Nam</span>
        </h1>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {data.aircraft.length} máy bay đang được theo dõi
        </p>
      </header>

      <div className="border border-foreground/20 rounded overflow-hidden" style={{ height: "70vh" }}>
        {mounted ? <LiveMap aircraft={data.aircraft} /> : (
          <div className="w-full h-full grid place-items-center font-mono text-xs text-muted-foreground">
            Đang khởi tạo bản đồ…
          </div>
        )}
      </div>
    </div>
  );
}

function LiveMap({ aircraft }: { aircraft: Array<{ icao24: string; callsign: string | null; lat: number; lon: number; heading: number | null; alt_m: number | null }> }) {
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
    return () => {
      cancelled = true;
    };
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
    <RL.MapContainer center={[15.5, 107]} zoom={6} style={{ height: "100%", width: "100%" }} attributionControl={false}>
      <RL.TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {aircraft.map((a) => (
        <RL.Marker key={a.icao24} position={[a.lat, a.lon]} icon={planeIcon(a.heading ?? 0)}>
          <RL.Popup>
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              <strong>{a.callsign ?? a.icao24}</strong>
              <br />Alt: {a.alt_m ? Math.round(a.alt_m) + " m" : "—"}
              <br />Hướng: {a.heading != null ? Math.round(a.heading) + "°" : "—"}
            </div>
          </RL.Popup>
        </RL.Marker>
      ))}
    </RL.MapContainer>
  );
}