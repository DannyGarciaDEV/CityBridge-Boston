#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadBenefitsContent, loadResources, preloadData } from "./data.js";
import { haversineMeters } from "./geo.js";
import { resolveIntent } from "./intent.js";
import { bostonResearchWithClaude } from "./claudeResearch.js";
import { fetchNearbyStops } from "./mbta.js";
import type { ResourceRecord, ResourceType } from "./types.js";

const server = new Server(
  { name: "boston-resource-assistant", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {} } }
);

function normalizeLang(lang: string): "en" | "es" | "ht" | "zh" | "pt" {
  const l = lang.toLowerCase();
  if (l.startsWith("es")) return "es";
  if (l.startsWith("ht")) return "ht";
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("pt")) return "pt";
  return "en";
}

function filterResources(
  all: ResourceRecord[],
  type: ResourceType,
  predicate?: (r: ResourceRecord) => boolean
): ResourceRecord[] {
  return all.filter((r) => r.type === type && (predicate ? predicate(r) : true));
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const bundle = await loadResources();
  return {
    resources: [
      {
        uri: "boston://resources/curated",
        name: "Curated Boston-area service records (MVP)",
        mimeType: "application/json",
        description: bundle.meta.data_policy,
      },
      {
        uri: "boston://benefits/copy",
        name: "Multilingual benefits explainer snippets (SNAP/WIC/cash)",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri === "boston://resources/curated") {
    const bundle = await loadResources();
    return {
      contents: [
        {
          uri: req.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(bundle, null, 2),
        },
      ],
    };
  }
  if (req.params.uri === "boston://benefits/copy") {
    const b = await loadBenefitsContent();
    return {
      contents: [
        {
          uri: req.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(b, null, 2),
        },
      ],
    };
  }
  throw new Error(`Unknown resource: ${req.params.uri}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_benefits_info",
      description:
        "Plain-language SNAP/WIC/cash assistance orientation with eligibility caveats (not a determination).",
      inputSchema: {
        type: "object",
        properties: {
          program: { type: "string", enum: ["snap", "wic", "cash"] },
          language: { type: "string", enum: ["en", "es", "ht", "zh", "pt"] },
        },
        required: ["program", "language"],
      },
    },
    {
      name: "find_immigration_help",
      description:
        "Lists nearby immigration/legal aid style entries from the curated official-public-aligned dataset. Never legal advice.",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "object",
            properties: { lat: { type: "number" }, lon: { type: "number" } },
            required: ["lat", "lon"],
          },
          language: { type: "string", enum: ["en", "es", "ht", "zh", "pt"] },
        },
        required: ["location", "language"],
      },
    },
    {
      name: "family_support_search",
      description:
        "Finds family/child services filtered by need and age band; emphasizes eligibility and intake rules.",
      inputSchema: {
        type: "object",
        properties: {
          need: { type: "string", enum: ["childcare", "diapers", "school help"] },
          child_age: { type: "string", enum: ["0-5", "5-12", "teens"] },
        },
        required: ["need", "child_age"],
      },
    },
    {
      name: "resolve_service_intent",
      description:
        "Maps colloquial phrases ('I can't afford food', 'help with papers') to resource pathways and suggested tools.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
    {
      name: "get_transit_near",
      description:
        "Find MBTA stops near a coordinate using the public V3 JSON:API (https://api-v3.mbta.com). Optional MBTA_API_KEY env for higher limits.",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "object",
            properties: { lat: { type: "number" }, lon: { type: "number" } },
            required: ["lat", "lon"],
          },
        },
        required: ["location"],
      },
    },
    {
      name: "boston_research_claude",
      description:
        "Uses Claude (Anthropic) to draft research on Boston services from public sources. Requires ANTHROPIC_API_KEY. Output must be verified— not legal advice.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What the resident needs (any language)." },
          language: { type: "string", enum: ["en", "es", "ht", "zh", "pt"] },
        },
        required: ["query", "language"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "get_benefits_info") {
    const program = String((args as { program: string }).program).toLowerCase() as "snap" | "wic" | "cash";
    const language = normalizeLang(String((args as { language: string }).language));
    const content = await loadBenefitsContent();
    const block = content[program]?.[language] ?? content[program]?.en;
    if (!block) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "unknown program" }) }] };
    }
    const payload = {
      program,
      language,
      ...block,
      eligibility_reminder:
        "Immigration status may affect eligibility for some federal programs. Staff decide final eligibility.",
      sources: [
        "https://www.mass.gov/snap-benefits-formerly-food-stamps",
        "https://www.mass.gov/how-to/apply-for-the-women-infants-children-wic-nutrition-program",
        "https://www.mass.gov/topics/financial-help-families",
      ],
      analyze_boston_hub: "https://data.boston.gov/",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }

  if (name === "find_immigration_help") {
    const bundle = await loadResources();
    const all = bundle.resources;
    const { location, language } = args as {
      location: { lat: number; lon: number };
      language: string;
    };
    const lang = normalizeLang(language);
    let items = filterResources(all, "immigration", (r) =>
      r.languages.map((x) => x.toLowerCase()).includes(lang)
    );
    if (items.length === 0) items = filterResources(all, "immigration");
    const ranked = [...items].sort(
      (a, b) =>
        haversineMeters(location, a.location) - haversineMeters(location, b.location)
    );
    const payload = {
      disclaimer: bundle.meta.immigration_disclaimer,
      not_legal_advice: true,
      language_requested: lang,
      results: ranked.map((r) => ({
        id: r.id,
        name: r.name,
        distance_m: Math.round(haversineMeters(location, r.location)),
        eligibility: r.eligibility,
        cost: r.cost,
        walk_in: r.walk_in,
        appointment_required: r.appointment_required,
        hours: r.hours,
        address: r.address,
        services: r.services,
        sourceUrl: r.sourceUrl,
      })),
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }

  if (name === "family_support_search") {
    const bundle = await loadResources();
    const all = bundle.resources;
    const { need, child_age } = args as { need: string; child_age: string };
    const fam = filterResources(all, "family");
    const wicLike = filterResources(all, "benefits").filter((r) =>
      r.services.join(" ").toLowerCase().includes("wic")
    );
    const age = child_age;
    const filtered = fam.filter((r) => {
      if (!r.age_range) return true;
      if (age === "0-5") return r.age_range.includes("0-5") || r.age_range === "0-5";
      if (age === "5-12") return r.age_range.includes("5-12") || r.age_range === "5-12";
      if (age === "teens") return r.age_range.toLowerCase().includes("teen");
      return true;
    });

    const needMatch = (r: ResourceRecord) => {
      const s = r.services.join(" ").toLowerCase();
      if (need === "childcare") return s.includes("childcare") || s.includes("early");
      if (need === "diapers")
        return s.includes("diaper") || s.includes("wic") || s.includes("material");
      if (need === "school help")
        return s.includes("after") || s.includes("school") || s.includes("youth");
      return true;
    };

    const base = filtered.filter(needMatch);
    const merged =
      need === "diapers" ? [...base, ...wicLike.filter((w) => !base.some((b) => b.id === w.id))] : base;

    const results = merged.map((r) => ({
      id: r.id,
      name: r.name,
      eligibility: r.eligibility,
      services: r.services,
      walk_in: r.walk_in,
      appointment_required: r.appointment_required,
      cost: r.cost,
      hours: r.hours,
      address: r.address,
      location: r.location,
      sourceUrl: r.sourceUrl,
      note:
        need === "diapers"
          ? "Diapers are often available through WIC, diaper banks, and community drives—eligibility varies."
          : undefined,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              disclaimer: bundle.meta.disclaimer,
              need,
              child_age: age,
              results,
              if_empty_try: "https://data.boston.gov/dataset",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (name === "resolve_service_intent") {
    const text = String((args as { text: string }).text);
    const out = resolveIntent(text);
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  }

  if (name === "get_transit_near") {
    const loc = (args as { location: { lat: number; lon: number } }).location;
    try {
      const { stops, request_url } = await fetchNearbyStops(loc.lat, loc.lon, 0.02, process.env.MBTA_API_KEY);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mbta_docs: "https://www.mbta.com/developers/v3-api",
                request_url,
                stops,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: String(e),
              hint: "MBTA filters can change; verify query parameters in the V3 docs.",
            }),
          },
        ],
      };
    }
  }

  if (name === "boston_research_claude") {
    const { query, language } = args as { query: string; language: string };
    const lang = normalizeLang(language);
    try {
      const text = await bostonResearchWithClaude(String(query), lang);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                disclaimer:
                  "Draft from Claude—verify every link and rule with the official program or a professional. Not legal advice.",
                language: lang,
                markdown: text,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: String(e),
              hint: "Set ANTHROPIC_API_KEY in the environment used to launch this MCP server. Optional: ANTHROPIC_MODEL.",
            }),
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  await preloadData();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
