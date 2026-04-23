import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { bostonApiPlugin } from "./vite-plugin-boston-api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: path.resolve(__dirname, ".."),
  plugins: [react(), tailwindcss(), bostonApiPlugin()],
  server: {
    fs: {
      allow: [".."],
    },
    proxy: {
      "/api/mbta": {
        target: "https://api-v3.mbta.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/mbta/, ""),
        secure: true,
      },
    },
  },
  preview: {
    proxy: {
      "/api/mbta": {
        target: "https://api-v3.mbta.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/mbta/, ""),
        secure: true,
      },
    },
  },
});
