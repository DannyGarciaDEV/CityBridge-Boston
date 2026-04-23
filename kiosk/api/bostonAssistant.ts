/**
 * Server-only helpers for the Boston resource chat (Anthropic + Deepgram).
 * Imported from the Vite dev/preview plugin — not bundled into the client.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SNAPSHOT_PATH = path.join(__dirname, "resources.snapshot.json");
const REPO_DATA_PATH = path.resolve(__dirname, "../../data/resources.json");

function resolveResourcesJsonPath(): string {
  const envPath = process.env.RESOURCES_JSON_PATH?.trim();
  if (envPath && existsSync(envPath)) return envPath;
  // Repo-root Vercel deploy: snapshot copied to /api/resources.snapshot.json
  const rootApiSnap = path.join(process.cwd(), "api", "resources.snapshot.json");
  if (existsSync(rootApiSnap)) return rootApiSnap;
  const kioskApiSnap = path.join(process.cwd(), "kiosk", "api", "resources.snapshot.json");
  if (existsSync(kioskApiSnap)) return kioskApiSnap;
  if (existsSync(SNAPSHOT_PATH)) return SNAPSHOT_PATH;
  const rootData = path.join(process.cwd(), "data", "resources.json");
  if (existsSync(rootData)) return rootData;
  return REPO_DATA_PATH;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Short tokens skipped when keyword-expanding chat context (avoid matching half the directory). */
const CHAT_QUERY_STOPWORDS = new Set([
  "the", "and", "for", "are", "you", "can", "not", "how", "what", "where", "when", "who", "why", "with", "this", "that", "from", "have", "has", "was", "were", "been", "being", "will", "your", "our", "any", "all", "get", "got", "need", "help", "want", "know", "tell", "about", "into", "just", "like", "some", "out", "near", "here", "there", "they", "them", "she", "her", "his", "him", "its", "may", "but", "use", "see", "way", "day", "now", "new", "old", "los", "las", "una", "por", "como", "para", "que", "estoy", "tengo", "necesito",
]);

export type ResourceRow = {
  id: string;
  type: string;
  name: string;
  address: string;
  hours: string;
  eligibility: string;
  cost: string;
  services: string[];
  source?: string;
  sourceUrl?: string;
  walk_in: boolean;
  appointment_required: boolean;
};

/** Fallback when ANTHROPIC_MODEL is unset; keep in sync with .env.example. */
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_CONTEXT_CHARS = 28_000;

let resourcesLoadPromise: Promise<{ meta: Record<string, string>; resources: ResourceRow[] }> | null = null;

export async function loadResourceRows(): Promise<{ meta: Record<string, string>; resources: ResourceRow[] }> {
  resourcesLoadPromise ??= (async () => {
    const p = resolveResourcesJsonPath();
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as { meta: Record<string, string>; resources: ResourceRow[] };
  })();
  return resourcesLoadPromise;
}

export function formatResourceContext(rows: ResourceRow[]): string {
  const lines = rows.map((r) => {
    const svc = r.services.join("; ");
    const src = r.sourceUrl ? ` source:${r.sourceUrl}` : "";
    return `- [${r.id}] ${r.type} | ${r.name} | ${r.address} | hours: ${r.hours} | eligibility: ${r.eligibility} | cost: ${r.cost} | walk-in:${r.walk_in} appt:${r.appointment_required} | services: ${svc}${src}`;
  });
  let body = lines.join("\n");
  if (body.length > MAX_CONTEXT_CHARS) {
    body = body.slice(0, MAX_CONTEXT_CHARS) + "\n…(directory truncated for length; still use ids above when relevant.)";
  }
  return body;
}

export function resolveContextRows(
  all: ResourceRow[],
  ids: string[] | undefined,
  maxRows: number,
): ResourceRow[] {
  if (ids?.length) {
    const set = new Set(ids);
    const picked = all.filter((r) => set.has(r.id));
    if (picked.length) return picked.slice(0, maxRows);
  }
  return all.slice(0, Math.min(maxRows, 45));
}

function haystackForRow(r: ResourceRow): string {
  return [
    r.id,
    r.name,
    r.address,
    r.hours,
    r.eligibility,
    r.services.join(" "),
    r.source ?? "",
    r.sourceUrl ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function searchTokensFromUserMessages(messages: ChatMessage[]): string[] {
  const userTexts = messages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content.toLowerCase());
  const raw = userTexts.join(" ");
  const parts = raw.split(/[^a-z0-9]+/i).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    if (p.length < 3) continue;
    if (CHAT_QUERY_STOPWORDS.has(p)) continue;
    out.add(p);
  }
  return [...out];
}

/**
 * Builds the chat directory snapshot: keeps the kiosk's filtered `resourceIds` first,
 * then adds any rows whose text fields match tokens from recent **user** messages
 * (e.g. "BAGLY" → `fam-bagly`) so the model is not limited to the first N pins only.
 */
export function resolveContextRowsForChat(
  all: ResourceRow[],
  clientResourceIds: string[] | undefined,
  messages: ChatMessage[],
  maxRows: number,
): ResourceRow[] {
  const byId = new Map(all.map((r) => [r.id, r]));
  const out: ResourceRow[] = [];
  const seen = new Set<string>();

  const pushId = (id: string) => {
    if (out.length >= maxRows) return;
    if (seen.has(id)) return;
    const row = byId.get(id);
    if (!row) return;
    seen.add(id);
    out.push(row);
  };

  // 1) Keyword hits from recent user text (so "BAGLY" pulls `fam-bagly` even if it is not in the first map slice).
  const tokens = searchTokensFromUserMessages(messages);
  if (tokens.length) {
    for (const r of all) {
      if (out.length >= maxRows) break;
      const hay = haystackForRow(r);
      if (tokens.some((t) => hay.includes(t))) pushId(r.id);
    }
  }

  // 2) Kiosk-filtered ids (map + category context)
  for (const id of clientResourceIds ?? []) pushId(id);

  // 3) Backfill from the start of the directory if there is still room
  if (out.length < maxRows) {
    for (const r of all) {
      pushId(r.id);
      if (out.length >= maxRows) break;
    }
  }

  return out;
}

/**
 * Strip Markdown / GFM so TTS does not read asterisks, hashes, or bracket syntax aloud.
 */
export function markdownToPlainSpeech(input: string): string {
  let s = input.replace(/\r\n/g, "\n");

  // Fenced code blocks
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");

  // Images, then links (before bare brackets)
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");

  // Directory citation ids like [food-gbfb-locator] → spaced words for speech
  s = s.replace(/\[([a-z0-9]+(?:-[a-z0-9]+)*)\]/gi, (_, id: string) => id.replace(/-/g, " "));
  s = s.replace(/\[([^\]]+)\]/g, "$1");

  // HTML tags if any
  s = s.replace(/<[^>]+>/g, " ");

  // Setext underline headings
  s = s.replace(/^[-=]{2,}\s*$/gm, " ");

  // ATX headings
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Blockquotes
  s = s.replace(/^>\s?/gm, "");

  // Horizontal rules
  s = s.replace(/^[\s*_-]{3,}\s*$/gm, " ");

  // Table pipes → spaces (keep words)
  s = s.replace(/^\s*\|.*\|\s*$/gm, (line) => line.replace(/\|/g, " ").replace(/\s+/g, " ").trim());

  // List markers
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");

  // Strikethrough
  s = s.replace(/~~([^~]+)~~/g, "$1");

  // Bold / italic (repeat a few times for nested-ish patterns)
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
    s = s.replace(/__([^_]+)__/g, "$1");
  }
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/_([^_\n]+)_/g, "$1");

  // Collapse whitespace (preserve sentence breaks a bit)
  s = s.replace(/\n{2,}/g, ". ");
  s = s.replace(/\n/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

const CHAT_SYSTEM = `You are a caring, practical guide for people in Boston, Massachusetts who need community resources (food, shelter, health, immigration, family, benefits).

You MUST ground organization names, addresses, phone clues, hours, and eligibility language in the "Directory snapshot" below. The snapshot includes rows that match the resident's recent questions (search across the full directory for names, ids, and keywords—not only the first screen of the map list). If a program still does not appear in the snapshot, say you are not sure and suggest how to verify (call the organization, Boston 311 for city services, or 911 for immediate danger).
Do not invent programs, phone numbers, or eligibility rules that are not in the snapshot.
Ask only brief, practical follow-ups when they help the resident take the next step (for example, neighborhood or language). Avoid prying into private details.

Rules:
- Format every reply as Markdown (GitHub-flavored): use ## and ### headings, bold emphasis for phone numbers and key names, numbered lists for steps, bullet lists for options, and bracketed snapshot ids like [food-gbfb-locator] when citing a directory line.
- Give numbered next steps (what to do first, second, third).
- Mention specific directory lines when they match the person's need.
- Never give individualized legal advice; for immigration or court issues, tell them to contact a qualified legal aid or attorney.
- Emergencies involving immediate danger: say to call 911. Non-emergency city issues: Boston 311.
- Keep answers concise enough to read aloud in under two minutes when possible.
- Respond in the user's interface language (BCP-47 tag provided). If they write in another language, still answer in the interface language unless they clearly request a different output language.`;

export async function runBostonChat(params: {
  anthropicKey: string;
  model?: string;
  uiLangTag: string;
  topicSummary: string;
  directoryBlock: string;
  messages: ChatMessage[];
}): Promise<string> {
  const model =
    (params.model && params.model.trim()) ||
    (typeof process.env.ANTHROPIC_MODEL === "string" && process.env.ANTHROPIC_MODEL.trim()) ||
    DEFAULT_MODEL;
  const system = `${CHAT_SYSTEM}

Interface language (BCP-47): ${params.uiLangTag}
Current topic / filters on the kiosk: ${params.topicSummary}

Directory snapshot (each line is one program; bracketed id is stable):
${params.directoryBlock}`;

  const messages = params.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 800)}`);
  }
  let json: { content?: Array<{ type: string; text?: string }> };
  try {
    json = JSON.parse(raw) as { content?: Array<{ type: string; text?: string }> };
  } catch {
    throw new Error(`Anthropic: invalid JSON response (${raw.slice(0, 200)})`);
  }
  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  if (!text) throw new Error("Empty assistant message from Anthropic");
  return text.trim();
}

export async function deepgramTranscribe(params: {
  apiKey: string;
  audio: Buffer;
  contentType: string;
  mimeType?: string;
}): Promise<{ transcript: string; detectedLanguage?: string }> {
  const ct = params.mimeType || params.contentType || "audio/webm";
  const q = new URLSearchParams({
    model: "nova-2",
    detect_language: "true",
    smart_format: "true",
  });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${q}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${params.apiKey}`,
      "Content-Type": ct,
    },
    body: new Blob([new Uint8Array(params.audio)], { type: ct }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Deepgram STT ${res.status}: ${raw.slice(0, 500)}`);
  }
  let json: {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
    metadata?: { channels?: Array<{ detected_language?: string }> };
  };
  try {
    json = JSON.parse(raw) as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
      metadata?: { channels?: Array<{ detected_language?: string }> };
    };
  } catch {
    throw new Error(`Deepgram STT: invalid JSON (${raw.slice(0, 200)})`);
  }
  const transcript =
    json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  const detectedLanguage = json.metadata?.channels?.[0]?.detected_language;
  return { transcript, detectedLanguage };
}

/** Spanish has dedicated Aura voices; other UI langs use clear English TTS (still reads any script). */
export function pickTtsModel(uiLang: string, envOverride?: string): string {
  if (envOverride?.trim()) return envOverride.trim();
  if (uiLang.toLowerCase().startsWith("es")) return "aura-2-estrella-es";
  return "aura-2-thalia-en";
}

export async function deepgramSpeak(params: {
  apiKey: string;
  text: string;
  model: string;
}): Promise<Buffer> {
  let plain = markdownToPlainSpeech(params.text);
  if (!plain) {
    plain = params.text
      .replace(/#{1,6}\s*/g, " ")
      .replace(/\*{1,2}|_{1,2}/g, " ")
      .replace(/`+/g, " ")
      .replace(/[|[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const q = new URLSearchParams({ model: params.model, encoding: "mp3" });
  const res = await fetch(`https://api.deepgram.com/v1/speak?${q}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: plain.slice(0, 12_000) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deepgram TTS ${res.status}: ${err.slice(0, 500)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
