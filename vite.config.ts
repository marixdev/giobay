// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Only override Nitro preset when explicitly building for a Node VPS target.
// Lovable preview/published run on Cloudflare workerd (the plugin default),
// so forcing `node-server` here breaks the hosted preview with a 500.
const isNodeBuild = process.env.BUILD_TARGET === "node";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  ...(isNodeBuild ? { nitro: { preset: "node-server" } } : {}),
  vite: {
    build: {
      rollupOptions: {
        onLog(level, log, handler) {
          // Vite 7 can report React library "use client" directives through
          // onLog instead of Rollup's onwarn; these warnings are safe to ignore.
          if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
          if (typeof log.message === "string" && log.message.includes('"use client"')) return;
          handler(level, log);
        },
        onwarn(warning, defaultHandler) {
          // Suppress noisy "use client" directive warnings from React libs.
          if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
          if (typeof warning.message === "string" && warning.message.includes('"use client"')) return;
          defaultHandler(warning);
        },
      },
    },
  },
});
