#!/usr/bin/env node
/**
 * Production build for Vercel when Root Directory is the repository root (./).
 * 1) HF → data/resources.json
 * 2) Snapshot for kiosk + root /api serverless
 * 3) Vite production build
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const dataJson = path.join(root, "data", "resources.json");
if (!existsSync(dataJson)) {
  console.error("vercel-build: run prefetch first (missing data/resources.json)");
  process.exit(1);
}

mkdirSync(path.join(root, "kiosk", "api"), { recursive: true });
const kioskSnap = path.join(root, "kiosk", "api", "resources.snapshot.json");
copyFileSync(dataJson, kioskSnap);
console.log("vercel-build: snapshot → kiosk/api/resources.snapshot.json");

mkdirSync(path.join(root, "api"), { recursive: true });
const rootSnap = path.join(root, "api", "resources.snapshot.json");
copyFileSync(dataJson, rootSnap);
console.log("vercel-build: snapshot → api/resources.snapshot.json");

run("npm", ["run", "build", "--prefix", "kiosk"]);
