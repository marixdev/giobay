import { createFileRoute, Link } from "@tanstack/react-router";

import { AirportChips } from "@/components/AirportChips";
import { FlightSearch } from "@/components/FlightSearch";
import { VN_AIRPORTS } from "@/lib/airports";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bay Live — Theo dõi chuyến bay sân bay Việt Nam" },
      { name: "description", content: "Bảng giờ Đến/Đi trực tiếp, tìm kiếm chuyến bay, bản đồ máy bay realtime cho 19 sân bay Việt Nam." },
      { property: "og:title", content: "Bay Live — FIDS sân bay Việt Nam" },
      { property: "og:description", content: "Theo dõi lịch trình chuyến bay tại các sân bay Việt Nam theo thời gian thực." },
    ],
  }),
  
  component: Home,
});

function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
      <section className="border-b border-foreground pb-12 mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
          Vietnam National Flight Terminal
        </p>
        <h1 className="font-display italic text-5xl md:text-7xl leading-[1.05] tracking-tight text-balance">
          Theo dõi chuyến bay <span className="text-accent">trực tiếp</span><br />
          tại các sân bay Việt Nam.
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg text-muted-foreground text-pretty">
          Bảng giờ Đến/Đi, tra cứu chuyến bay theo số hiệu, bản đồ vị trí máy bay realtime
          trong vùng FIR Việt Nam — cập nhật mỗi 60 giây.
        </p>
        <div className="mt-8">
          <FlightSearch />
        </div>
      </section>

      <section className="mb-16">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2 mb-6">
            Chọn sân bay để xem bảng giờ
          </h2>
          <AirportChips />

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-foreground/15">
            {VN_AIRPORTS.slice(0, 6).map((a) => (
              <Link
                key={a.iata}
                to="/airports/$code"
                params={{ code: a.iata }}
                className="group bg-background p-6 hover:bg-foreground hover:text-background transition-colors"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display italic text-3xl">{a.iata}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-background/60">
                    {a.icao}
                  </span>
                </div>
                <div className="mt-2 text-sm">{a.name}</div>
                <div className="text-xs text-muted-foreground group-hover:text-background/70">{a.city}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

