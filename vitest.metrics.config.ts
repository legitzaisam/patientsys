import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Runs the metrics consistency suite against the real demo fixture with a
 * pinned clock, so every cross-page number is compared on the same day.
 * `npm run check:metrics` uses this; the plain unit config leaves it out.
 */
export const METRICS_NOW = process.env["DEMO_NOW"] ?? "2026-09-20T12:00:00.000Z";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    __DEMO_MODE__: JSON.stringify(true),
    __DEMO_NOW__: JSON.stringify(METRICS_NOW),
  },
  test: {
    environment: "node",
    include: ["tests/metrics/**/*.test.ts"],
  },
});
