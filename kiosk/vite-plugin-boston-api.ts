import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import {
  handleBostonChatPost,
  handleDeepgramSpeakPost,
  handleDeepgramTranscribePost,
} from "./api/bostonApiHandlers";

function readBody(req: IncomingMessage, limitBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > limitBytes) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function mount(middlewares: { use: (fn: unknown) => void }, env: Record<string, string>) {
  const envMap = env as Record<string, string | undefined>;

  middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? "";
    if (!url.startsWith("/api/")) return next();

    try {
      if (url.startsWith("/api/boston-chat") && req.method === "POST") {
        const raw = (await readBody(req, 512_000)).toString("utf8");
        const { status, json } = await handleBostonChatPost(envMap, raw);
        sendJson(res, status, json);
        return;
      }

      if (url.startsWith("/api/deepgram/transcribe") && req.method === "POST") {
        const ct = req.headers["content-type"] ?? "audio/webm";
        const audio = await readBody(req, 12_000_000);
        const { status, json } = await handleDeepgramTranscribePost(envMap, audio, typeof ct === "string" ? ct : "audio/webm");
        sendJson(res, status, json);
        return;
      }

      if (url.startsWith("/api/deepgram/speak") && req.method === "POST") {
        const raw = (await readBody(req, 64_000)).toString("utf8");
        const out = await handleDeepgramSpeakPost(envMap, raw);
        if (out.kind === "json") {
          sendJson(res, out.status, out.json);
          return;
        }
        res.statusCode = out.status;
        res.setHeader("Content-Type", "audio/mpeg");
        res.end(out.body);
        return;
      }
    } catch (e) {
      sendJson(res, 500, { error: String(e) });
      return;
    }

    next();
  });
}

export function bostonApiPlugin(): Plugin {
  return {
    name: "boston-api",
    configureServer(server) {
      const env = { ...process.env, ...loadEnv(server.config.mode, server.config.envDir, "") } as Record<
        string,
        string
      >;
      mount(server.middlewares as { use: (fn: unknown) => void }, env);
    },
    configurePreviewServer(server) {
      const env = { ...process.env, ...loadEnv(server.config.mode, server.config.envDir, "") } as Record<
        string,
        string
      >;
      mount(server.middlewares as { use: (fn: unknown) => void }, env);
    },
  };
}
