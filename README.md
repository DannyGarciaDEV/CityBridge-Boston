# Boston Resource Kiosk AI (CityBridge Boston)

**Repository folder:** `mcp-boss`  
**Public name in the UI:** CityBridge Boston  

Kiosk web app + MCP server that help people find Greater Boston civic resources (food, shelter, health, benefits, family, immigration, 311). The **resource table** is pulled from **Hugging Face** at build time; disclaimers ship in-repo in `data/resources-meta.json`.

---

## Problem statement

People under stress often need **food, shelter, health care, benefits, or legal referrals** quickly, but information is scattered across city sites, PDFs, and nonprofit pages. Static lists are hard to search; general-purpose chatbots **hallucinate** phone numbers and hours.

**Who is affected:** residents, especially those without reliable transport or time to dig through multiple sites—**kiosk users in libraries, shelters, or community centers** bear the worst of bad UX.

**Why it matters:** wrong or missing information wastes trips and erodes trust. **Success** means someone can get **accurate, actionable next steps** in one session, grounded in **curated data**, with **plain language** and optional voice.

---

## Solution overview

This project is a **kiosk-first** web UI with:

- **Map + categories + search** for browsing structured programs  
- **Help chat** (Anthropic Claude) that must **ground** answers in a **directory snapshot** from the same dataset the map uses  
- **MCP server** so coding agents can call **tools** over the same data  
- **Hugging Face** as the **versioned source** for rows (`drixo/resources-boston`), merged with local `meta` for legal/disclaimer text  

**AI role:** **Core** to the chat experience—natural language in, structured citations out—but **supplementary** to the map (the map works without chat). AI is **meaningfully better** than a non-AI list because it can interpret intent, summarize steps, and speak in the visitor’s UI language—**as long as** the program appears in the snapshot sent to the model.

**Chat retrieval fix:** The snapshot is no longer “only the first 55 rows on the filtered list.” Recent **user** messages are **tokenized** (length ≥ 3, common stopwords removed); any row whose **name, id, address, hours, eligibility, or services** contains a token (e.g. `bagly` → **BAGLY** / `fam-bagly`) is **prepended** to the snapshot so the model can answer by name without you having to scroll the list first.

---

## AI integration

| Layer | Technology | Why |
|--------|------------|-----|
| Chat LLM | **Anthropic Claude** (Messages API) | Strong instruction-following for grounded, multilingual replies. |
| Chat retrieval | **Keyword expansion + kiosk filter** over `resources.json` (light “RAG”) | Keeps latency and cost down vs embeddings; prioritizes **exact name/id** matches from user text. |
| Voice | **Deepgram** STT/TTS optional | Mic + “play last reply” (local + Vercel); TTS strips Markdown server-side. |
| Agents | **MCP** (`server/`) | Standard tool surface for Cursor-style clients. |
| Data | **Hugging Face `datasets`** | Reproducible pulls; CI/build run the same script as local. |

**Tradeoffs considered:** **Cost/latency** vs larger context—we cap snapshot size and expand by **keywords**, not the whole corpus in one prompt. **Accuracy** depends on dataset quality; the model is told not to invent rows not in the snapshot.

**Where AI exceeded expectations:** fast iteration on MCP schemas and Vite middleware. **Where it fell short:** you still have to **design retrieval** (e.g. BAGLY off the first page)—pure “first N rows” was a bad default and is now addressed in code.

---

## Architecture / design decisions

- **Monorepo:** `kiosk/` (Vite + React + Leaflet), `server/` (MCP), `scripts/` (HF fetch), `data/` (generated bundle + meta).  
- **Data flow (local dev chat):** Browser → Vite middleware **`/api/boston-chat`** → load **`data/resources.json`** → **`resolveContextRowsForChat`** → Claude → Markdown reply.  
- **Data flow (Vercel production):** Browser → **serverless** routes under `kiosk/api/` (`boston-chat`, `deepgram/*`, `mbta/stops`) → `api/resources.snapshot.json` (copied at `npm run build`) → same Anthropic / Deepgram / MBTA logic.  
- **Data flow (agents):** MCP client → **`server/`** tools → same JSON file.  
- **Data flow (dataset):** Hugging Face → **`scripts/fetch_resources.py`** → `data/resources.json` (gitignored).  
- **Map UX:** The map does **not** auto-pan when you change category or search (avoids “moving the person” away from where they panned).  

**MCP** was chosen to align with **Cursor / agent** workflows. **HF** was chosen for **versioned** civic tables you can update without shipping a giant git diff.

---

## What AI coding tools helped with—and where they got in the way

**Faster:** MCP boilerplate, Vite plugin routes, TypeScript types, README drafts, and fetch scripts.  

**Slower / manual:** aligning **dataset ↔ snapshot ↔ prompt**, stopping **hallucinated** contacts, and fixing **retrieval** edge cases (e.g. name search). Tools do not replace thinking through **failure modes**.

---

## Getting started / setup

```bash
git clone <YOUR_REPO_URL>
cd mcp-boss

python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt

npm run install:kiosk
npm run install:server

cp .env.example .env
# Required for chat in dev: ANTHROPIC_API_KEY
# Optional: ANTHROPIC_MODEL, MBTA_API_KEY, DEEPGRAM_API_KEY

npm run prefetch    # downloads HF dataset → writes data/resources.json
npm run dev:kiosk   # open http://localhost:5173 (Vite default)
```

**MCP (optional):**

```bash
npm run prefetch
npm run build:mcp
npm run mcp
```

**Production build:** `npm run build` (prefetch + MCP compile + kiosk build).

---

## How to tell the app is using Hugging Face data

1. **After `npm run prefetch`**, the script prints something like: `Wrote .../data/resources.json (N resources)`.  
2. **`data/resources.json` is gitignored**—if it appears only after prefetch, it came from the script, not a committed copy.  
3. **Inspect the file:** e.g. `grep -i bagly data/resources.json`—if your Hub revision includes BAGLY, it will be there; row count **N** matches what the Hub revision returned.  
4. **Chat and map** both read that same generated file in dev (`kiosk/api/bostonAssistant.ts` → `loadResourceRows`).  

To change what’s live, **update the dataset on Hugging Face**, then redeploy or run `npm run prefetch` again.

---

## Production (Vercel)

Deploy with **Root Directory = `kiosk`**. `kiosk/vercel.json` will:

1. Install Python **`datasets`** from the parent `requirements.txt`.  
2. Run **`scripts/fetch_resources.py`** → writes `../data/resources.json`.  
3. Run **`npm run build`** → **`prebuild`** copies that file to **`kiosk/api/resources.snapshot.json`** (gitignored) for serverless; Vercel **`includeFiles`** bundles it with **`api/boston-chat`**.  
4. Emit static **`dist/`** plus **Node serverless** routes:

| Route | Purpose |
|--------|---------|
| `POST /api/boston-chat` | Grounded Claude chat |
| `POST /api/deepgram/transcribe` | Speech-to-text |
| `POST /api/deepgram/speak` | TTS (Markdown stripped server-side) |
| `GET /api/mbta/stops?...` | MBTA v3 proxy (set **`MBTA_API_KEY`** in Vercel for reliability) |

**Vercel environment variables (project settings):**

- **`ANTHROPIC_API_KEY`** (required for chat)  
- **`ANTHROPIC_MODEL`** (optional)  
- **`MBTA_API_KEY`** (recommended)  
- **`DEEPGRAM_API_KEY`** / **`DEEPGRAM_TTS_MODEL`** (optional, voice)  

**Security / polish included:** response security headers in `vercel.json`, chat function **maxDuration** 60s, React **error boundary** for client crashes, shared **`bostonApiHandlers`** so dev and prod use the same chat logic.

**MCP server** is still a **separate Node process** (`npm run mcp`); it is not hosted on Vercel by this config.

---

## Demo

1. Run **`npm run prefetch`** then **`npm run dev:kiosk`**.  
2. Open the map, pick a category, or use search.  
3. Open **Help chat** and try:  
   - “Where can I get food near me?”  
   - “Tell me about BAGLY” (should find **`fam-bagly`** if that row exists in your generated JSON).  
4. Use **Play last reply** (needs `DEEPGRAM_API_KEY`) to hear TTS without Markdown noise.  

**Screenshots / video:** add your own; **Loom:** `<insert link here>`.

---

## Testing / error handling

- **Vague prompts** → system prompt steers toward safe next steps and 311/911 boundaries.  
- **Missing `ANTHROPIC_API_KEY`** → `/api/boston-chat` returns **503** with a clear JSON error.  
- **Invalid chat body** → **400**.  
- **HF fetch failure** → prefetch exits non-zero; `npm run build` fails until the dataset is reachable.  
- **Name not in Hub revision** → chat cannot cite it; update the Hub dataset.  
- **Keyword expansion** ignores very short tokens and a **stopword** list to avoid matching half the directory on words like “the”.

---

## Future improvements / stretch goals

- Optional **embeddings** for semantic search when keyword match is not enough  
- **Shelter availability** when a trustworthy feed exists  
- **Offline** bundle for flaky kiosk Wi‑Fi  

---

## Link to deployed app (optional)

Replace with your real URL when live, e.g. `https://your-app.vercel.app`.

---

## License / data

Not legal advice. Always confirm hours and eligibility with each organization. Immigration: see `data/resources-meta.json` disclaimer.
