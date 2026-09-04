# FRA Intelligence & Decision Support Platform — Hackathon ROADMAP

> **How to use this file:** This is our single source of truth for the hackathon. Work through it **in order** — each phase and subphase is written top-to-bottom in the order you should build it. When you finish a task, **tick its checkbox**. Every checkbox is one small task you can finish in one sitting. Tasks marked 🅰 / 🅱 / ⚡ are the ones that can run **in parallel between the two of us** — everything else is strictly linear (don't jump ahead). Decisions made in this file are final — don't re-debate them at 3 AM.
>
> ⏱️ ~10.5 hours remain. Phase 0 = ~1 h · Phase 1 = ~7 h · Phase 2 = ~2 h.

---

## The Problem (plain words)

India's **Forest Rights Act (FRA, 2006)** gives forest-dwelling families legal rights over the land they have lived on and farmed for generations. A claim's journey runs through several official stages: the village assembly (**Gram Sabha**) → the sub-divisional committee (**SDLC**) → the district committee (**DLC**) → finally a **title deed**.

The real world looks like this: **54 lakh+ claims filed, 25 lakh+ titles granted, 18 lakh+ rejected, 10 lakh+ still pending.** Officials are drowning. Duplicate claims on the same land, claimed areas that don't match official records, claims stuck at one stage for years, suspicious clusters of claims in one corner of a district — and the officials have **no tool that tells them where to look first**.

So anomalies get missed, backlogs grow, and genuine claimants wait years.

## The Solution (plain words)

One web app that answers a single question fast: **"Which claims need my attention, and why?"**

The whole product is one loop:

> **Monitor → Detect → Investigate → Explain → Prioritize**

1. **Monitor** — an interactive map of India. Districts/states show as green (normal), amber (watch), or red (high-risk).
2. **Detect** — a small analytics engine (plain math, no ML training) finds: claims stuck unusually long, claimed-vs-recorded land mismatches, near-duplicate claims, and weird geographic clusters.
3. **Investigate** — click any flagged claim to see everything: who, where, its full timeline, the exact numbers that don't match, and its spot on the map.
4. **Explain** — an AI assistant turns the structured evidence into plain-language findings — including what it _doesn't_ know. It **never invents an anomaly** and **never declares a claim valid or invalid**.
5. **Prioritize** — a ranked queue of districts/claims, with the reasons behind each ranking, and one click from the queue straight into the evidence.

**What we are NOT building:** a generic dashboard, a chatbot, or "a map with red dots". The map is the front door; the product is the evidence-backed investigation workflow behind it.

### The 3-minute demo (locked story — build toward this)

| Time      | Beat              | What happens on screen                                                        |
| --------- | ----------------- | ----------------------------------------------------------------------------- |
| 0:00–0:30 | **Problem**       | Fragmented FRA monitoring; nobody knows where attention is needed most        |
| 0:30–1:00 | **National view** | India map + key KPIs; system surfaces high-risk districts                     |
| 1:00–1:45 | **Drill down**    | Open one district → unusual patterns appear → pick its highest-priority claim |
| 1:45–2:20 | **Investigate**   | Timeline, record mismatch, spatial context, exact evidence behind the score   |
| 2:20–2:45 | **Explain**       | AI investigator: evidence-backed explanation + honest uncertainty             |
| 2:45–3:00 | **Prioritize**    | Ranked investigation queue → human-in-the-loop impact                         |

---

## Architecture — One Line

> **Vite + React 19 + TypeScript single-page app — no SSR, no backend, no database. All analytics run client-side in TypeScript over JSON files committed to the repo. Map = react-leaflet 5 + Leaflet 1.9.4 choropleth over converted datameet India GeoJSON. Exactly one Vercel serverless function (`api/investigate.ts`) proxies the Gemini free-tier LLM so the API key never reaches the browser.**

In plain words: everything heavy (the math, the data, the map) happens in the user's browser. The only thing that needs a server is the AI call — because the AI's secret key can't live in a browser. That one server function sits on Vercel.

**Deliberately excluded (don't re-litigate):** SSR/Next.js · backend server · database (JSON files are the database) · ML training or "AI detection" · authentication/RBAC · mobile app · real government integration · streaming infra.

---

## Project Summary

**Product:** An AI-powered FRA Intelligence & Decision Support Platform that helps administrators discover anomalous claim patterns, investigate the underlying evidence, and prioritize where human intervention is needed.

**Core behaviors:**

- Map-driven navigation: national → state → district, with normal/watch/high-risk coloring
- District/state KPIs that surface _where abnormal behavior is happening_, not just totals
- A 4-factor anomaly engine with one explainable risk score per claim/district
- A claim investigation workspace: identity, location, timeline, record comparison, map location, "why was this flagged?" panel
- An evidence-backed AI narrative with findings, confidence, and limitations
- A prioritized investigation queue with dominant reasons + one-click to evidence

**Tech stack (locked):**

| Concern   | Choice                                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| Framework | Vite + React 19 + TypeScript (SPA)                                                  |
| Styling   | Tailwind CSS v4 (Vite plugin)                                                       |
| Map       | react-leaflet **5.0.0** + leaflet **1.9.4** (React 19 required — pin these)         |
| Charts    | recharts                                                                            |
| AI        | Google Gemini **free tier** (flash model), called from a Vercel serverless function |
| Analytics | Pure TypeScript (IQR, Jaccard, grid binning) — runs in browser                      |
| Data      | Committed JSON files: real state aggregates + labelled synthetic claims             |
| Deploy    | Vercel (static SPA + one function) + local `vite preview` fallback                  |

**Data strategy (hybrid, locked):**

- **Real official state-level FRA numbers** (Ministry of Tribal Affairs, as of 30.06.2026) ground the national overview — no scraping needed, they're in this file (Phase 0).
- **Synthetic district/claim/event data**, clearly labelled as demo data everywhere it appears. Honest reason to cite: MoTA does not maintain district-level numbers.
- Synthetic data is **designed around 5 known scenarios**, never random noise:

| Scenario                       | Signal                                              | Demo purpose                        |
| ------------------------------ | --------------------------------------------------- | ----------------------------------- |
| **A — Processing bottleneck**  | Claim durations far above district baseline         | Temporal anomaly                    |
| **B — Land record mismatch**   | Claimed area ≠ recorded area                        | Cross-record inconsistency          |
| **C — Duplicate-like claims**  | High similarity on identifiers/location/area        | Entity/similarity reasoning         |
| **D — Spatial concentration**  | Unusual cluster in a small area                     | Geographic analysis                 |
| **E — Multi-signal hero case** | Delay + mismatch + duplicate + spatial in ONE claim | **The 3-minute investigation case** |

**Domain guardrails (locked — judges will check for violations):**

- Never call a claim "legally overdue" — say **"statistically unusual processing time"** or "workflow bottleneck".
- The AI never declares a claim valid/invalid, never recommends automatic approve/reject.
- All output is framed as **investigation prioritization for human decision-makers**.
- The system must **say when evidence is incomplete or conflicting**.
- Correct FRA right types: **IFR** (individual), **CFR** (community), **CFRR** (community forest resource), **Habitat** (PVTG). ("CLFR" is not a real type — don't use it.)
- Claim lifecycle stages for the timeline: **Gram Sabha/FRC → SDLC → DLC → Title issued**, with per-stage timestamps.

**How the judging pillars are covered:**

| Pillar (20 pts each)     | Our proof in the demo                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Innovation & Originality | GIS + anomaly intelligence + evidence-grounded AI for FRA — not another chatbot                     |
| Technical Complexity     | Normalization, temporal/statistical/spatial analysis, similarity checks, risk scoring, AI reasoning |
| UI/UX Design             | Map-driven drill-down, visual evidence, focused investigation workflow                              |
| Pitch & Demo Execution   | One 3-minute story (table above), not a feature catalogue                                           |
| Real-World Impact        | Ranked queue + human-in-the-loop; officials prioritize instead of guessing                          |

---

## Phase 0 — Foundation (~1 h)

**Goal:** Repo live on GitHub and Vercel, both datasets committed, skeleton app running for both of us.

- [ ] **Scaffold the app** — `npm create vite@latest . -- --template react-ts`, then `npm install`, commit, push to GitHub
- [ ] **Wire Tailwind v4** — `npm install tailwindcss @tailwindcss/vite`, add the plugin, and replace `src/index.css` with `@import "tailwindcss";`
- [ ] **Import the repo into Vercel** (framework preset: Vite) — deploy the empty shell now so deployment is never a "surprise" later
- [ ] 🅰 **Convert India GeoJSON** — download states + districts shapefiles from datameet, convert + simplify, commit to `data/` (commands below)
- [ ] 🅱 **Create `data/state-stats.json`** — hardcode the real state numbers from the table below + national totals + source URL
- [ ] **Skeleton views** — one page with an empty map area, a side panel placeholder, and a claims list placeholder, so 1.3–1.7 have somewhere to plug in

### Phase 0 reference

**Tailwind v4 in Vite** (this is the #1 "it doesn't work" gotcha — no `tailwind.config.js`):

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({ plugins: [react(), tailwindcss()] });
```

```css
/* src/index.css */
@import "tailwindcss";
```

**GeoJSON conversion** (one-time, ~15 min, never again):

```bash
# 1. Download from https://github.com/datameet/maps
#    States/Admin2.shp (36 records: 28 states + 8 UTs)
#    Districts/Census_2011/2011_Dist.shp (641 districts, Census 2011 names)

# 2. Convert (needs gdal/ogr2ogr) — or use mapshaper.org (drag zipped .shp → simplify → export GeoJSON)
ogr2ogr -f GeoJSON data/states.geojson States/Admin2.shp
ogr2ogr -f GeoJSON data/districts.geojson Districts/Census_2011/2011_Dist.shp

# 3. Simplify to keep each file under ~2 MB (mapshaper: "simplify 20%" / ogr2ogr -simplify)
```

> ⚠️ **Known gotchas (already researched — don't rediscover):** datameet ships **shapefiles, not GeoJSON**; district names are **Census 2011** (so Telangana is still inside Andhra Pradesh, 641 districts not ~785); license is **CC BY 4.0 — attribution required in README**. Key our synthetic data to the **exact district names we ship** and keep a small alias map for spelling variants. Use census codes (`ST_CEN_CD`, `DT_CEN_CD`) as ids, not display names.

**Real official state numbers** — hardcode these (source: Lok Sabha answer, 23 Jul 2026, data as of 30.06.2026, `https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AU756_yijOS0.pdf`):

| State          | Claims received | Titles  | Rejected | Pending |
| -------------- | --------------- | ------- | -------- | ------- |
| Andhra Pradesh | 288,409         | 228,489 | 58,395   | 1,525   |
| Assam          | 216,644         | 87,436  | 16,379   | 112,829 |
| Chhattisgarh   | 947,479         | 534,068 | 406,787  | 6,624   |
| Gujarat        | 190,242         | 103,524 | 2,331    | 84,387  |
| Jharkhand      | 110,756         | 61,970  | 28,107   | 20,679  |
| Karnataka      | 295,176         | 16,700  | 262,626  | 15,850  |
| Kerala         | 45,598          | 29,807  | 13,216   | 2,575   |
| Madhya Pradesh | 807,405         | 289,461 | 244,487  | 273,457 |
| Maharashtra    | 409,156         | 208,335 | 172,631  | 28,190  |
| Odisha         | 769,977         | 473,936 | 146,345  | 149,696 |
| Rajasthan      | 118,375         | 51,766  | 65,921   | 688     |
| Telangana      | 655,249         | 231,456 | 94,426   | 329,367 |

**National totals (as of 30.06.2026):** filed **54,01,561** · titles **25,42,359** · rejected **18,13,232** (33.6%) · pending **10,45,970**.

> District-level numbers do **not** exist officially (MoTA doesn't maintain them) — that's why districts/claims are synthetic and labelled.

---

## Phase 1 — MVP (~7 h with 2 people)

**Goal:** The full loop — Monitor → Detect → Investigate → Explain → Prioritize — works end-to-end without touching the data by hand.

**Build order:** 1.1 → 1.2 first (strictly linear — the engine needs the data shape). After 1.2 exists, split: 🅰 takes 1.3 → 1.4 → 1.5 (all UI) while 🅱 takes 1.6 → 1.7 (AI + queue). Both converge on 1.8.

---

### 1.1 — Synthetic claim data (🅱, ~45 min)

**What:** A small generator script that produces believable claim records shaped like real FRA forms, designed around scenarios A–E. Run once, commit the output — the demo never generates data live.

**Why:** If the anomaly engine and the UI both read one committed JSON file with one agreed shape, they never disagree, and the demo works offline.

- [ ] Define the `Claim` TypeScript type (schema below) in `src/lib/types.ts`
- [ ] Write `scripts/generate-data.ts` with a **seeded RNG** (same seed → same data every time)
- [ ] Generate ~300–800 claims across ~10 districts of one demo state, so charts look real but load instantly
- [ ] Embed the 5 scenarios: A (one district with slow DLC stage) · B (claims with area mismatch >30%) · C (duplicate pairs with slight spelling drift) · D (a tight geo-cluster in one tehsil) · E (**one hero claim carrying all signals**, in a designated hero district)
- [ ] Commit `data/generated/claims.json` — no runtime fetching, ever

```ts
// src/lib/types.ts — the claim shape (mirrors real FRA Form A fields)
export type RightType = "IFR" | "CFR" | "CFRR" | "HABITAT";

export interface Claim {
  claimId: string;
  receiptDate: string; // ISO date
  status: "pending" | "rejected" | "titleIssued";
  claimant: {
    name: string;
    fatherName: string;
    category: "ST" | "OTFD" | "PVTG";
  };
  location: {
    state: string;
    district: string;
    tehsil: string;
    gramPanchayat: string;
    village: string;
  };
  land: {
    khasraNo: string;
    plotNo?: string;
    forestRange: string;
    areaClaimedHa: number; // from the claim form
    areaInRecordHa: number; // from the reconciled record (used for mismatch)
  };
  rightType: RightType;
  occupancySince: string;
  stages: {
    // timestamps per stage — the timeline + processing analysis
    gsResolution?: string;
    sdlcForward?: string;
    sdlcDecision?: string;
    dlcDecision?: string;
    titleIssued?: string;
  };
  evidenceCount: number;
}

// Seeded RNG so regeneration is reproducible
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

---

### 1.2 — Anomaly engine (🅱, ~1.5 h)

**What:** A pure-TypeScript module (`src/analytics/`) that reads claims and emits anomaly signals + one explainable risk score. No ML, no training — four deterministic detectors, each a short function.

**Why:** "Analytical truth outside the LLM" is the core architecture decision. The AI only _explains_ what this module already proved.

- [ ] `processing.ts` — per-stage durations vs district baseline (IQR), per district. Flags "statistically unusual processing time", never "overdue"
- [ ] `consistency.ts` — land mismatch: `|areaClaimedHa − areaInRecordHa| / areaInRecordHa > 0.3` → flag with both values
- [ ] `duplicates.ts` — block on `village + khasraNo`, then Jaccard ≥ 0.85 on token union of name fields; also flag the trivial case: same khasra claimed by >1 claimant
- [ ] `spatial.ts` — count claims per 0.25°×0.25° grid cell; flag cells in the top decile; also rank districts by anomaly-claim density
- [ ] `score.ts` — weighted combine into `0..1` risk score, keeping a **per-signal factor list** (the UI renders this list as the "why flagged?" panel — no recompute, no AI)
- [ ] Smoke-test: a tiny script asserting each scenario A–E actually produces its expected flag

```ts
// processing.ts — IQR outlier threshold (robust to the heavy tail of delays)
function iqrThreshold(durations: number[]) {
  const s = [...durations].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  return q3 + 1.5 * (q3 - q1); // flag any stage duration above this
}

// duplicates.ts — Jaccard similarity (blocking keeps it O(n), no all-pairs blowup)
function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter); // flag pairs >= 0.85
}

// spatial.ts — grid binning, deterministic and trivially explainable
const cell = (lat: number, lon: number) =>
  `${Math.floor(lat / 0.25)}:${Math.floor(lon / 0.25)}`;

// score.ts — the factor list IS the explainability
export interface Factor {
  key: string; // "processing" | "consistency" | "duplicate" | "spatial"
  label: string; // human phrase, e.g. "Unusually slow SDLC stage"
  weight: number;
  score: number; // 0..1 per signal
  detail: string; // the exact numbers, e.g. "194 days vs district threshold 87"
}
export const riskScore = (factors: Factor[]) =>
  factors.reduce((sum, f) => sum + f.weight * f.score, 0); // 0..1
```

---

### 1.3 — Map drill-down (🅰, ~1.25 h)

**What:** The front door. National choropleth → click a state → zoom to its districts → click a district → select it and open the dashboard panel. Colors come from the same shared scale as the legend and dashboard.

- [ ] Render India states from `data/states.geojson` with a choropleth `style` function
- [ ] Shared color function: `riskColor(score)` → green/amber/red, used by map, legend, and dashboard (one source of truth)
- [ ] Hover tooltip: state name + one KPI + risk status
- [ ] Click state → `fitBounds` to that state's bounds, swap in the district layer
- [ ] Click district → select (highlight) + trigger the dashboard panel for that district
- [ ] Legend + a visible **"Demo data — synthetic records"** label (guardrail)
- [ ] Offline-safe: if map tiles fail to load, keep a plain light background — choropleth still works without the tile server

```tsx
// src/components/IndiaMap.tsx — the whole choropleth pattern
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { riskColor, districtRisk } from "../analytics/score";

<MapContainer
  center={[22.5, 79]}
  zoom={5}
  style={{ height: "100%", width: "100%" }}
>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution="© OpenStreetMap contributors"
  />
  {/* key={selectedId} forces re-style when selection changes */}
  <GeoJSON
    key={selectedId}
    data={geoJson}
    style={(feature) => ({
      fillColor: riskColor(districtRisk(feature.properties)),
      weight: 1,
      color: "#fff",
      fillOpacity: 0.7,
    })}
    onEachFeature={(feature, layer) =>
      layer.on({ click: () => onPickDistrict(feature.properties) })
    }
  />
</MapContainer>;
```

> For zoom-to-bounds: `const map = useMap()` inside a child component, then `map.fitBounds(bounds)`. Avoid Leaflet's default `Marker` icons (they break under bundlers) — choropleth + `circleMarker`/`divIcon` only.

---

### 1.4 — District dashboard (🅰, ~45 min)

**What:** The side panel next to the map, for the selected state/district. It reports KPIs _and_ calls out what's abnormal.

- [ ] KPI row: claims received · settled · pending · approval rate · median processing time · high-risk count
- [ ] Status distribution (received vs titles vs rejected vs pending) as one small chart (recharts)
- [ ] "What's unusual here" block: top anomalies in this unit (from the engine output) — this is the part that differentiates us from a generic dashboard
- [ ] Trend/summary line for processing time over recent months (synthetic)
- [ ] Everything reads from the same committed JSON + engine output — no hardcoded conclusions

---

### 1.5 — Claim investigation workspace (🅰, ~1.25 h)

**What:** The deepest screen — opened by clicking any flagged claim. This is the screen the judges will stare at, so it must be clean and complete.

- [ ] Claim identity card: name, category, village, tehsil, district, right type, status
- [ ] **Process timeline**: Gram Sabha → SDLC → DLC → Title, with real dates and per-stage durations; highlight any stage the engine flagged
- [ ] **Record comparison**: side-by-side `areaClaimedHa` vs `areaInRecordHa` with the difference called out visually
- [ ] **Claim location on the map**: small map inset with the claim + its grid cell / cluster context
- [ ] **"Why was this flagged?" panel**: renders the claim's `Factor[]` list verbatim — evidence first, AI later
- [ ] "Run AI investigation" button → calls the function from 1.6, shows a loading state

---

### 1.6 — AI investigator (🅱, ~1 h)

**What:** One Vercel serverless function that receives the claim's structured evidence JSON and returns a structured narrative (findings, reasoning, confidence, limitations, open questions). Gemini free tier.

- [ ] `api/investigate.ts` — reads `GEMINI_API_KEY` from env, calls Gemini with JSON schema output, never exposes the key
- [ ] Prompt contract (below) baked into the function — the guardrails live in the prompt
- [ ] Validate the AI's JSON with zod; on failure → deterministic **template fallback** (renders the same `Factor[]` as plain sentences) so the demo can never die on the AI
- [ ] `vercel.json` with SPA rewrites + the function route (below)
- [ ] Deploy + test from the live URL once

```ts
// api/investigate.ts — the ONLY server-side code in the project
const SYSTEM_PROMPT = `You are an FRA claim investigation assistant.
Rules you must follow:
- Only describe anomalies present in the evidence JSON you receive. Never invent one.
- Never state that a claim is valid or invalid. Never suggest automatic approval/rejection.
- Never claim a legal deadline was missed. Use phrases like "statistically unusual processing time".
- If evidence is missing or conflicting, say so explicitly.
- Output JSON only, matching the schema.`;

export const config = { maxDuration: 60 };

export default async function handler(req: Request) {
  const { evidence } = await req.json();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: JSON.stringify(evidence) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: NARRATIVE_SCHEMA, // { findings[], reasoning, confidence, limitations[], openQuestions[] }
          temperature: 0.2,
        },
      }),
    },
  );
  // ... parse + zod-validate; on any failure, return templateFallback(evidence)
}
```

```jsonc
// vercel.json — SPA rewrites + the one function
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "functions": { "api/investigate.ts": { "maxDuration": 60 } },
}
```

> **AI notes (researched):** Gemini free tier ≈ 10 requests/min, flash models only — plenty for a demo. Since 19 Jun 2026 Gemini **rejects unrestricted API keys** — create the key restricted to this project. Model: newest flash is `gemini-3.x-flash`; the stable pin is `gemini-2.5-flash`. Backup chain: Groq free tier (`GROQ_API_KEY`, OpenAI-compatible endpoint) → local Ollama if the venue has no internet.

---

### 1.7 — Prioritization queue (⚡, ~45 min)

**What:** The landing "so what" — a ranked list that closes the demo.

- [ ] Rank districts by risk score; within the hero district, rank claims
- [ ] Each row: rank, name, score, **dominant reason(s)** (top `Factor` labels), and a "Investigate →" action that deep-links to 1.5
- [ ] Recommendation copy: "Investigate first — <dominant reason>" — a _recommendation to investigate_, never a decision on the claim
- [ ] One-click from queue → claim workspace → AI narrative (the demo's final path)

---

### 1.8 — Demo wiring + completion gate (⚡, ~45 min)

**What:** Lock the demo path and walk the gate. From now on, nothing may break this flow.

- [ ] Fix the hero district + hero claim (scenario E) as the demo's drill-down target — commit its claimId in a `demo.ts` constants file
- [ ] Walk all 7 gate steps (below) start-to-finish in the built app — no console, no manual data edits
- [ ] "Demo data — synthetic" labels visible on every screen (guardrail)
- [ ] Verify the AI narrative renders on live deploy; if it fails, template fallback still renders
- [ ] Fix the top 3 visual jank items found during the walkthrough

---

## Phase 2 — Polish (~2 h)

**Goal:** A rehearsed, deployable, judge-proof demo.

### 2.1 — Demo path dry-runs (⚡, ~45 min)

- [ ] Run the 3-minute script at least 3×, timing each beat
- [ ] Pre-warm the AI narrative for the hero claim (click once ahead of the demo so the answer is cached/instant)
- [ ] Agree who speaks and who clicks; the clicker rehearses the exact path

### 2.2 — README (🅱, ~30 min)

- [ ] What the product is + the Monitor→Detect→Investigate→Explain→Prioritize loop
- [ ] How to run: `npm install && npm run dev` (+ build/deploy commands)
- [ ] **Attributions (required):** datameet maps CC BY 4.0 · MoTA state data (Lok Sabha answer URL) · OpenStreetMap tiles · react-leaflet/leaflet
- [ ] Clear statement that claim-level data is **synthetic demo data**
- [ ] Screenshot of the map + investigation screen

### 2.3 — Pitch prep (🅰, ~30 min)

- [ ] One slide/page per demo beat; end on the queue + human-in-the-loop
- [ ] Map our features to the 5 judging pillars (table above) so answers are instant
- [ ] Pre-answer the hard questions: "Is this real data?" (hybrid — state numbers real, claims synthetic) · "Did the AI make that up?" (no — evidence JSON only) · "Why not real-time?" (out of scope, 12-hour build)

### 2.4 — Deploy hardening (🅱, ~15 min)

- [ ] Set `GEMINI_API_KEY` in Vercel env (restricted key), redeploy, re-test the AI button
- [ ] Verify the fallback path once by deliberately breaking the key (then restore)
- [ ] Keep `npm run build && npx vite preview` working locally as the offline plan B

### 2.5 — Post-MVP extras (ONLY if the gate passes and time remains)

In demo-value order — stop the moment anything threatens the core path:
natural-language investigation · evidence/source drawer · explainable risk decomposition · cross-district benchmarking · anomaly clustering · claim relationship graph · intervention simulation (last).

---

## MVP Completion Gate (locked — the demo is done only when all 7 work live, no manual data edits)

- [ ] Open app → national map renders
- [ ] Click a state → district metrics appear
- [ ] Open a high-risk district → anomaly indicators visible
- [ ] Open a suspicious claim → timeline, records, and location all shown
- [ ] The exact reasons it was flagged are visible (the `Factor[]` panel)
- [ ] Run AI investigator → evidence-backed explanation **with limitations**
- [ ] Return to the priority queue → case is ranked for human investigation

---

## Risks & Mitigations

| Risk                                                    | Why it's non-obvious                                                                           | Mitigation                                                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Gemini rejects the API key**                          | Unrestricted keys have been rejected since 19 Jun 2026 — a brand-new key fails mysteriously    | Create a project-restricted key; keep Groq as backup; template fallback renders the evidence regardless                             |
| **AI quota exhausted mid-demo**                         | Free tier ≈ 10 req/min; a judge re-clicking the button could hit it                            | Pre-warm/cache the hero narrative; template fallback means the demo never hangs                                                     |
| **Campus Wi-Fi dies**                                   | Everything is static EXCEPT the AI call + map tiles                                            | Choropleth renders without tiles (plain background); local `vite preview` as plan B; AI degrades to template                        |
| **GeoJSON rabbit hole**                                 | datameet is shapefile-first, 641 Census-2011 districts, Telangana inside AP, ~16 MB shapefiles | One-time `ogr2ogr` + mapshaper in Phase 0 (budget 15 min, already scripted above); key data to shipped names; census-code ids       |
| **react-leaflet breaks at install**                     | v5 requires React 19; Leaflet's default marker icons break under bundlers                      | Pin `react-leaflet@5` + `leaflet@1.9.4` + React 19; use choropleth/`circleMarker`/`divIcon` only; import `leaflet/dist/leaflet.css` |
| **Anomaly engine becomes "ML"**                         | Temptation to add sklearn-style magic eats hours and violates the no-training scope            | Locked: IQR + Jaccard + grid binning + weighted score only; smoke tests assert scenarios A–E                                        |
| **Risk score looks arbitrary**                          | A bare 0–1 number invites "how did you compute that?"                                          | Every score carries its `Factor[]`; the UI renders the list verbatim; no AI in the scoring path                                     |
| **Synthetic data looks fake or gets mistaken for real** | Judges may challenge either way                                                                | Real state numbers for the overview; synthetic records labelled on every screen; README states it plainly                           |
| **Wrong FRA vocabulary**                                | "CLFR", "overdue", "verify claim" — small words, big credibility hits with expert judges       | Use the locked taxonomy (IFR/CFR/CFRR/Habitat) and guardrail phrasing; prompt contract enforces it for the AI                       |
| **District name collisions**                            | Same name in multiple states (e.g., Aurangabad) silently breaks joins                          | Join on census codes + state-qualified keys, never display names                                                                    |
| **Vercel function cold start**                          | First AI call in a while can take seconds                                                      | Hobby limit is 300 s — fine; show a loading state; pre-warm before the demo                                                         |

---

## Project Structure

```
averis-fra/
├── index.html · vite.config.ts · package.json
├── vercel.json                  # SPA rewrites + api/ function config
├── api/
│   └── investigate.ts           # the ONLY server code: LLM proxy (Gemini)
├── scripts/
│   └── generate-data.ts         # seeded synthetic data generator (run once, commit output)
├── data/
│   ├── states.geojson           # converted from datameet (CC BY 4.0)
│   ├── districts.geojson        # Census 2011 (CC BY 4.0)
│   ├── state-stats.json         # real MoTA aggregates (30.06.2026)
│   └── generated/
│       └── claims.json          # synthetic claims (scenarios A–E), committed
└── src/
    ├── lib/types.ts             # Claim, Factor, RiskScore, RightType
    ├── analytics/               # THE analytical truth (no AI here)
    │   ├── processing.ts · consistency.ts · duplicates.ts · spatial.ts · score.ts
    ├── components/
    │   ├── IndiaMap.tsx         # choropleth + drill-down
    │   ├── Dashboard.tsx        # KPIs + anomaly callouts
    │   ├── Investigation.tsx    # timeline, record compare, why-flagged, AI button
    │   ├── Queue.tsx            # prioritization
    │   └── EvidencePanel.tsx    # renders Factor[] verbatim
    └── App.tsx                  # routing between views (map ⇄ investigation)
```

**Key dependencies (pinned):** `react@19` · `react-leaflet@5.0.0` · `leaflet@1.9.4` · `tailwindcss@4` (+ `@tailwindcss/vite`) · `recharts` · `zod` (AI output validation).

## Key References

- MoTA FRA page: `https://tribal.nic.in/fra.aspx`
- State-wise data (LS answer, 30.06.2026): `https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AU756_yijOS0.pdf`
- datameet India maps: `https://github.com/datameet/maps` · download: `https://projects.datameet.org/maps/`
- react-leaflet docs: `https://react-leaflet.js.org/`
- Gemini free tier limits + structured output: `https://ai.google.dev/gemini-api/docs/rate-limits` · `https://ai.google.dev/gemini-api/docs/structured-output`
- Locked scope source of truth: `reference/locked scope.pdf`
