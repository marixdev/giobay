import { Link } from "@tanstack/react-router";

import { VN_AIRPORTS } from "@/lib/airports";

export function AirportChips({ active }: { active?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {VN_AIRPORTS.map((a) => {
        const isActive = a.iata === active;
        return (
          <Link
            key={a.iata}
            to="/airports/$code"
            params={{ code: a.iata }}
            className={
              isActive
                ? "px-3 py-1.5 rounded-full border border-foreground bg-foreground text-background text-xs font-mono tracking-wider"
                : "px-3 py-1.5 rounded-full border border-foreground/20 text-xs font-mono tracking-wider hover:bg-foreground/5"
            }
          >
            {a.iata}
          </Link>
        );
      })}
    </div>
  );
}