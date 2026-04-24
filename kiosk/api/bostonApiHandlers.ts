/**
 * Shared HTTP logic for Boston chat + Deepgram — used by Vite dev middleware and Vercel serverless.
 */

import {
  deepgramSpeak,
  deepgramTranscribe,
  formatResourceContext,
  loadResourceRows,
  pickTtsModel,
  resolveContextRowsForChat,
  runBostonChat,
  type ChatMessage,
} from "./bostonAssistant.js";

export type BostonApiEnv = Record<string, string | undefined>;

export type BostonChatJson = {
  messages?: ChatMessage[];
  uiLang?: string;
  uiLangTag?: string;
  topicSummary?: string;
  resourceIds?: string[];
};

export async function handleBostonChatPost(
  env: BostonApiEnv,
  rawBody: string,
): Promise<{ status: number; json: { reply?: string; error?: string } }> {
  const ak = env.ANTHROPIC_API_KEY;
  if (!ak?.trim()) {
    return {
      status: 503,
      json: { error: "Chat is not configured (missing ANTHROPIC_API_KEY on the server)." },
    };
  }

  let body: BostonChatJson;
  try {
    body = JSON.parse(rawBody) as BostonChatJson;
  } catch {
    return { status: 400, json: { error: "Invalid JSON body" } };
  }

  const messages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return { status: 400, json: { error: "messages must be non-empty and end with a user turn" } };
  }

  const trimmed = messages.slice(-14);
  const { resources, meta } = await loadResourceRows();
  const rows = resolveContextRowsForChat(resources, body.resourceIds, messages, 80);
  const directoryBlock = formatResourceContext(rows);
  const topicSummary =
    typeof body.topicSummary === "string" && body.topicSummary.trim()
      ? body.topicSummary.trim()
      : "(not specified)";
  const uiLang = typeof body.uiLang === "string" ? body.uiLang : "en";
  const uiLangTag =
    typeof body.uiLangTag === "string" && body.uiLangTag.trim()
      ? body.uiLangTag.trim()
      : uiLang === "es"
        ? "es-ES"
        : uiLang === "ht"
          ? "ht-HT"
          : uiLang === "zh"
            ? "zh-CN"
            : uiLang === "pt"
              ? "pt-BR"
              : "en-US";

  try {
    const reply = await runBostonChat({
      anthropicKey: ak,
      model: env.ANTHROPIC_MODEL,
      uiLangTag,
      topicSummary,
      directoryBlock: `DATA_POLICY: ${meta.data_policy ?? ""}\nIMMIGRATION_NOTE: ${meta.immigration_disclaimer ?? ""}\n\n${directoryBlock}`,
      messages: trimmed,
    });
    return { status: 200, json: { reply } };
  } catch (e) {
    return { status: 500, json: { error: String(e) } };
  }
}

export async function handleDeepgramTranscribePost(
  env: BostonApiEnv,
  audio: Buffer,
  contentType: string,
): Promise<{ status: number; json: { transcript?: string; detectedLanguage?: string; error?: string } }> {
  const dg = env.DEEPGRAM_API_KEY;
  if (!dg?.trim()) {
    return { status: 503, json: { error: "DEEPGRAM_API_KEY is not set." } };
  }
  try {
    const { transcript, detectedLanguage } = await deepgramTranscribe({
      apiKey: dg,
      audio,
      contentType,
    });
    return { status: 200, json: { transcript, detectedLanguage } };
  } catch (e) {
    return { status: 500, json: { error: String(e) } };
  }
}

export async function handleDeepgramSpeakPost(
  env: BostonApiEnv,
  rawBody: string,
): Promise<
  | { status: number; kind: "json"; json: { error: string } }
  | { status: number; kind: "mp3"; body: Buffer }
> {
  const dg = env.DEEPGRAM_API_KEY;
  if (!dg?.trim()) {
    return { status: 503, kind: "json", json: { error: "DEEPGRAM_API_KEY is not set." } };
  }

  let body: { text?: string; uiLang?: string };
  try {
    body = JSON.parse(rawBody) as { text?: string; uiLang?: string };
  } catch {
    return { status: 400, kind: "json", json: { error: "Invalid JSON body" } };
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return { status: 400, kind: "json", json: { error: "missing text" } };
  }
  try {
    const model = pickTtsModel(body.uiLang ?? "en", env.DEEPGRAM_TTS_MODEL);
    const mp3 = await deepgramSpeak({ apiKey: dg, text, model });
    return { status: 200, kind: "mp3", body: mp3 };
  } catch (e) {
    return { status: 500, kind: "json", json: { error: String(e) } };
  }
}
