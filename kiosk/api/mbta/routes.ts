import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Proxies GET /api/mbta/routes?... → MBTA v3 `/routes` (e.g. filter[stop]=… for lines at a stop).
 */
export const config = { maxDuration: 25 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ errors: [{ detail: "Method not allowed" }] });
  }

  const key = process.env.MBTA_API_KEY?.trim();
  const u = req.url ?? "";
  const qsi = u.indexOf("?");
  const qs = qsi >= 0 ? u.slice(qsi + 1) : "";
  const url = `https://api-v3.mbta.com/routes${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = { Accept: "application/vnd.api+json" };
  if (key) headers["x-api-key"] = key;

  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/vnd.api+json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ errors: [{ detail: String(e) }] });
  }
}
