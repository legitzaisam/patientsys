// Aetheria marketing site. Static output, served by launch-plan/gateway.
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  // Set SITE_URL when a real domain exists; used for canonical and OG URLs.
  site: process.env.SITE_URL || "http://localhost:8099",
  trailingSlash: "ignore",
  build: { format: "directory", assets: "_astro" },
  server: { port: 4321, host: true },
  devToolbar: { enabled: false },
});
