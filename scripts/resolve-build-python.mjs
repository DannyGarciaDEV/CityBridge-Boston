/**
 * Pick a `python3` or `python` on PATH. Vercel/Linux images vary; `python3` is preferred.
 * Used for creating `.vercel-python` and, when no venv exists, for run-prefetch.
 */
import { spawnSync } from "node:child_process";

const CANDIDATES = ["python3", "python"];

export function resolveBuildPython() {
  for (const cmd of CANDIDATES) {
    const r = spawnSync(
      cmd,
      ["-c", "import sys; print('.'.join(map(str, sys.version_info[:2])))"],
      { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", shell: false },
    );
    if (r.status === 0 && r.stdout?.trim()) {
      return cmd;
    }
  }
  return null;
}
