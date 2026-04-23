import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { IncomingMessage } from "node:http";
import { buffer } from "node:stream/consumers";
import { handleDeepgramTranscribePost } from "../bostonApiHandlers";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ct = (req.headers["content-type"] as string) || "audio/webm";
  let audio: Buffer;
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    audio = req.body;
  } else {
    audio = await buffer(req as IncomingMessage);
  }
  const { status, json } = await handleDeepgramTranscribePost(
    process.env as Record<string, string | undefined>,
    audio,
    ct,
  );
  return res.status(status).json(json);
}
