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
- **Data flow (Vercel production):** Browser → **serverless** `/api/*` → **`resources.snapshot.json`** (HF pull at build, then copied next to the function) → same Anthropic / Deepgram / MBTA logic. Works with **Root Directory `./`** (root `vercel.json` + thin `api/*.ts` re-exports) or **Root Directory `kiosk`** (`kiosk/vercel.json`).  
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
git clone https://github.com/DannyGarciaDEV/CityBridge-Boston
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

### You must clear the Vercel “Install Command” override (critical)

If the build log shows this exact line, your **project** is not using the repo’s config — a **custom Install Command** is saved in the dashboard and **replaces** `kiosk/vercel.json` / root `vercel.json`:

`npm install && cd .. && python3 -m pip install --user -q -r requirements.txt`

1. Vercel → your project → **Settings** → **Build & Development**  
2. **Install Command** → click **“Override”** to turn it **off**, or set it to the default / **empty** so the **Root Directory** + `vercel.json` apply.  
3. **Build Command** should also be **not** overridden, unless you paste the value from the Option A/B list below.  
4. **Redeploy** after saving. The install line must be only **`npm install`** when **Root Directory** is **`kiosk`**, or **`npm install && npm run install:kiosk`** when the root is **`./`** (see your chosen option below).

`kiosk/package.json` has a **`postinstall`** that runs **`vercel-python-setup`**, so a plain **`npm install`** in `kiosk/` is enough (no `pip` on the system Python).

---

You can deploy in **either** layout. Pick one and set **Root Directory** in the Vercel project accordingly.

### Option A — Easiest showcase (Root Directory `./`)

Leave the project root as **`./`** (default when you import the Git repo). **Do not** pick the **Python** framework preset—this app is **Vite (static) + Node serverless**.

1. Vercel reads **`vercel.json`** at the repo root.  
2. **`installCommand`** is **`npm install && npm run install:kiosk`**; **`kiosk`**’s **`postinstall`** creates **`.vercel-python`** and installs **`requirements.txt`** (no `pip --user`), and root **`npm install`** brings in **`@vercel/node`** for repo-root **`api/*.ts`**.  
3. **`buildCommand`** is **`npm run vercel-build`**: **`node scripts/run-prefetch.mjs`**, snapshot copy + **`api/resources.snapshot.json`**, then **`npm run build --prefix kiosk`**.  
4. Static output is **`kiosk/dist`**; API routes are the thin **`api/*.ts`** files that re-export **`kiosk/api/*`**. Chat bundles the snapshot via **`includeFiles`**.  
5. **Node:** use **20** or **22** (see **`engines`** in **`package.json`**). **Framework preset:** None / Other — not “Python”.

**Local dry-run (same as Vercel build):** `npm run install:vercel` then **`npm run vercel-build`**.

### Option B — Kiosk as root (Root Directory `kiosk`) — set Install to `npm install` only

Vercel should use **`kiosk/vercel.json`**: **`installCommand`:** **`npm install`** ( **`postinstall`** runs **Python** setup), **`buildCommand`:** **`node ./scripts/vercel-build-data.mjs && npm run build`**. If you set **Install** to the old `pip install --user` string in the dashboard, the deploy **will** fail; clear that override (see the **critical** steps at the top of this section).

### Shared: API routes and env

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

If the Hugging Face dataset is **private**, add whatever **`fetch_resources.py`** expects (e.g. **`HF_TOKEN`**) in Vercel **Environment Variables** so the build can pull `data/resources.json`.

**`externally-managed-environment` / `pip install --user` errors:** never install HF deps onto the system Python. This repo uses **`node scripts/vercel-python-setup.mjs`** during Vercel **install** to create **`.vercel-python`** and run **`pip install -r requirements.txt` only inside that venv**. **`npm run prefetch`** uses **`node scripts/run-prefetch.mjs`** (venv if present, else **`python3`**).

**Vercel still runs `pip install --user`:** your project likely has a **custom Install Command** in the dashboard that overrides `vercel.json`. Open **Project → Settings → Build & Development Settings** and clear **Install Command** (and **Build Command** if overridden) so **Root Directory** + **`vercel.json`** control the build.

**Security / polish included:** response security headers in `vercel.json`, SPA **`rewrites`** in both root and `kiosk/vercel.json` (client routes, `/api/*` unchanged), chat function **maxDuration** 60s, React **error boundary** for client crashes, shared **`bostonApiHandlers`** so dev and prod use the same chat logic.

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
