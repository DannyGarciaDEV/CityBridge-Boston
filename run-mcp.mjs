#!/usr/bin/env node
/**
 * Cursor / MCP launcher: resolves server entry from this file's directory
 * so stdio MCP works without ${workspaceFolder} expansion in args.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, "server", "dist", "index.js");

if (!fs.existsSync(entry)) {
  console.error(
    "[boston-resource-assistant] Missing server build. Run:\n  cd server && npm install && npm run build"
  );
  process.exit(1);
}

const child = spawn(process.execPath, [entry], { stdio: "inherit", cwd: root });
child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
