// api/investigate.ts
// ─────────────────────────────────────────────────────────────
// THE ONLY server-side code in the project.
//
// Vercel serverless function — receives a claim's structured
// evidence, calls Gemini to produce an investigation narrative,
// validates it with zod, and falls back to a deterministic
// template if Gemini fails or is unavailable.
//
// Person B owns this file. Person A calls it via:
//   POST /api/investigate
//   Body: { evidence: { claim: Claim, factors: Factor[] } }
//
// Guaranteed response shape (whether AI or fallback):
//   { findings, reasoning, confidence, limitations,
//     openQuestions, isFallback }
// ─────────────────────────────────────────────────────────────

import type { EvidencePayload, InvestigationResult } from "./types";
import type { Factor } from "../src/lib/types";

// ── Vercel function config ────────────────────────────────────
export const config = { maxDuration: 60 };

// ── FRA guardrail system prompt ───────────────────────────────
// These rules are baked into the function, not the client.
// They cannot be bypassed by a user editing the frontend.
const SYSTEM_PROMPT = `You are an FRA (Forest Rights Act) claim investigation assistant helping officials prioritise claims for human review.

Rules you MUST follow — no exceptions:
1. Only describe anomalies that are present in the evidence JSON you receive. Never invent or infer an anomaly that is not backed by a Factor in the evidence.
2. Never state that a claim is valid or invalid.
3. Never suggest automatic approval or rejection of any claim.
4. Never claim that a legal deadline was missed. Use phrases like "statistically unusual processing time" or "workflow bottleneck" instead.
5. If evidence is missing or conflicting, say so explicitly in the limitations array.
6. Use correct FRA terminology: IFR (individual), CFR (community), CFRR (community forest resource), Habitat (PVTG). Do not use "CLFR".
7. Frame all output as investigation prioritisation for human decision-makers, not conclusions.
8. Output valid JSON only, exactly matching the schema provided.`;

// ── Gemini JSON output schema ─────────────────────────────────
const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: { type: "string" },
      description:
        "One bullet per anomaly signal. Each finding cites the exact numbers from the evidence.",
    },
    reasoning: {
      type: "string",
      description:
        "One paragraph explaining how the signals combine and why this claim warrants human investigation.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description:
        "AI confidence in this analysis given the available evidence.",
    },
    limitations: {
      type: "array",
      items: { type: "string" },
      description: "Missing or ambiguous data that limits the analysis.",
    },
    openQuestions: {
      type: "array",
      items: { type: "string" },
      description: "Questions a human investigator should verify next.",
    },
  },
  required: [
    "findings",
    "reasoning",
    "confidence",
    "limitations",
    "openQuestions",
  ],
};

// ── Result validator (hand-rolled — no dependencies) ─────────
// Gemini's JSON output is validated here. Keeping the function
// dependency-free removes any bundler/runtime failure surface on
// Vercel; a bad shape throws and lands in the template fallback.
function validateResult(raw: unknown): InvestigationResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Result is not an object");
  }
  const r = raw as Record<string, unknown>;

  const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((item) => typeof item === "string");

  if (!isStringArray(r.findings) || r.findings.length === 0) {
    throw new Error("findings must be a non-empty string array");
  }
  if (typeof r.reasoning !== "string" || r.reasoning.length === 0) {
    throw new Error("reasoning must be a non-empty string");
  }
  if (!["high", "medium", "low"].includes(r.confidence as string)) {
    throw new Error("confidence must be one of: high, medium, low");
  }
  if (!isStringArray(r.limitations)) {
    throw new Error("limitations must be a string array");
  }
  if (!isStringArray(r.openQuestions)) {
    throw new Error("openQuestions must be a string array");
  }

  return {
    findings: r.findings,
    reasoning: r.reasoning,
    confidence: r.confidence as InvestigationResult["confidence"],
    limitations: r.limitations,
    openQuestions: r.openQuestions,
    isFallback: false,
  };
}

// ── Deterministic template fallback ──────────────────────────
// If Gemini is unavailable / rate-limited / returns bad JSON,
// this converts the Factor[] array into plain-English sentences.
// The demo can NEVER die on the AI — this always works.
function templateFallback(evidence: EvidencePayload): InvestigationResult {
  const { claim, factors } = evidence;

  const findings: string[] = factors.map((f: Factor) => {
    switch (f.key) {
      case "processing":
        return `Processing anomaly detected: ${f.detail}. ${f.label}.`;
      case "consistency":
        return `Land record inconsistency: ${f.detail}. This warrants human verification of the original claim form.`;
      case "duplicate":
        return `Potential duplicate signal: ${f.detail}. Manual cross-referencing with related claims is recommended.`;
      case "spatial":
        return `Spatial concentration signal: ${f.detail}. This claim is in a high-density anomaly cluster.`;
      default:
        return `Anomaly detected: ${f.label}. ${f.detail}.`;
    }
  });

  const dominantFactor = [...factors].sort(
    (a, b) => b.weight * b.score - a.weight * a.score,
  )[0];

  const reasoning =
    `This ${claim.rightType} claim by ${claim.claimant.name} ` +
    `in ${claim.location.village}, ${claim.location.district} has been flagged by ` +
    `${factors.length} anomaly signal${factors.length !== 1 ? "s" : ""}. ` +
    (dominantFactor
      ? `The most significant signal is "${dominantFactor.label}" (risk contribution: ${Math.round(dominantFactor.weight * dominantFactor.score * 100)}%). `
      : "") +
    `A human investigator should review the original claim documentation before any decision.`;

  const limitations: string[] = [];
  if (!claim.geo)
    limitations.push(
      "No geospatial coordinates available for spatial verification.",
    );
  if (!claim.stages.dlcDecision)
    limitations.push(
      "DLC stage has not been reached; processing timeline is incomplete.",
    );
  if (claim.evidenceCount < 3)
    limitations.push(
      `Only ${claim.evidenceCount} supporting document(s) on record — below recommended minimum.`,
    );

  const openQuestions: string[] = [
    `Was the ${dominantFactor?.label ?? "reported anomaly"} raised during a previous review?`,
    `Are there field verification records for this claim's land parcel (Khasra ${claim.land.khasraNo})?`,
    `Has the Gram Sabha resolution been physically verified?`,
  ];

  return {
    findings:
      findings.length > 0
        ? findings
        : ["No specific anomaly details available."],
    reasoning,
    confidence: "medium",
    limitations,
    openQuestions,
    isFallback: true,
  };
}

// ── CORS headers ──────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Parse the request body ──────────────────────────────────
  let evidence: EvidencePayload;
  try {
    const body = (await req.json()) as { evidence?: EvidencePayload };
    if (
      !body.evidence ||
      !body.evidence.claim ||
      !Array.isArray(body.evidence.factors)
    ) {
      throw new Error(
        "Missing required field: evidence.claim or evidence.factors",
      );
    }
    evidence = body.evidence;
  } catch (parseErr) {
    console.error("[investigate] Bad request body:", parseErr);
    return new Response(
      JSON.stringify({ error: "Bad request: " + String(parseErr) }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  // ── Check for API key ────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No key → return fallback immediately (no error to the client)
    console.warn(
      "[investigate] GEMINI_API_KEY not set — using template fallback",
    );
    const fallback = templateFallback(evidence);
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Call Gemini ───────────────────────────────────────────────
  const model = "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Hard cap on the Gemini round-trip: if the API hangs (or is
  // throttled), we answer with the template fallback instead of
  // letting the whole function burn its maxDuration and 504.
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(45_000)
      : undefined;

  try {
    const geminiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeoutSignal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            parts: [
              {
                text:
                  `Here is the structured evidence for claim ${evidence.claim.claimId}:\n\n` +
                  JSON.stringify(evidence, null, 2),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: NARRATIVE_SCHEMA,
          temperature: 0.2, // low temperature = consistent, evidence-bound output
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
    }

    // ── Parse Gemini's response ───────────────────────────────
    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini returned empty content");

    const parsed: unknown = JSON.parse(rawText);

    // ── Validate the shape (throws → template fallback) ──────
    const result = validateResult(parsed);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Any failure (network, parse, zod) → deterministic fallback
    console.error(
      "[investigate] Gemini failed — using template fallback:",
      err,
    );
    const fallback = templateFallback(evidence);
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
