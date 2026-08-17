// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const DEMO = process.env["DEMO"] === "1";

const REAL_DATA_MODULE = path.resolve(import.meta.dirname, "src/lib/clinic.functions.ts");
const DEMO_DATA_MODULE = path.resolve(import.meta.dirname, "src/lib/clinic.functions.demo.ts");

/**
 * Demo mode serves the fixture data layer in place of the Supabase one. Matching
 * on the resolved path rather than the import specifier catches both the
 * `@/lib/clinic.functions` and relative `./clinic.functions` import styles.
 */
function demoDataLayerPlugin(): Plugin {
  return {
    name: "aetheria:demo-data-layer",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source.includes("clinic.functions.demo")) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || path.normalize(resolved.id.split("?")[0]!) !== REAL_DATA_MODULE) return null;
      return this.resolve(DEMO_DATA_MODULE, importer, { ...options, skipSelf: true });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: DEMO ? [demoDataLayerPlugin()] : [],
  vite: {
    define: {
      __DEMO_MODE__: JSON.stringify(DEMO),
    },
  },
});
