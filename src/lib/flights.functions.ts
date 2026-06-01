import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { findAirport, VN_AIRPORTS, VN_BBOX } from "./airports";

/** Server-side cache (per-worker, in-memory). */
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL = 120_000; // 2 phút — đủ tươi cho lịch bay, vẫn giảm tải nguồn

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data as T;
  return undefined;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
}

export type FlightType = "domestic" | "international";

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
  dep_scheduled: string | null;
  dep_estimated: string | null;
  arr_scheduled: string | null;
  arr_estimated: string | null;
  status: string;
  gate: string | null;
  terminal: string | null;
  delay_minutes: number | null;
  type: FlightType;
};

type Direction = "departure" | "arrival";
type SourceTag = "fr24" | "airlabs" | "aviationstack" | "live" | "mock";

function statusVi(s: string): string {
  const m: Record<string, string> = {
    scheduled: "Dự kiến",
    active: "Đang bay",
    en_route: "Đang bay",
    "en-route": "Đang bay",
    departed: "Đã khởi hành",
    landed: "Đã hạ cánh",
    arrived: "Đã hạ cánh",
    cancelled: "Hủy chuyến",
    canceled: "Hủy chuyến",
    incident: "Sự cố",
    diverted: "Chuyển hướng",
    unknown: "Chưa rõ",
  };
  return m[s] ?? s;
}

/**
 * AirLabs /schedules thường giữ status="scheduled" kể cả khi cửa đã đóng /
 * tàu bay đã rời sân. Suy luận trạng thái thực tế dựa trên mốc thời gian.
 */
function inferStatus(
  rawStatus: string,
  direction: Direction,
  dep: { scheduled: string | null; estimated: string | null; actual: string | null },
  arr: { scheduled: string | null; estimated: string | null; actual: string | null },
  delay: number,
): string {
  const term = ["cancelled", "canceled", "landed", "arrived", "diverted", "incident"];
  if (term.includes(rawStatus)) return statusVi(rawStatus);

  const now = Date.now();
  const toMs = (v: string | null) => (v ? new Date(v).getTime() : NaN);
  const depT = toMs(dep.actual) || toMs(dep.estimated) || toMs(dep.scheduled);
  const arrT = toMs(arr.actual) || toMs(arr.estimated) || toMs(arr.scheduled);

  if (dep.actual || rawStatus === "active" || rawStatus === "en-route" || rawStatus === "en_route") {
    if (!Number.isNaN(arrT) && now >= arrT) return "Đã hạ cánh";
    return "Đang bay";
  }

  if (!Number.isNaN(depT)) {
    const diff = now - depT; // ms
    if (diff >= 15 * 60_000) {
      // 15 phút sau giờ đi (lịch hoặc dự kiến) → coi như đã khởi hành
      if (!Number.isNaN(arrT) && now >= arrT) return "Đã hạ cánh";
      return direction === "departure" ? "Đã khởi hành" : "Đang bay";
    }
    if (diff >= -15 * 60_000 && direction === "departure") {
      // trong khoảng ±15' quanh giờ đi → cửa đã/đang đóng
      return "Đã đóng cửa";
    }
  }

  if (delay > 0) return `Trễ ${delay} phút`;
  return statusVi(rawStatus || "scheduled");
}

function computeFlightType(dep: string, arr: string): FlightType {
  // Robust: check by IATA/ICAO via findAirport, plus ICAO prefix "VV" which
  // covers Vietnamese aerodromes not listed in VN_AIRPORTS.
  const isVN = (code: string) => {
    if (!code) return false;
    const c = code.toUpperCase();
    if (findAirport(c)) return true;
    if (c.length === 4 && c.startsWith("VV")) return true;
    return false;
  };
  // Unknown both sides → treat as domestic to avoid false "Quốc tế" labels
  // when an upstream source omits airport codes.
  if (!dep && !arr) return "domestic";
  return isVN(dep) && isVN(arr) ? "domestic" : "international";
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
    const arrSched = new Date(sched.getTime() + (60 + (i % 4) * 20) * 60_000);
    const delay = i % 5 === 1 ? 25 : i % 7 === 0 ? 10 : 0;
    const est = delay ? new Date(sched.getTime() + delay * 60_000) : sched;
    const arrEst = delay ? new Date(arrSched.getTime() + delay * 60_000) : arrSched;
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
      estimated: est.toISOString(),
      actual: null,
      dep_scheduled: (direction === "departure" ? sched : arrSched).toISOString(),
      dep_estimated: (direction === "departure" ? est : arrEst).toISOString(),
      arr_scheduled: (direction === "departure" ? arrSched : sched).toISOString(),
      arr_estimated: (direction === "departure" ? arrEst : est).toISOString(),
      status,
      gate: cancelled ? null : ["A01", "B04", "C12", "D08", "G15"][i % 5],
      terminal: i % 2 === 0 ? "T1" : "T2",
      delay_minutes: delay || null,
      type: computeFlightType(direction === "departure" ? iata : other.iata, direction === "departure" ? other.iata : iata),
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
    const status = inferStatus(
      r.flight_status ?? "scheduled",
      direction,
      { scheduled: r.departure?.scheduled ?? null, estimated: r.departure?.estimated ?? null, actual: r.departure?.actual ?? null },
      { scheduled: r.arrival?.scheduled ?? null, estimated: r.arrival?.estimated ?? null, actual: r.arrival?.actual ?? null },
      delay,
    );
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
      dep_scheduled: r.departure?.scheduled ?? null,
      dep_estimated: r.departure?.estimated ?? null,
      arr_scheduled: r.arrival?.scheduled ?? null,
      arr_estimated: r.arrival?.estimated ?? null,
      status,
      gate: side?.gate ?? null,
      terminal: side?.terminal ?? null,
      delay_minutes: delay || null,
      type: computeFlightType(r.departure?.iata ?? "", r.arrival?.iata ?? ""),
    };
  });
}

type AirLabsSchedule = {
  airline_iata?: string;
  airline_icao?: string;
  flight_iata?: string;
  flight_icao?: string;
  flight_number?: string;
  dep_iata?: string;
  arr_iata?: string;
  dep_terminal?: string | null;
  dep_gate?: string | null;
  arr_terminal?: string | null;
  arr_gate?: string | null;
  dep_time?: string | null;
  dep_time_utc?: string | null;
  dep_estimated?: string | null;
  dep_estimated_utc?: string | null;
  dep_actual?: string | null;
  dep_actual_utc?: string | null;
  arr_time?: string | null;
  arr_time_utc?: string | null;
  arr_estimated?: string | null;
  arr_estimated_utc?: string | null;
  arr_actual?: string | null;
  arr_actual_utc?: string | null;
  status?: string;
  delayed?: number | null;
};

const AIRLINE_NAMES: Record<string, string> = {
  VN: "Vietnam Airlines",
  VJ: "Vietjet Air",
  QH: "Bamboo Airways",
  VU: "Vietravel Airlines",
  BL: "Pacific Airlines",
  MH: "Malaysia Airlines",
  SQ: "Singapore Airlines",
  TG: "Thai Airways",
  CX: "Cathay Pacific",
  KE: "Korean Air",
  OZ: "Asiana Airlines",
  JL: "Japan Airlines",
  NH: "All Nippon Airways",
  CI: "China Airlines",
  BR: "EVA Air",
  CA: "Air China",
  CZ: "China Southern",
  MU: "China Eastern",
  HX: "Hong Kong Airlines",
  AK: "AirAsia",
  FD: "Thai AirAsia",
  D7: "AirAsia X",
  TR: "Scoot",
  "3K": "Jetstar Asia",
  QF: "Qantas",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  TK: "Turkish Airlines",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  BA: "British Airways",
  AA: "American Airlines",
  UA: "United Airlines",
  DL: "Delta Air Lines",
};


function toIso(utc: string | null | undefined, local: string | null | undefined): string | null {
  const v = utc || local;
  if (!v) return null;
  // AirLabs returns "YYYY-MM-DD HH:mm" (UTC when *_utc); convert to ISO.
  const iso = v.includes("T") ? v : v.replace(" ", "T") + (utc ? "Z" : "");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchAirLabs(direction: Direction, iata: string): Promise<AirLabsSchedule[] | null> {
  const key = process.env.AIRLABS_API_KEY;
  if (!key) return null;
  const url = new URL("https://airlabs.co/api/v9/schedules");
  url.searchParams.set("api_key", key);
  if (direction === "departure") url.searchParams.set("dep_iata", iata);
  else url.searchParams.set("arr_iata", iata);
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { response?: AirLabsSchedule[]; error?: unknown };
    if (!json.response || json.error) return null;
    return json.response;
  } catch (e) {
    console.error("AirLabs error", e);
    return null;
  }
}

function mapAirLabs(rows: AirLabsSchedule[], direction: Direction): FlightRow[] {
  return rows.map((r) => {
    const isDep = direction === "departure";
    const scheduled = isDep
      ? toIso(r.dep_time_utc, r.dep_time)
      : toIso(r.arr_time_utc, r.arr_time);
    const estimated = isDep
      ? toIso(r.dep_estimated_utc, r.dep_estimated)
      : toIso(r.arr_estimated_utc, r.arr_estimated);
    const actual = isDep
      ? toIso(r.dep_actual_utc, r.dep_actual)
      : toIso(r.arr_actual_utc, r.arr_actual);
    const delay = r.delayed ?? 0;
    const airlineIata = r.airline_iata ?? "";
    const depScheduled = toIso(r.dep_time_utc, r.dep_time);
    const depEstimated = toIso(r.dep_estimated_utc, r.dep_estimated);
    const depActual = toIso(r.dep_actual_utc, r.dep_actual);
    const arrScheduled = toIso(r.arr_time_utc, r.arr_time);
    const arrEstimated = toIso(r.arr_estimated_utc, r.arr_estimated);
    const arrActual = toIso(r.arr_actual_utc, r.arr_actual);
    const status = inferStatus(
      r.status ?? "scheduled",
      direction,
      { scheduled: depScheduled, estimated: depEstimated, actual: depActual },
      { scheduled: arrScheduled, estimated: arrEstimated, actual: arrActual },
      delay,
    );
    return {
      flight_iata: r.flight_iata ?? `${airlineIata}${r.flight_number ?? ""}`,
      flight_number: r.flight_number ?? "",
      airline_name: AIRLINE_NAMES[airlineIata] ?? airlineIata ?? "—",
      airline_iata: airlineIata,
      dep_iata: r.dep_iata ?? "",
      arr_iata: r.arr_iata ?? "",
      scheduled,
      estimated: estimated ?? scheduled,
      actual,
      dep_scheduled: depScheduled,
      dep_estimated: depEstimated ?? depScheduled,
      arr_scheduled: arrScheduled,
      arr_estimated: arrEstimated ?? arrScheduled,
      status,
      gate: (isDep ? r.dep_gate : r.arr_gate) ?? null,
      terminal: (isDep ? r.dep_terminal : r.arr_terminal) ?? null,
      delay_minutes: delay || null,
      type: computeFlightType(r.dep_iata ?? "", r.arr_iata ?? ""),
    };
  });
}

type FR24Item = {
  flight?: {
    identification?: { number?: { default?: string | null }; callsign?: string | null };
    airline?: { code?: { iata?: string | null }; name?: string | null };
    airport?: {
      origin?: { code?: { iata?: string | null }; info?: { terminal?: string | null; gate?: string | null } } | null;
      destination?: { code?: { iata?: string | null }; info?: { terminal?: string | null; gate?: string | null } } | null;
    };
    time?: {
      scheduled?: { departure?: number | null; arrival?: number | null } | null;
      estimated?: { departure?: number | null; arrival?: number | null } | null;
      real?: { departure?: number | null; arrival?: number | null } | null;
    };
    status?: { text?: string | null; type?: string | null; generic?: { status?: { text?: string | null; type?: string | null } | null } | null };
  };
};

function fr24StatusToRaw(s: FR24Item["flight"] extends infer F ? (F extends { status?: infer S } ? S : never) : never): string {
  if (!s) return "scheduled";
  const t = (s.generic?.status?.type ?? s.type ?? "").toLowerCase();
  if (t.includes("cancel")) return "cancelled";
  if (t.includes("landed") || t.includes("arrived")) return "landed";
  if (t.includes("departed") || t.includes("active") || t.includes("live") || t.includes("en route") || t.includes("en-route")) return "active";
  if (t.includes("diverted")) return "diverted";
  return "scheduled";
}

function unixToIso(s: number | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchFR24(iata: string, direction: Direction): Promise<FlightRow[] | null> {
  const mode = direction === "departure" ? "departures" : "arrivals";
  const url =
    `https://api.flightradar24.com/common/v1/airport.json?code=${iata}` +
    `&plugin[]=schedule&plugin-setting[schedule][mode]=${mode}` +
    `&plugin-setting[schedule][timestamp]=${Math.floor(Date.now() / 1000)}` +
    `&page=1&limit=100`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: { response?: { airport?: { pluginData?: { schedule?: Record<string, { data?: FR24Item[] }> } } } };
    };
    const data = json?.result?.response?.airport?.pluginData?.schedule?.[mode]?.data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const rows: FlightRow[] = [];
    for (const it of data) {
      const f = it.flight;
      if (!f) continue;
      const airlineIata = f.airline?.code?.iata ?? "";
      const num = f.identification?.number?.default ?? "";
      const flightIata = num || `${airlineIata}${f.identification?.callsign ?? ""}`;
      if (!flightIata) continue;
      const originCode = f.airport?.origin?.code as { iata?: string | null; icao?: string | null } | undefined;
      const destCode = f.airport?.destination?.code as { iata?: string | null; icao?: string | null } | undefined;
      // FR24 thường trả "" (chuỗi rỗng) thay vì null cho iata thiếu —
      // dùng `||` để fallback sang icao, nếu không computeFlightType nhận
      // toàn bộ chuyến bay là "Quốc tế" (cả hai mã đều rỗng).
      // Thêm fallback cuối cùng về sân bay đang query: khi FR24 trả về danh
      // sách departures/arrivals cho một sân bay, đôi khi side của chính sân
      // bay đó bị bỏ trống → khiến mọi chuyến bay bị gán nhầm "Quốc tế".
      const depIata =
        (originCode?.iata || originCode?.icao || (direction === "departure" ? iata : "")).toUpperCase();
      const arrIata =
        (destCode?.iata || destCode?.icao || (direction === "arrival" ? iata : "")).toUpperCase();
      const depScheduled = unixToIso(f.time?.scheduled?.departure);
      const depEstimated = unixToIso(f.time?.estimated?.departure);
      const depActual = unixToIso(f.time?.real?.departure);
      const arrScheduled = unixToIso(f.time?.scheduled?.arrival);
      const arrEstimated = unixToIso(f.time?.estimated?.arrival);
      const arrActual = unixToIso(f.time?.real?.arrival);
      const rawStatus = fr24StatusToRaw(f.status as never);
      const sched = depScheduled ? new Date(depScheduled).getTime() : NaN;
      const est = depEstimated ? new Date(depEstimated).getTime() : NaN;
      const delay = !Number.isNaN(sched) && !Number.isNaN(est) ? Math.max(0, Math.round((est - sched) / 60_000)) : 0;
      const status = inferStatus(
        rawStatus,
        direction,
        { scheduled: depScheduled, estimated: depEstimated, actual: depActual },
        { scheduled: arrScheduled, estimated: arrEstimated, actual: arrActual },
        delay,
      );
      const isDep = direction === "departure";
      const sideInfo = isDep ? f.airport?.origin?.info : f.airport?.destination?.info;
      rows.push({
        flight_iata: flightIata,
        flight_number: num.replace(/^[A-Z]{2}/i, ""),
        airline_name: f.airline?.name ?? AIRLINE_NAMES[airlineIata] ?? airlineIata ?? "—",
        airline_iata: airlineIata,
        dep_iata: depIata,
        arr_iata: arrIata,
        scheduled: isDep ? depScheduled : arrScheduled,
        estimated: (isDep ? depEstimated : arrEstimated) ?? (isDep ? depScheduled : arrScheduled),
        actual: isDep ? depActual : arrActual,
        dep_scheduled: depScheduled,
        dep_estimated: depEstimated ?? depScheduled,
        arr_scheduled: arrScheduled,
        arr_estimated: arrEstimated ?? arrScheduled,
        status,
        gate: sideInfo?.gate ?? null,
        terminal: sideInfo?.terminal ?? null,
        delay_minutes: delay || null,
        type: computeFlightType(depIata, arrIata),
      });
    }
    return rows;
  } catch (e) {
    console.error("FR24 error", e);
    return null;
  }
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
    const cached = getCached<{ rows: FlightRow[]; source: SourceTag }>(cacheKey);
    if (cached) return cached;

    let result: { rows: FlightRow[]; source: SourceTag };
    const fr24 = await fetchFR24(iata, data.direction);
    if (fr24 && fr24.length > 0) {
      result = { rows: fr24, source: "fr24" };
    } else {
      const airlabs = await fetchAirLabs(data.direction, iata);
      if (airlabs && airlabs.length > 0) {
        result = { rows: mapAirLabs(airlabs, data.direction), source: "airlabs" };
      } else {
      const params: Record<string, string> = {};
      if (data.direction === "departure") params.dep_iata = iata;
      else params.arr_iata = iata;
      const live = await fetchAviationStack(params);
      if (live && live.length > 0) {
        result = { rows: mapAviationStack(live, data.direction), source: "aviationstack" };
      } else {
        result = { rows: generateMock(iata, data.direction), source: "mock" };
      }
      }
    }
    setCached(cacheKey, result);
    return result;
  });

export const searchFlight = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string().min(2).max(10).regex(/^[A-Za-z0-9 ]+$/) }))
  .handler(async ({ data }) => {
    const q = data.query.replace(/\s+/g, "").toUpperCase();
    const cacheKey = `search:${q}`;
    const cached = getCached<{ rows: FlightRow[]; source: SourceTag }>(cacheKey);
    if (cached) return cached;

    let result: { rows: FlightRow[]; source: SourceTag } | null = null;

    // 1) FR24 flight lookup by flight number — most reliable, no key required.
    const fr24 = await fetchFR24Flight(q);
    if (fr24 && fr24.length > 0) {
      result = { rows: fr24, source: "fr24" };
    }

    // 2) AirLabs /flight endpoint (single in-air flight) — falls back to schedules.
    if (!result) {
      const airlabs = await fetchAirLabsFlight(q);
      if (airlabs && airlabs.length > 0) {
        result = { rows: mapAirLabs(airlabs, "departure"), source: "airlabs" };
      }
    }

    // 3) AviationStack last (most rate-limited).
    if (!result) {
      const live = await fetchAviationStack({ flight_iata: q });
      if (live && live.length > 0) {
        result = { rows: mapAviationStack(live, "departure"), source: "aviationstack" };
      }
    }

    if (!result) {
      // No real data found — return empty so the page shows "not found"
      // instead of fabricating a Vietnam Airlines mock entry.
      result = { rows: [], source: "mock" };
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