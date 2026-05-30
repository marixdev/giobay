import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { VN_AIRPORTS, VN_BBOX } from "./airports";

/** Server-side cache (per-worker, in-memory). */
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL = 300_000; // 5 minutes — preserve AirLabs free quota

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data as T;
  return undefined;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
}

export type FlightRow = {
  flight_iata: string;
  flight_number: string;
  airline_name: string;
  airline_iata: string;
  dep_iata: string;
  arr_iata: string;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  status: string;
  gate: string | null;
  terminal: string | null;
  delay_minutes: number | null;
};

type Direction = "departure" | "arrival";

function statusVi(s: string): string {
  const m: Record<string, string> = {
    scheduled: "Dự kiến",
    active: "Đang bay",
    landed: "Đã hạ cánh",
    cancelled: "Hủy chuyến",
    incident: "Sự cố",
    diverted: "Chuyển hướng",
  };
  return m[s] ?? s;
}

function generateMock(iata: string, direction: Direction): FlightRow[] {
  const airlines = [
    { iata: "VN", name: "Vietnam Airlines" },
    { iata: "VJ", name: "Vietjet Air" },
    { iata: "QH", name: "Bamboo Airways" },
    { iata: "VU", name: "Vietravel Airlines" },
    { iata: "BL", name: "Pacific Airlines" },
  ];
  const otherAirports = VN_AIRPORTS.filter((a) => a.iata !== iata);
  const now = Date.now();
  const rows: FlightRow[] = [];
  for (let i = 0; i < 18; i++) {
    const a = airlines[i % airlines.length];
    const other = otherAirports[i % otherAirports.length];
    const minutesOffset = (i - 4) * 25;
    const sched = new Date(now + minutesOffset * 60_000);
    const delay = i % 5 === 1 ? 25 : i % 7 === 0 ? 10 : 0;
    const cancelled = i % 11 === 3;
    const status: string = cancelled
      ? "Hủy chuyến"
      : minutesOffset < -30
        ? "Đã hạ cánh"
        : minutesOffset < 0
          ? "Đang bay"
          : delay > 0
            ? `Trễ ${delay} phút`
            : "Đúng giờ";
    rows.push({
      flight_iata: `${a.iata}${100 + i * 3}`,
      flight_number: `${100 + i * 3}`,
      airline_name: a.name,
      airline_iata: a.iata,
      dep_iata: direction === "departure" ? iata : other.iata,
      arr_iata: direction === "departure" ? other.iata : iata,
      scheduled: sched.toISOString(),
      estimated: delay ? new Date(sched.getTime() + delay * 60_000).toISOString() : sched.toISOString(),
      actual: null,
      status,
      gate: cancelled ? null : ["A01", "B04", "C12", "D08", "G15"][i % 5],
      terminal: i % 2 === 0 ? "T1" : "T2",
      delay_minutes: delay || null,
    });
  }
  return rows;
}

type AviationStackFlight = {
  flight_date: string;
  flight_status: string;
  departure: { iata: string; scheduled: string | null; estimated: string | null; actual: string | null; gate: string | null; terminal: string | null; delay: number | null };
  arrival: { iata: string; scheduled: string | null; estimated: string | null; actual: string | null; gate: string | null; terminal: string | null; delay: number | null };
  airline: { name: string; iata: string };
  flight: { iata: string; number: string };
};

async function fetchAviationStack(params: Record<string, string>): Promise<AviationStackFlight[] | null> {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) return null;
  const url = new URL("http://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", key);
  url.searchParams.set("limit", "100");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: AviationStackFlight[]; error?: unknown };
    if (json.error || !json.data) return null;
    return json.data;
  } catch (e) {
    console.error("AviationStack error", e);
    return null;
  }
}

function mapAviationStack(rows: AviationStackFlight[], direction: Direction): FlightRow[] {
  return rows.map((r) => {
    const side = direction === "departure" ? r.departure : r.arrival;
    const delay = side?.delay ?? 0;
    const baseStatus = statusVi(r.flight_status);
    const status = delay > 0 && r.flight_status === "scheduled" ? `Trễ ${delay} phút` : baseStatus;
    return {
      flight_iata: r.flight?.iata ?? `${r.airline?.iata ?? ""}${r.flight?.number ?? ""}`,
      flight_number: r.flight?.number ?? "",
      airline_name: r.airline?.name ?? "—",
      airline_iata: r.airline?.iata ?? "",
      dep_iata: r.departure?.iata ?? "",
      arr_iata: r.arrival?.iata ?? "",
      scheduled: side?.scheduled ?? null,
      estimated: side?.estimated ?? null,
      actual: side?.actual ?? null,
      status,
      gate: side?.gate ?? null,
      terminal: side?.terminal ?? null,
      delay_minutes: delay || null,
    };
  });
}

export const getFlights = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      airport: z.string().min(3).max(4).regex(/^[A-Za-z]+$/),
      direction: z.enum(["departure", "arrival"]),
    }),
  )
  .handler(async ({ data }) => {
    const iata = data.airport.toUpperCase();
    const cacheKey = `flights:${iata}:${data.direction}`;
    const cached = getCached<{ rows: FlightRow[]; source: "live" | "mock" }>(cacheKey);
    if (cached) return cached;

    const params: Record<string, string> = {};
    if (data.direction === "departure") params.dep_iata = iata;
    else params.arr_iata = iata;

    const live = await fetchAviationStack(params);
    let result: { rows: FlightRow[]; source: "live" | "mock" };
    if (live && live.length > 0) {
      result = { rows: mapAviationStack(live, data.direction), source: "live" };
    } else {
      result = { rows: generateMock(iata, data.direction), source: "mock" };
    }
    setCached(cacheKey, result);
    return result;
  });

export const searchFlight = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string().min(2).max(10).regex(/^[A-Za-z0-9 ]+$/) }))
  .handler(async ({ data }) => {
    const q = data.query.replace(/\s+/g, "").toUpperCase();
    const cacheKey = `search:${q}`;
    const cached = getCached<{ rows: FlightRow[]; source: "live" | "mock" }>(cacheKey);
    if (cached) return cached;

    const live = await fetchAviationStack({ flight_iata: q });
    let result: { rows: FlightRow[]; source: "live" | "mock" };
    if (live && live.length > 0) {
      result = { rows: mapAviationStack(live, "departure"), source: "live" };
    } else {
      // Mock: return one synthetic row matching the query
      const airlineCode = q.slice(0, 2);
      const num = q.slice(2);
      const mock = generateMock("SGN", "departure")[0];
      result = {
        rows: [{ ...mock, flight_iata: q, flight_number: num, airline_iata: airlineCode }],
        source: "mock",
      };
    }
    setCached(cacheKey, result);
    return result;
  });

export type LiveAircraft = {
  icao24: string;
  callsign: string | null;
  country: string | null;
  lon: number;
  lat: number;
  alt_m: number | null;
  vel_ms: number | null;
  heading: number | null;
  on_ground: boolean;
};

function generateMockLive(): LiveAircraft[] {
  const out: LiveAircraft[] = [];
  for (let i = 0; i < 40; i++) {
    const lat = 8 + Math.random() * 15;
    const lon = 103 + Math.random() * 6;
    out.push({
      icao24: Math.random().toString(16).slice(2, 8),
      callsign: `VN${100 + i}`,
      country: "Vietnam",
      lat,
      lon,
      alt_m: 8000 + Math.random() * 4000,
      vel_ms: 200 + Math.random() * 50,
      heading: Math.random() * 360,
      on_ground: false,
    });
  }
  return out;
}

export const getLiveAircraft = createServerFn({ method: "GET" }).handler(async () => {
  const cacheKey = "live:vn";
  const cached = getCached<{ aircraft: LiveAircraft[]; source: "live" | "mock" }>(cacheKey);
  if (cached) return cached;

  const url = `https://opensky-network.org/api/states/all?lamin=${VN_BBOX.lamin}&lomin=${VN_BBOX.lomin}&lamax=${VN_BBOX.lamax}&lomax=${VN_BBOX.lomax}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`OpenSky ${res.status}`);
    const json = (await res.json()) as { states: Array<Array<unknown>> | null };
    const states = json.states ?? [];
    const aircraft: LiveAircraft[] = states
      .map((s) => ({
        icao24: String(s[0] ?? ""),
        callsign: s[1] ? String(s[1]).trim() : null,
        country: s[2] ? String(s[2]) : null,
        lon: Number(s[5] ?? 0),
        lat: Number(s[6] ?? 0),
        on_ground: Boolean(s[8]),
        vel_ms: s[9] == null ? null : Number(s[9]),
        heading: s[10] == null ? null : Number(s[10]),
        alt_m: s[13] == null ? null : Number(s[13]),
      }))
      .filter((a) => a.lat && a.lon);
    const result = { aircraft, source: "live" as const };
    setCached(cacheKey, result);
    return result;
  } catch (e) {
    console.error("OpenSky error", e);
    const result = { aircraft: generateMockLive(), source: "mock" as const };
    setCached(cacheKey, result);
    return result;
  }
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const cacheKey = "stats:vn";
  const cached = getCached<unknown>(cacheKey);
  if (cached) return cached as { perAirport: Array<{ iata: string; city: string; flights: number; onTime: number }>; perAirline: Array<{ name: string; flights: number }>; topRoutes: Array<{ route: string; count: number }>; totalToday: number; avgOnTime: number };

  // Aggregate from mock departures across all airports (deterministic synthetic stats)
  const perAirport = VN_AIRPORTS.slice(0, 10).map((a, i) => ({
    iata: a.iata,
    city: a.city,
    flights: Math.round(180 + (a.iata === "SGN" ? 320 : a.iata === "HAN" ? 280 : 60) + i * 7),
    onTime: 78 + ((i * 13) % 18),
  }));
  const perAirline = [
    { name: "Vietnam Airlines", flights: 612 },
    { name: "Vietjet Air", flights: 548 },
    { name: "Bamboo Airways", flights: 184 },
    { name: "Vietravel Airlines", flights: 72 },
    { name: "Pacific Airlines", flights: 58 },
  ];
  const topRoutes = [
    { route: "SGN → HAN", count: 142 },
    { route: "HAN → SGN", count: 138 },
    { route: "SGN → DAD", count: 88 },
    { route: "HAN → DAD", count: 74 },
    { route: "SGN → PQC", count: 62 },
    { route: "SGN → CXR", count: 54 },
    { route: "HAN → HPH", count: 28 },
    { route: "SGN → VCA", count: 24 },
  ];
  const totalToday = perAirport.reduce((s, x) => s + x.flights, 0);
  const avgOnTime = Math.round(perAirport.reduce((s, x) => s + x.onTime, 0) / perAirport.length);
  const result = { perAirport, perAirline, topRoutes, totalToday, avgOnTime };
  setCached(cacheKey, result);
  return result;
});