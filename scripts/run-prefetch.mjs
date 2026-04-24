#!/usr/bin/env node
/**
 * Run HF fetch with the interpreter Vercel installs (.vercel-python venv),
 * or plain `python3` locally. Avoids PEP 668 / "externally-managed-environment"
 * when system Python is managed by uv or the OS.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildPython } from "./resolve-build-python.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const venvPython =
  process.platform === "win32"
    ? path.join(root, ".vercel-python", "Scripts", "python.exe")
    : path.join(root, ".vercel-python", "bin", "python");

function runFetch(cmd) {
  return spawnSync(cmd, ["scripts/fetch_resources.py"], { stdio: "inherit", cwd: root, shell: false });
}

if (existsSync(venvPython)) {
  const r = runFetch(venvPython);
  process.exit(r.status ?? 1);
}
const systemPy = resolveBuildPython();
if (!systemPy) {
  console.error("run-prefetch: no venv (./.vercel-python) and no system python3/python.");
  process.exit(1);
}
const r = runFetch(systemPy);
process.exit(r.status ?? 1);
