import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDeepgramSpeakPost } from "../bostonApiHandlers.js";

export const config = { maxDuration: 45 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw =
    typeof req.body === "string"
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : JSON.stringify(req.body ?? {});

  const out = await handleDeepgramSpeakPost(process.env as Record<string, string | undefined>, raw);
  if (out.kind === "json") {
    return res.status(out.status).json(out.json);
  }
  res.setHeader("Content-Type", "audio/mpeg");
  res.status(out.status);
  res.end(out.body);
  return;
}
