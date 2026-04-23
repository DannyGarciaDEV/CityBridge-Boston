#!/usr/bin/env node
/**
 * Copy curated resources into kiosk/api/ so Vercel serverless can read the same
 * bundle the static map imports at build time (path: ../data/resources.json from repo root).
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kioskRoot = path.resolve(__dirname, "..");
const src = path.resolve(kioskRoot, "../data/resources.json");
const destDir = path.join(kioskRoot, "api");
const dest = path.join(destDir, "resources.snapshot.json");

if (!existsSync(src)) {
  console.error(`prepare-server-data: missing ${src} — run "npm run prefetch" from the repo root first.`);
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`prepare-server-data: copied → ${dest}`);
