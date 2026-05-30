import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getStats } from "@/lib/flights.functions";

const statsQO = queryOptions({
  queryKey: ["stats"],
  queryFn: () => getStats(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Thống kê chuyến bay — Bay Live" },
      { name: "description", content: "Số chuyến bay, tỉ lệ đúng giờ và top tuyến bay các sân bay Việt Nam." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQO),
  component: StatsPage,
});

function StatsPage() {
  const { data } = useSuspenseQuery(statsQO);
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <header className="border-b border-foreground pb-6 mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Thống kê</p>
        <h1 className="font-display italic text-4xl md:text-6xl mt-2">
          Hoạt động <span className="text-accent">hôm nay</span>
        </h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <Kpi label="Tổng chuyến" value={data.totalToday.toLocaleString("vi-VN")} />
        <Kpi label="Đúng giờ TB" value={`${data.avgOnTime}%`} />
        <Kpi label="Sân bay" value={String(data.perAirport.length)} />
        <Kpi label="Hãng bay" value={String(data.perAirline.length)} />
      </div>

      <section className="mb-16">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2 mb-6">
          Chuyến bay theo sân bay
        </h2>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={data.perAirport}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.012 60 / 0.1)" />
              <XAxis dataKey="iata" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
              <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="flights" fill="oklch(0.62 0.205 35)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2 mb-6">
            Top hãng bay
          </h2>
          <ul className="divide-y divide-border">
            {data.perAirline.map((a) => (
              <li key={a.name} className="flex justify-between py-3 font-mono text-sm">
                <span>{a.name}</span>
                <span className="text-accent">{a.flights}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2 mb-6">
            Top tuyến bay
          </h2>
          <ul className="divide-y divide-border">
            {data.topRoutes.map((r) => (
              <li key={r.route} className="flex justify-between py-3 font-mono text-sm">
                <span>{r.route}</span>
                <span className="text-accent">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-foreground/15 p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display italic text-4xl mt-1">{value}</p>
    </div>
  );
}