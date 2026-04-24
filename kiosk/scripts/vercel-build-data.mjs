#!/usr/bin/env node
/**
 * When Vercel Root Directory is `kiosk/`: run HF fetch using repo-root `.vercel-python`.
 * Keeps buildCommand free of `cd ..` / fragile shell paths.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kioskDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(kioskDir, "..");
const venvPy =
  process.platform === "win32"
    ? path.join(repoRoot, ".vercel-python", "Scripts", "python.exe")
    : path.join(repoRoot, ".vercel-python", "bin", "python");

if (!existsSync(venvPy)) {
  console.error(
    "vercel-build-data: .vercel-python missing. Install step must run scripts/vercel-python-setup.mjs first.",
  );
  process.exit(1);
}

const r = spawnSync(venvPy, ["scripts/fetch_resources.py"], {
  stdio: "inherit",
  cwd: repoRoot,
  env: process.env,
});
process.exit(r.status ?? 1);
