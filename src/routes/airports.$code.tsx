import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AirportChips } from "@/components/AirportChips";
import { FlightBoard } from "@/components/FlightBoard";
import { FlightSearch } from "@/components/FlightSearch";
import { findAirport } from "@/lib/airports";
import { getFlights } from "@/lib/flights.functions";

const flightsQO = (airport: string, direction: "departure" | "arrival") =>
  queryOptions({
    queryKey: ["flights", airport, direction],
    queryFn: () => getFlights({ data: { airport, direction } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

export const Route = createFileRoute("/airports/$code")({
  head: ({ params }) => {
    const a = findAirport(params.code);
    const title = a ? `${a.name} (${a.iata}) — Lịch chuyến bay trực tiếp` : "Sân bay không tìm thấy";
    const desc = a
      ? `Bảng giờ chuyến bay Đến/Đi tại sân bay ${a.name} (${a.iata}) — ${a.city}. Cập nhật trực tiếp.`
      : "Bay Live — sân bay không tìm thấy.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  loader: ({ params, context }) => {
    const a = findAirport(params.code);
    if (!a) throw notFound();
    context.queryClient.ensureQueryData(flightsQO(a.iata, "departure"));
    return { airport: a };
  },
  component: AirportPage,
});

function AirportPage() {
  const { airport } = Route.useLoaderData();
  const [direction, setDirection] = useState<"departure" | "arrival">("departure");
  const [terminal, setTerminal] = useState<string>("ALL");
  const [flightType, setFlightType] = useState<"ALL" | "domestic" | "international">("ALL");
  const { data, isFetching, refetch } = useSuspenseQuery(flightsQO(airport.iata, direction));
  const router = useRouter();
  // Re-trigger loader when params change
  useEffect(() => {
    router.invalidate();
  }, [airport.iata, router]);

  const terminals = Array.from(
    new Set(data.rows.map((r) => r.terminal).filter((t): t is string => !!t)),
  ).sort();
  const filteredRows = data.rows.filter((r) => {
    if (terminal !== "ALL" && r.terminal !== terminal) return false;
    if (flightType !== "ALL" && r.type !== flightType) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <header className="border-b border-foreground pb-6 mb-10">
        <div className="flex flex-col md:flex-row justify-between items-baseline gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              Sân bay · {airport.icao} · {airport.city}
            </p>
            <h1 className="font-display italic text-4xl md:text-6xl leading-none mt-2">
              {airport.name} <span className="text-accent">{airport.iata}</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDirection("departure")}
              className={
                direction === "departure"
                  ? "px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-medium"
                  : "px-4 py-1.5 rounded-full border border-foreground/20 text-sm font-medium hover:bg-foreground/5"
              }
            >
              Đi
            </button>
            <button
              onClick={() => setDirection("arrival")}
              className={
                direction === "arrival"
                  ? "px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-medium"
                  : "px-4 py-1.5 rounded-full border border-foreground/20 text-sm font-medium hover:bg-foreground/5"
              }
            >
              Đến
            </button>
          </div>
        </div>
      </header>

      <div className="mb-10">
        <AirportChips active={airport.iata} />
      </div>

      <div className="mb-6">
        <FlightSearch />
      </div>

      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {direction === "departure" ? "Chuyến bay khởi hành" : "Chuyến bay đến"}
        </h2>
        <div className="flex gap-4 items-center">
          <span className="text-[10px] font-mono text-accent">● TRỰC TIẾP</span>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {data.source === "airlabs"
              ? "Nguồn: AirLabs"
              : data.source === "aviationstack" || data.source === "live"
                ? "Nguồn: AviationStack"
                : "Nguồn: Dữ liệu mẫu"}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[10px] font-mono uppercase tracking-wider hover:text-accent disabled:opacity-50"
          >
            {isFetching ? "Đang tải…" : "Làm mới"}
          </button>
        </div>
      </div>

      {terminals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Nhà ga:</span>
          <button
            onClick={() => setTerminal("ALL")}
            className={
              terminal === "ALL"
                ? "px-3 py-1 rounded-full bg-foreground text-background text-[11px] font-mono"
                : "px-3 py-1 rounded-full border border-foreground/20 text-[11px] font-mono hover:bg-foreground/5"
            }
          >
            Tất cả
          </button>
          {terminals.map((t) => (
            <button
              key={t}
              onClick={() => setTerminal(t)}
              className={
                terminal === t
                  ? "px-3 py-1 rounded-full bg-foreground text-background text-[11px] font-mono"
                  : "px-3 py-1 rounded-full border border-foreground/20 text-[11px] font-mono hover:bg-foreground/5"
              }
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <FlightBoard rows={filteredRows} direction={direction} />
    </div>
  );
}