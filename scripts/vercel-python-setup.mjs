#!/usr/bin/env node
/**
 * Vercel / CI: create repo-root `.vercel-python` and install `requirements.txt`
 * with that venv's pip only. Never uses `pip install --user` (PEP 668 / uv-safe).
 *
 * Invoke from repo root: `node scripts/vercel-python-setup.mjs`
 * From `kiosk/` (Root Directory = kiosk): `node ../scripts/vercel-python-setup.mjs`
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildPython } from "./resolve-build-python.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvDir = path.join(repoRoot, ".vercel-python");
const venvPy =
  process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");

function run(cmd, args, cwd = repoRoot) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd, env: process.env, shell: false });
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(venvPy)) {
  const py = resolveBuildPython();
  if (!py) {
    console.error(
      "vercel-python-setup: no `python3` or `python` in PATH. Vercel Node builds must include Python — use project Root `./` and this repo’s vercel.json, or set Install Command in the Vercel dashboard to match README.",
    );
    process.exit(1);
  }
  console.log(`vercel-python-setup: creating .vercel-python (using ${py}) …`);
  run(py, ["-m", "venv", ".vercel-python"], repoRoot);
}

console.log("vercel-python-setup: upgrading pip …");
run(venvPy, ["-m", "pip", "install", "-U", "pip", "-q"], repoRoot);

const req = path.join(repoRoot, "requirements.txt");
if (!existsSync(req)) {
  console.error(`vercel-python-setup: missing ${req}`);
  process.exit(1);
}
console.log("vercel-python-setup: pip install -r requirements.txt …");
run(venvPy, ["-m", "pip", "install", "-q", "-r", "requirements.txt"], repoRoot);
