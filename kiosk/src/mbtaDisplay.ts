/** MBTA JSON:API stop list → grouped rows for the kiosk UI */

export type MbtaAreaKey = "haymarket" | "govt" | "other";

export interface MbtaStopRow {
  id: string;
  name: string;
  description: string | null;
  municipality: string | null;
  areaKey: MbtaAreaKey;
}

export function inferAreaKey(name: string): MbtaAreaKey {
  const n = name.toLowerCase();
  if (n.includes("haymarket")) return "haymarket";
  if (n.includes("congress") && (n.includes("hanover") || n.includes("haymarket"))) return "haymarket";
  if (n.includes("congress") && (n.includes("north st") || n.includes("haymarket sta"))) return "haymarket";
  if (n.includes("surface rd") && n.includes("hanover")) return "haymarket";
  if (
    n.includes("rmv") ||
    n.includes("city hall") ||
    n.includes("faneuil") ||
    n.includes("surface rd") ||
    n.includes("government center")
  ) {
    return "govt";
  }
  return "other";
}

export function parseMbtaStopsPayload(json: unknown): MbtaStopRow[] {
  const raw = json as {
    data?: Array<{
      id: string;
      attributes?: {
        name?: string;
        description?: string | null;
        municipality?: string | null;
      };
    }>;
  };
  const rows: MbtaStopRow[] = [];
  const seen = new Set<string>();
  for (const d of raw.data ?? []) {
    const name = (d.attributes?.name ?? d.id).trim();
    if (!name || seen.has(d.id)) continue;
    seen.add(d.id);
    rows.push({
      id: d.id,
      name,
      description: d.attributes?.description?.trim() || null,
      municipality: d.attributes?.municipality ?? null,
      areaKey: inferAreaKey(name),
    });
  }
  return rows;
}

export function groupByArea(rows: MbtaStopRow[]): [MbtaAreaKey, MbtaStopRow[]][] {
  const map = new Map<MbtaAreaKey, MbtaStopRow[]>();
  for (const r of rows) {
    const list = map.get(r.areaKey) ?? [];
    list.push(r);
    map.set(r.areaKey, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  return (["haymarket", "govt", "other"] as const)
    .filter((k) => (map.get(k)?.length ?? 0) > 0)
    .map((k) => [k, map.get(k)!] as [MbtaAreaKey, MbtaStopRow[]]);
}
