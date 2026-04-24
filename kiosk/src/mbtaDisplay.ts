/** MBTA JSON:API stop list → grouped rows for the kiosk UI */

export type MbtaAreaKey = "haymarket" | "govt" | "other";

export interface MbtaStopRow {
  id: string;
  name: string;
  description: string | null;
  municipality: string | null;
  areaKey: MbtaAreaKey;
  /** MBTA `vehicle_type` on the stop resource when present (e.g. bus vs rail context). */
  vehicleType: number | null;
  /** Route long names / labels at this stop (from `/routes?filter[stop]=`). */
  routes: string[];
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
        vehicle_type?: number | null;
      };
    }>;
  };
  const rows: MbtaStopRow[] = [];
  const seen = new Set<string>();
  for (const d of raw.data ?? []) {
    const name = (d.attributes?.name ?? d.id).trim();
    if (!name || seen.has(d.id)) continue;
    seen.add(d.id);
    const vt = d.attributes?.vehicle_type;
    rows.push({
      id: d.id,
      name,
      description: d.attributes?.description?.trim() || null,
      municipality: d.attributes?.municipality ?? null,
      areaKey: inferAreaKey(name),
      vehicleType: typeof vt === "number" ? vt : null,
      routes: [],
    });
  }
  return rows;
}

/** MBTA route `type`: 0 tram, 1 subway, 2 commuter rail, 3 bus, 4 ferry — sort rail before bus for readability. */
function routeTypeSortOrder(t: number): number {
  if (t === 1) return 0;
  if (t === 0) return 1;
  if (t === 2) return 2;
  if (t === 4) return 3;
  if (t === 3) return 4;
  return 9;
}

/** Parse `/routes?filter[stop]=…` JSON:API payload → display labels (deduped, subway/rail before bus). */
export function parseRoutesLabels(json: unknown): string[] {
  const raw = json as {
    data?: Array<{
      id: string;
      attributes?: { long_name?: string; short_name?: string; type?: number };
    }>;
  };
  type Row = { id: string; label: string; sortType: number; sortKey: string };
  const acc: Row[] = [];
  for (const d of raw.data ?? []) {
    const rid = String(d.id ?? "").trim();
    if (!rid) continue;
    const long = d.attributes?.long_name?.trim();
    const short = d.attributes?.short_name?.trim();
    const label = long || short || rid;
    const sortType = d.attributes?.type ?? 99;
    acc.push({ id: rid, label, sortType, sortKey: label.toLowerCase() });
  }
  const byId = new Map<string, Row>();
  for (const r of acc) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        routeTypeSortOrder(a.sortType) - routeTypeSortOrder(b.sortType) ||
        a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: "base" }),
    )
    .map((r) => r.label);
}

/** MBTA stop `vehicle_type` (when set) — aligns with common route mode groupings. */
export type MbtaVehicleKind = "tram" | "subway" | "rail" | "bus" | "ferry" | "other";

export function mbtaStopVehicleKind(v: number | null): MbtaVehicleKind | null {
  if (v === null) return null;
  if (v === 0) return "tram";
  if (v === 1) return "subway";
  if (v === 2) return "rail";
  if (v === 3) return "bus";
  if (v === 4) return "ferry";
  return "other";
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
