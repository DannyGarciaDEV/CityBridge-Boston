import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleBostonChatPost } from "./bostonApiHandlers.js";

export const config = { maxDuration: 60 };

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

  const { status, json } = await handleBostonChatPost(process.env as Record<string, string | undefined>, raw);
  return res.status(status).json(json);
}
