import type { ResourceType } from "./types.js";

export interface IntentResolution {
  intents: string[];
  pathway: {
    primary_type: ResourceType | "mixed";
    suggested_tools: string[];
    notes: string;
  };
}

const patterns: Array<{ re: RegExp; intents: string[]; type: ResourceType | "mixed"; tools: string[]; note: string }> = [
  {
    re: /(can't afford food|cannot afford food|no money for food|groceries|hungry|food stamps|snap|ebt)/i,
    intents: ["afford_food"],
    type: "benefits",
    tools: ["get_benefits_info", "family_support_search"],
    note: "Food hardship often maps to SNAP/WIC screening and local food programs.",
  },
  {
    re: /(immigration|papers|asylum|visa|deport|undocumented|no papers|legal help|lawyer)/i,
    intents: ["immigration_help"],
    type: "immigration",
    tools: ["find_immigration_help"],
    note: "Immigration questions should route to legal providers with clear non-advice disclaimers.",
  },
  {
    re: /(childcare|daycare|diapers|baby|kids?|school help|after[- ]school|teen)/i,
    intents: ["family_support"],
    type: "family",
    tools: ["family_support_search"],
    note: "Family navigation spans childcare, material aid, and youth programs—ask age and need.",
  },
  {
    re: /(wic|pregnant|infant|baby formula)/i,
    intents: ["wic"],
    type: "benefits",
    tools: ["get_benefits_info", "family_support_search"],
    note: "WIC is tightly eligibility-gated; emphasize screening and what documents help.",
  },
  {
    re: /(cash assistance|tafdc|eaedc|dtf|benefits office)/i,
    intents: ["cash_assistance"],
    type: "benefits",
    tools: ["get_benefits_info"],
    note: "Cash programs have strict immigration and work rules—be explicit about uncertainty.",
  },
  {
    re: /(shelter|homeless|evict|housing emergency)/i,
    intents: ["housing_emergency"],
    type: "shelter",
    tools: ["family_support_search"],
    note: "Shelter access is eligibility-heavy; pair map results with intake guidance.",
  },
];

export function resolveIntent(userText: string): IntentResolution {
  const intents = new Set<string>();
  const tools = new Set<string>();
  let type: ResourceType | "mixed" = "mixed";
  let note = "Use plain language confirmations; always show eligibility caveats.";

  for (const p of patterns) {
    if (p.re.test(userText)) {
      p.intents.forEach((i) => intents.add(i));
      p.tools.forEach((t) => tools.add(t));
      type = p.type;
      note = p.note;
    }
  }

  if (intents.size === 0) {
    intents.add("unknown");
    tools.add("find_immigration_help");
    tools.add("family_support_search");
    tools.add("get_benefits_info");
    note = "No strong match—ask a short clarifying question (food, housing, kids, papers, benefits).";
  }

  return {
    intents: [...intents],
    pathway: {
      primary_type: type,
      suggested_tools: [...tools],
      notes: note,
    },
  };
}
