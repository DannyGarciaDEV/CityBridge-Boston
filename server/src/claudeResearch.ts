/**
 * Claude (Anthropic Messages API) for draft Boston-area service research.
 * Outputs must be treated as unverified until checked against official sites.
 */

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const SYSTEM = `You are a careful research assistant for people in Boston, Massachusetts.

Rules:
- Prioritize official and primary sources: https://data.boston.gov/, boston.gov, mass.gov, MBTA, state agencies, and established nonprofits with public program pages.
- Give practical steps (who to call, what to bring, typical hours if known from public pages).
- Clearly separate FACTS (with source name + URL if you have one) from GENERAL GUIDANCE.
- Never give individualized legal advice. For immigration, say they must speak to a qualified attorney or legal services org.
- If you are uncertain, say so and suggest how to verify (call 311, visit a city page, etc.).
- Respond in the user's requested language when they ask in a language other than English.

Format your answer as structured markdown with headings: Summary, Suggested next steps, Sources to verify (URLs).`;

export async function bostonResearchWithClaude(query: string, language: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment to use boston_research_claude."
    );
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `User language preference (ISO-ish code): ${language}\n\nQuestion or situation:\n${query}`,
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${raw.slice(0, 500)}`);
  }
  const json = JSON.parse(raw) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  if (!text) throw new Error("Empty response from Claude");
  return text;
}
