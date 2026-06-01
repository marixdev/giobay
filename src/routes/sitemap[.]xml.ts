import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { VN_AIRPORTS } from "@/lib/airports";

const BASE_URL = "https://giobay.online";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const entries: Array<{ path: string; changefreq: string; priority: string }> = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/map", changefreq: "hourly", priority: "0.9" },
        ];
        for (const a of VN_AIRPORTS) {
          entries.push({ path: `/airports/${a.iata}`, changefreq: "hourly", priority: "0.8" });
        }

        const urls = entries
          .map(
            (e) =>
              `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});