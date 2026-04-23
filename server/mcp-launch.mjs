#!/usr/bin/env node
/**
 * MCP stdio launcher (keep next to this package).
 * Invoked with an absolute path so it works even when the process cwd is not the repo root.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(serverDir, "dist", "index.js");

if (!fs.existsSync(entry)) {
  console.error(
    `[boston-resource-assistant] Missing ${entry}. From repo root run:\n  npm run setup:server\n  (or: cd server && npm install && npm run build)`
  );
  process.exit(1);
}

const child = spawn(process.execPath, [entry], {
  stdio: "inherit",
  cwd: serverDir,
});
child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
