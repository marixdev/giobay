import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function FlightSearch({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim().replace(/\s+/g, "").toUpperCase();
        if (q.length < 3) return;
        navigate({ to: "/flights/$number", params: { number: q } });
      }}
      className={
        compact
          ? "flex items-center gap-2 w-full"
          : "flex items-center gap-2 w-full max-w-xl"
      }
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Số hiệu chuyến bay (VD: VN243, VJ128)"
        className="flex-1 bg-transparent border-b border-foreground/30 focus:border-accent outline-none py-2 px-1 font-mono text-sm placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-foreground text-background font-mono text-xs uppercase tracking-wider rounded-full hover:bg-accent transition-colors"
      >
        Tra cứu
      </button>
    </form>
  );
}