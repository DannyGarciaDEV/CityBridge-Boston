const MBTA_BASE = "https://api-v3.mbta.com";

export interface MbtaStopSummary {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

export async function fetchNearbyStops(
  lat: number,
  lon: number,
  radiusDegrees = 0.02,
  apiKey?: string
): Promise<{ stops: MbtaStopSummary[]; request_url: string }> {
  const params = new URLSearchParams({
    "filter[latitude]": String(lat),
    "filter[longitude]": String(lon),
    "filter[radius]": String(radiusDegrees),
    "page[limit]": "8",
    sort: "distance",
  });
  const request_url = `${MBTA_BASE}/stops?${params.toString()}`;
  const headers: Record<string, string> = { Accept: "application/vnd.api+json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(10_000)
      : undefined;

  const res = await fetch(request_url, { headers, signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MBTA API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data: Array<{
      id: string;
      attributes: {
        name?: string;
        latitude?: number;
        longitude?: number;
        description?: string;
      };
    }>;
  };

  const stops: MbtaStopSummary[] = (json.data ?? []).map((d) => ({
    id: d.id,
    name: d.attributes?.name ?? null,
    latitude: d.attributes?.latitude ?? null,
    longitude: d.attributes?.longitude ?? null,
    description: d.attributes?.description ?? null,
  }));

  return { stops, request_url };
}
