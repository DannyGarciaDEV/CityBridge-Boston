import bundle from "../../data/resources.json";
import { Bus, ExternalLink, MapPin, MessageCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { Lang, UiTextKey } from "./i18n";
import { t } from "./i18n";
import {
  groupByArea,
  mbtaStopVehicleKind,
  parseMbtaStopsPayload,
  parseRoutesLabels,
  type MbtaAreaKey,
  type MbtaStopRow,
  type MbtaVehicleKind,
} from "./mbtaDisplay";
import { ResourceChat, type ResourceChatHandle } from "./ResourceChat";
import type { ResourceRecord, ResourceType } from "./types";
type Category = "all" | "immigration" | "family" | "benefits" | "food" | "emergency" | "housing" | "health" | "city";

/** Beds / crisis lines: not tenant-legal or housing-search-only rows. */
const HOUSING_HELP_IDS = new Set([
  "sh-housing-stability",
  "ben-metrolist",
  "ben-homestart",
  "sh-mass-family-shelter",
  "fam-crisis-shelter",
  "fam-familyaid",
  "fam-home-little-wanderers",
]);
type TextSize = "default" | "large" | "larger";

const BOSTON_CENTER: [number, number] = [42.361145, -71.057083];

const resources = (bundle as { resources: ResourceRecord[] }).resources;
const meta = (bundle as { meta: { disclaimer: string; immigration_disclaimer: string } }).meta;

function markerColor(type: ResourceType): string {
  if (type === "immigration") return "#4338ca";
  if (type === "family") return "#b45309";
  if (type === "benefits") return "#0f766e";
  if (type === "shelter" || type === "food") return "#991b1b";
  if (type === "health") return "#1e40af";
  return "#52525b";
}

function formatResultsCount(lang: Lang, count: number): string {
  return t(lang, "resultsCount").replace("{{count}}", String(count));
}

function mbtaVehicleTextKey(kind: MbtaVehicleKind): UiTextKey {
  switch (kind) {
    case "tram":
      return "mbtaVehicleTram";
    case "subway":
      return "mbtaVehicleSubway";
    case "rail":
      return "mbtaVehicleRail";
    case "bus":
      return "mbtaVehicleBus";
    case "ferry":
      return "mbtaVehicleFerry";
    default:
      return "mbtaVehicleOther";
  }
}

function typeBadgeLabel(lang: Lang, type: ResourceType): string {
  if (type === "shelter") return t(lang, "typeShelter");
  if (type === "food") return t(lang, "typeFood");
  if (type === "health") return t(lang, "typeHealth");
  if (type === "immigration") return t(lang, "typeImmigration");
  if (type === "family") return t(lang, "typeFamily");
  return t(lang, "typeBenefits");
}

/** Keeps map center in React state from user pan/zoom only — never recenters the map. */
function MapCenterTracker({ onMoveEnd }: { onMoveEnd: (c: [number, number]) => void }) {
  const map = useMap();
  useEffect(() => {
    const report = () => {
      const ll = map.getCenter();
      onMoveEnd([ll.lat, ll.lng]);
    };
    report();
    map.on("moveend", report);
    return () => {
      map.off("moveend", report);
    };
  }, [map, onMoveEnd]);
  return null;
}

function costLine(r: ResourceRecord, lang: Lang): string {
  const cost = lang === "es" ? "Costo" : "Cost";
  const walk = r.walk_in ? (lang === "es" ? "sin cita a veces" : "walk-in sometimes") : "";
  const appt = r.appointment_required ? (lang === "es" ? "cita a menudo" : "appointment often") : "";
  return [cost + ": " + r.cost, walk, appt].filter(Boolean).join(" · ");
}

const topics: Array<{ key: Category; labelKey: UiTextKey }> = [
  { key: "all", labelKey: "allTopics" },
  { key: "emergency", labelKey: "emergency" },
  { key: "housing", labelKey: "housing" },
  { key: "food", labelKey: "food" },
  { key: "health", labelKey: "health" },
  { key: "immigration", labelKey: "immigration" },
  { key: "family", labelKey: "family" },
  { key: "benefits", labelKey: "benefits" },
  { key: "city", labelKey: "city311" },
];

function readStoredTextSize(): TextSize {
  try {
    const s = sessionStorage.getItem("boston-text-scale");
    if (s === "large" || s === "larger") return s;
  } catch {
    /* ignore */
  }
  return "default";
}

export function App() {
  const chatRef = useRef<ResourceChatHandle>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [category, setCategory] = useState<Category>("all");
  /** Map center from Leaflet moveend (user pan/zoom). Used for MBTA radius; we do not programmatically flyTo. */
  const [mapCenter, setMapCenter] = useState<[number, number]>(BOSTON_CENTER);
  const recordMapCenter = useCallback((c: [number, number]) => {
    setMapCenter(c);
  }, []);
  const [textSize, setTextSize] = useState<TextSize>(readStoredTextSize);
  const [transitGroups, setTransitGroups] = useState<[MbtaAreaKey, MbtaStopRow[]][] | null>(null);
  const [transitErr, setTransitErr] = useState<string | null>(null);
  const transitAbortRef = useRef<AbortController | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const categoryFiltered = useMemo(() => {
    const all = resources;
    if (category === "all") return all;
    if (category === "immigration") return all.filter((r) => r.type === "immigration");
    if (category === "family") return all.filter((r) => r.type === "family");
    if (category === "food") return all.filter((r) => r.type === "food");
    if (category === "benefits") return all.filter((r) => r.type === "benefits");
    if (category === "health") return all.filter((r) => r.type === "health");
    if (category === "city") return [];
    if (category === "emergency") {
      return all.filter((r) => r.type === "shelter" && !HOUSING_HELP_IDS.has(r.id));
    }
    if (category === "housing") {
      return all.filter((r) => {
        if (HOUSING_HELP_IDS.has(r.id)) return true;
        if (r.type !== "benefits") return false;
        const blob = `${r.name} ${r.services.join(" ")} ${r.eligibility}`.toLowerCase();
        return /\b(housing|rent|evict|tenant|landlord|lease|foreclosure|homelessness prevention)\b/.test(blob);
      });
    }
    return all;
  }, [category]);

  const filtered = useMemo(() => {
    const raw = searchQuery.trim().toLowerCase();
    if (!raw) return categoryFiltered;
    const tokens = raw.split(/\s+/).filter(Boolean);
    return categoryFiltered.filter((r) => {
      const hay = [
        r.name,
        r.address,
        r.hours,
        r.eligibility,
        r.services.join(" "),
        r.id,
        r.source ?? "",
        r.sourceUrl ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (tokens.length === 0) return true;
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [categoryFiltered, searchQuery]);

  useEffect(() => {
    const pct = textSize === "large" ? "112.5%" : textSize === "larger" ? "128%" : "100%";
    document.documentElement.style.fontSize = pct;
    try {
      sessionStorage.setItem("boston-text-scale", textSize);
    } catch {
      /* ignore */
    }
  }, [textSize]);

  const loadTransit = useCallback(async () => {
    transitAbortRef.current?.abort();
    const ac = new AbortController();
    transitAbortRef.current = ac;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, 12_000);

    setTransitErr(null);
    setTransitGroups(null);
    const lat = mapCenter[0];
    const lon = mapCenter[1];
    const url = new URL("/api/mbta/stops", window.location.origin);
    url.searchParams.set("filter[latitude]", String(lat));
    url.searchParams.set("filter[longitude]", String(lon));
    url.searchParams.set("filter[radius]", "0.02");
    url.searchParams.set("page[limit]", "10");
    url.searchParams.set("sort", "distance");
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/vnd.api+json" },
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = parseMbtaStopsPayload(json);
      if (rows.length === 0) {
        setTransitErr("No stops returned for this spot. Move the map and try again.");
      } else {
        const enriched = await Promise.all(
          rows.map(async (row) => {
            const rUrl = new URL("/api/mbta/routes", window.location.origin);
            rUrl.searchParams.set("filter[stop]", row.id);
            rUrl.searchParams.set("page[limit]", "40");
            try {
              const rr = await fetch(rUrl.toString(), {
                headers: { Accept: "application/vnd.api+json" },
                signal: ac.signal,
              });
              if (!rr.ok) return row;
              const rj = await rr.json();
              return { ...row, routes: parseRoutesLabels(rj) };
            } catch {
              return row;
            }
          }),
        );
        setTransitGroups(groupByArea(enriched));
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        if (timedOut) setTransitErr("Request timed out. Try again or check your network.");
        return;
      }
      setTransitErr(String(e));
    } finally {
      window.clearTimeout(timeout);
    }
  }, [mapCenter]);

  const textSizeControls: Array<{ id: TextSize; labelKey: UiTextKey }> = [
    { id: "default", labelKey: "textSizeDefault" },
    { id: "large", labelKey: "textSizeLarge" },
    { id: "larger", labelKey: "textSizeLarger" },
  ];

  const categoryCount = categoryFiltered.length;
  const searchNarrowed = Boolean(searchQuery.trim()) && categoryCount > 0 && filtered.length === 0;

  const chatTopicSummary = useMemo(() => {
    const lab = topics.find((x) => x.key === category);
    const head = lab ? t(lang, lab.labelKey) : category;
    const q = searchQuery.trim();
    return `${head} · ${formatResultsCount(lang, filtered.length)}${q ? ` · ${q}` : ""}`;
  }, [lang, category, filtered.length, searchQuery]);

  const chatResourceIds = useMemo(() => filtered.slice(0, 55).map((r) => r.id), [filtered]);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 antialiased selection:bg-sky-200/80">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-base focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {t(lang, "skipToContent")}
      </a>
      <header className="border-b border-zinc-800/20 bg-slate-800 text-white">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-wrap items-start justify-end gap-6">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">City of Boston area</p>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
                {t(lang, "title")}
              </h1>
              <p className="max-w-prose text-base leading-relaxed text-slate-200 sm:text-lg">{t(lang, "subtitle")}</p>
              <p className="text-sm text-slate-300">{t(lang, "mapIntro")}</p>
            </div>
            <div className="flex shrink-0 gap-1 rounded-md bg-slate-900/80 p-1 ring-1 ring-slate-600/80">
              {(["en", "es", "ht", "zh", "pt"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 sm:px-3.5 sm:py-2 sm:text-sm ${
                    code === lang
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-200 hover:bg-slate-700/80"
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div
            className="mt-6 flex flex-col gap-4 rounded-lg border border-slate-600/60 bg-slate-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
            aria-label="Display"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:text-sm">
                {t(lang, "textSizeLabel")}
              </p>
              <div className="flex flex-wrap gap-2">
                {textSizeControls.map(({ id, labelKey }) => {
                  const on = textSize === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTextSize(id)}
                      className={`rounded-md px-4 py-2 text-sm font-semibold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 sm:text-base ${
                        on
                          ? "bg-white text-slate-900 shadow ring-white"
                          : "bg-slate-700/50 text-slate-100 ring-slate-500/50 hover:bg-slate-600/60"
                      }`}
                    >
                      {t(lang, labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <nav
            className="mt-6 flex flex-wrap gap-2 border-t border-slate-600/50 pt-5 text-base sm:text-lg"
            aria-label="Tools"
          >
            <button
              type="button"
              onClick={loadTransit}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-md bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
            >
              <Bus className="h-5 w-5 text-slate-600 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              {t(lang, "transitHelp")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setSearchQuery("");
              }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-md bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
            >
              <MapPin className="h-5 w-5 text-slate-600 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              {t(lang, "allPins")}
            </button>
            <a
              href="https://data.boston.gov/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-md border border-slate-500 bg-transparent px-4 py-3 font-semibold text-slate-200 transition hover:bg-slate-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
            >
              {t(lang, "hub")}
              <ExternalLink className="h-4 w-4 opacity-90 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => chatRef.current?.open()}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-md bg-sky-500 px-4 py-3 font-semibold text-slate-950 shadow-sm ring-1 ring-sky-400 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
            >
              <MessageCircle className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              {t(lang, "chatOpen")}
            </button>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-10 outline-none sm:px-6 sm:py-12">
        {category === "immigration" && (
          <p
            className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-950 sm:text-lg"
            role="note"
          >
            {t(lang, "trustImmigration")}
          </p>
        )}

        <div
          className="mb-4 flex flex-wrap gap-2 rounded-md border border-zinc-200 bg-white p-2 shadow-sm"
          role="tablist"
          aria-label="Topics"
        >
          {topics.map(({ key, labelKey }) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setCategory(key);
                  setSearchQuery("");
                }}
                className={`rounded-md px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:px-4 sm:text-base ${
                  active ? "bg-slate-800 text-white shadow-sm" : "text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                {t(lang, labelKey)}
              </button>
            );
          })}
        </div>

        <div className="mb-8 rounded-md border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="resource-search">
            {t(lang, "searchLabel")}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                strokeWidth={2}
                aria-hidden
              />
              <input
                id="resource-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(lang, "searchPlaceholder")}
                autoComplete="off"
                className="w-full rounded-md border border-zinc-300 bg-zinc-50 py-2.5 pl-10 pr-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
              />
            </div>
            <p className="shrink-0 text-sm font-medium text-zinc-600" aria-live="polite">
              {formatResultsCount(lang, filtered.length)}
            </p>
          </div>
        </div>

        <div className="space-y-10">
          <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 sm:text-xl">{t(lang, "mapSectionTitle")}</h2>
            <div className="relative h-[min(380px,50vh)] min-h-[260px] overflow-hidden rounded-md border border-zinc-200 shadow-inner">
              <MapContainer center={BOSTON_CENTER} zoom={12} className="h-full w-full" style={{ background: "#f0f9ff" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapCenterTracker onMoveEnd={recordMapCenter} />
                {filtered.map((r) => (
                  <CircleMarker
                    key={r.id}
                    center={[r.location.lat, r.location.lon]}
                    radius={8}
                    pathOptions={{
                      color: markerColor(r.type),
                      fillColor: markerColor(r.type),
                      fillOpacity: 0.88,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="max-w-[260px] space-y-2 text-sm text-zinc-900">
                        <p className="font-semibold leading-snug text-zinc-950">{r.name}</p>
                        <p>
                          <span className="font-medium text-zinc-600">{t(lang, "eligibilityLabel")}: </span>
                          {r.eligibility}
                        </p>
                        {r.sourceUrl && (
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-slate-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
                          >
                            {t(lang, "sourcesLabel")}
                            <ExternalLink className="h-3 w-3" strokeWidth={2} />
                          </a>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
              <div
                className="pointer-events-none absolute inset-0 z-[690] flex items-center justify-center overflow-hidden rounded-md p-4 sm:p-6"
                aria-hidden
              >
                <p className="max-w-[min(95%,40rem)] text-balance text-center text-base font-semibold leading-snug text-slate-900/[0.07] sm:text-xl md:text-2xl rotate-[-11deg] select-none">
                  {t(lang, "detailSectionTitle")}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 sm:text-xl">{t(lang, "detailSectionTitle")}</h2>
            <div className="divide-y divide-zinc-200 border-t border-zinc-200">
              {category === "city" && (
                <article className="py-6">
                  <h3 className="font-semibold text-zinc-900">Boston 311</h3>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-700">
                    {lang === "es"
                      ? "311 es para solicitudes del servicio municipal (basura, baches, etc.). No es emergencia 911."
                      : "311 is for non-emergency city requests—missed trash, potholes, streetlights. It is not 911."}
                  </p>
                  <a
                    href="https://www.boston.gov/departments/boston-311"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
                  >
                    boston.gov/311
                    <ExternalLink className="h-3 w-3" strokeWidth={2} />
                  </a>
                </article>
              )}

              {category === "emergency" && (
                <article className="py-6">
                  <h3 className="font-semibold text-red-800">911</h3>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-red-900/90">
                    {lang === "es"
                      ? "Si hay peligro inmediato para la vida, llame al 911."
                      : "If someone is in immediate danger, call 911."}
                  </p>
                </article>
              )}

              {filtered.length === 0 && category !== "city" && (
                <p className="py-6 text-sm text-zinc-600">
                  {searchNarrowed ? t(lang, "noSearchMatches") : t(lang, "emptyCategory")}
                </p>
              )}

              {filtered.map((r) => (
                <article key={r.id} className="py-5 transition-colors hover:bg-zinc-50 sm:-mx-2 sm:rounded-md sm:px-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-600">
                      {typeBadgeLabel(lang, r.type)}
                    </span>
                    <h3 className="min-w-0 flex-1 font-semibold text-zinc-900">{r.name}</h3>
                  </div>
                  <p className="mt-3 max-w-prose text-base leading-relaxed text-zinc-800 sm:text-lg">
                    <span className="font-medium text-zinc-600">{t(lang, "eligibilityLabel")}. </span>
                    {r.eligibility}
                  </p>
                  <dl className="mt-3 space-y-1 text-base text-zinc-700 sm:text-lg">
                    <div>{r.address}</div>
                    <div>{r.hours}</div>
                    <div className="font-medium text-zinc-900">{costLine(r, lang)}</div>
                  </dl>
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
                    >
                      {t(lang, "sourcesLabel")}
                      <ExternalLink className="h-3 w-3" strokeWidth={2} />
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>

        </div>

        {(transitGroups || transitErr) && (
          <section
            className="mt-10 rounded-md border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
            aria-label="MBTA"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">MBTA</h2>
                <p className="mt-1 text-sm text-zinc-600">{t(lang, "mbtaNearYou")}</p>
              </div>
              <a
                href="https://www.mbta.com/trip-planner"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                {t(lang, "mbtaPlanTrip")}
                <ExternalLink className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-500">{t(lang, "mbtaNote")}</p>
            {transitErr && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{transitErr}</p>
            )}
            {transitGroups && (
              <div className="mt-8 space-y-8">
                {transitGroups.map(([areaKey, stops]) => (
                  <div key={areaKey}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600">
                      {areaKey === "haymarket"
                        ? t(lang, "mbtaAreaHaymarket")
                        : areaKey === "govt"
                          ? t(lang, "mbtaAreaGovt")
                          : t(lang, "mbtaAreaOther")}
                    </h3>
                    <ul className="space-y-3 border-l-2 border-zinc-300 pl-4">
                      {stops.map((s) => {
                        const vKind = mbtaStopVehicleKind(s.vehicleType);
                        return (
                          <li key={s.id} className="rounded-md border border-zinc-100 bg-zinc-50 py-2 pl-2 text-sm">
                            <p className="font-medium text-zinc-900">{s.name}</p>
                            {vKind && (
                              <p className="mt-0.5 text-xs font-medium text-sky-800">{t(lang, mbtaVehicleTextKey(vKind))}</p>
                            )}
                            {s.description && s.description !== s.name && (
                              <p className="mt-0.5 text-zinc-600">{s.description}</p>
                            )}
                            {s.municipality && (
                              <p className="mt-1 text-xs font-medium text-zinc-500">{s.municipality}</p>
                            )}
                            {s.routes.length > 0 && (
                              <div className="mt-2 border-t border-zinc-200/80 pt-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  {t(lang, "mbtaRoutesLabel")}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-zinc-700">{s.routes.join(" · ")}</p>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm leading-relaxed text-zinc-600 sm:px-6 sm:text-base">
          <p>{meta.disclaimer}</p>
          <p className="mt-4">{meta.immigration_disclaimer}</p>
          <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-800">{t(lang, "researchHint")}</p>
        </div>
      </footer>

      <ResourceChat ref={chatRef} lang={lang} topicSummary={chatTopicSummary} resourceIds={chatResourceIds} />
    </div>
  );
}
