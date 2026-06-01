import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { AirportChips } from "@/components/AirportChips";
import { FlightBoard } from "@/components/FlightBoard";
import { FlightSearch } from "@/components/FlightSearch";
import { findAirport } from "@/lib/airports";
import { diffAndNotify, type FlightSnapshot } from "@/lib/flight-alerts";
import { getFlights } from "@/lib/flights.functions";

const REFRESH_MS = 45_000;

const flightsQO = (airport: string, direction: "departure" | "arrival") =>
  queryOptions({
    queryKey: ["flights", airport, direction],
    queryFn: () => getFlights({ data: { airport, direction } }),
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

const searchSchema = z.object({
  dir: z.enum(["departure", "arrival"]).catch("departure"),
  terminal: z.string().catch("ALL"),
  type: z.enum(["ALL", "domestic", "international"]).catch("ALL"),
});

export const Route = createFileRoute("/airports/$code")({
  validateSearch: zodValidator(searchSchema),
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
  const { dir: direction, terminal, type: flightType } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  type SearchShape = { dir: "departure" | "arrival"; terminal: string; type: "ALL" | "domestic" | "international" };
  const setSearch = (patch: Partial<SearchShape>) =>
    navigate({ search: (prev: SearchShape) => ({ ...prev, ...patch }), replace: true });
  const { data, isFetching, refetch, dataUpdatedAt } = useSuspenseQuery(
    flightsQO(airport.iata, direction),
  );
  const router = useRouter();
  useEffect(() => {
    router.invalidate();
  }, [airport.iata, router]);

  // Alerts: detect gate/time/status changes between auto-refresh cycles.
  const ALERTS_KEY = "bay-live:alerts-enabled";
  const [alertsOn, setAlertsOn] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(ALERTS_KEY);
    if (v === "0") setAlertsOn(false);
  }, []);
  const prevSnap = useRef<Map<string, FlightSnapshot>>(new Map());
  const lastKey = useRef<string>("");
  // Reset baseline when scope changes (airport or direction).
  useEffect(() => {
    const k = `${airport.iata}:${direction}`;
    if (lastKey.current !== k) {
      lastKey.current = k;
      prevSnap.current = new Map();
    }
  }, [airport.iata, direction]);
  useEffect(() => {
    const isFirst = prevSnap.current.size === 0;
    diffAndNotify(data.rows, prevSnap.current, { silent: isFirst || !alertsOn });
  }, [dataUpdatedAt, data.rows, alertsOn]);

  // Countdown to next auto-refresh
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsLeft = Math.max(
    0,
    Math.ceil((dataUpdatedAt + REFRESH_MS - now) / 1000),
  );

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
              onClick={() => setSearch({ dir: "departure" })}
              className={
                direction === "departure"
                  ? "px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-medium"
                  : "px-4 py-1.5 rounded-full border border-foreground/20 text-sm font-medium hover:bg-foreground/5"
              }
            >
              Đi
            </button>
            <button
              onClick={() => setSearch({ dir: "arrival" })}
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
            {isFetching ? "Đang làm mới…" : `Tự cập nhật sau ${secondsLeft}s`}
          </span>
          <button
            onClick={() => {
              const next = !alertsOn;
              setAlertsOn(next);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(ALERTS_KEY, next ? "1" : "0");
              }
            }}
            title="Bật/tắt thông báo thay đổi cửa, giờ, trạng thái"
            className={
              alertsOn
                ? "text-[10px] font-mono uppercase tracking-wider text-accent hover:opacity-80"
                : "text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            }
          >
            {alertsOn ? "🔔 Cảnh báo: BẬT" : "🔕 Cảnh báo: TẮT"}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[10px] font-mono uppercase tracking-wider hover:text-accent disabled:opacity-50"
          >
            {isFetching ? "Đang tải…" : "Làm mới"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 px-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Loại:</span>
        <button
          onClick={() => setSearch({ type: "ALL" })}
          className={
            flightType === "ALL"
              ? "px-3 py-1 rounded-full bg-foreground text-background text-[11px] font-mono"
              : "px-3 py-1 rounded-full border border-foreground/20 text-[11px] font-mono hover:bg-foreground/5"
          }
        >
          Tất cả
        </button>
        <button
          onClick={() => setSearch({ type: "domestic" })}
          className={
            flightType === "domestic"
              ? "px-3 py-1 rounded-full bg-foreground text-background text-[11px] font-mono"
              : "px-3 py-1 rounded-full border border-foreground/20 text-[11px] font-mono hover:bg-foreground/5"
          }
        >
          Nội địa
        </button>
        <button
          onClick={() => setSearch({ type: "international" })}
          className={
            flightType === "international"
              ? "px-3 py-1 rounded-full bg-foreground text-background text-[11px] font-mono"
              : "px-3 py-1 rounded-full border border-foreground/20 text-[11px] font-mono hover:bg-foreground/5"
          }
        >
          Quốc tế
        </button>
      </div>

      {terminals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Nhà ga:</span>
          <button
            onClick={() => setSearch({ terminal: "ALL" })}
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
              onClick={() => setSearch({ terminal: t })}
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