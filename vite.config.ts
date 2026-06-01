// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Force Nitro on with the Node preset so production builds still emit the
  // expected `dist/` folder while producing a VPS-runnable Node server.
  nitro: {
    preset: "node-server",
  },
  vite: {
    build: {
      onLog(level, log, handler) {
        // Vite 7 can report React library "use client" directives through
        // onLog instead of Rollup's onwarn; these warnings are safe to ignore.
        if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
        if (typeof log.message === "string" && log.message.includes('"use client"')) return;
        handler(level, log);
      },
      rollupOptions: {
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
