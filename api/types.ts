// api/types.ts
// ─────────────────────────────────────────────────────────────
// Types used by the /api/investigate serverless function.
//
// These are the ONLY types in the api/ directory.
// Person A reads these to know exactly what JSON the button
// call will receive back — no surprises at integration time.
// ─────────────────────────────────────────────────────────────

// Re-export the shared domain types (read-only from src/lib)
// so the function can import them from one place.
export type { Claim, Factor } from "../src/lib/types";

// ── What Person A's frontend sends in the POST body ──────────
export interface EvidencePayload {
  claim: import("../src/lib/types").Claim;
  factors: import("../src/lib/types").Factor[];
}

// ── What this function always returns ────────────────────────
// Shape is identical whether the response came from Gemini or
// the deterministic template fallback (isFallback tells you).
export interface InvestigationResult {
  /** Human-readable anomaly descriptions, one per bullet */
  findings: string[];
  /** A single paragraph: how the signals combine */
  reasoning: string;
  /** AI's self-assessed confidence level */
  confidence: "high" | "medium" | "low";
  /** Missing or ambiguous data that limits the analysis */
  limitations: string[];
  /** Things a human investigator should verify next */
  openQuestions: string[];
  /** true if Gemini failed and the template fallback was used */
  isFallback: boolean;
}
