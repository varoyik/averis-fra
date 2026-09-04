// src/lib/types.ts
// ─────────────────────────────────────────────────────────────
// THE handoff contract. Every file in src/ codes against these
// names EXACTLY. Do not rename fields without telling both lanes.
// ─────────────────────────────────────────────────────────────

// ── FRA right types (locked vocabulary — no "CLFR") ──────────
export type RightType = "IFR" | "CFR" | "CFRR" | "HABITAT";

// ── One FRA claim record (mirrors real FRA Form A fields) ─────
export interface Claim {
  claimId: string;
  receiptDate: string;        // ISO date "YYYY-MM-DD"
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
    areaClaimedHa: number;    // from the claim form
    areaInRecordHa: number;   // from the reconciled record (mismatch source)
  };

  rightType: RightType;
  occupancySince: string;     // ISO date — must be before receiptDate

  stages: {
    // Per-stage timestamps — the timeline + processing analysis.
    // Only stages that have been reached are present (no nulls in JSON).
    gsResolution?: string;    // Gram Sabha / FRC resolution
    sdlcForward?: string;     // SDLC forwards the claim
    sdlcDecision?: string;    // SDLC takes a decision
    dlcDecision?: string;     // DLC takes a decision
    titleIssued?: string;     // Title deed issued
  };

  evidenceCount: number;      // number of supporting documents

  // Added for spatial analysis + map inset (not in original FRA form,
  // synthesised from district centroid + jitter during data generation)
  geo?: {
    lat: number;
    lon: number;
  };
}

// ── Anomaly signal — one entry per detector that fired ────────
// The UI renders this list verbatim as the "Why flagged?" panel.
// No AI is involved in computing or displaying it.
export interface Factor {
  key: "processing" | "consistency" | "duplicate" | "spatial";
  label: string;    // human phrase, e.g. "Unusually slow DLC stage"
  weight: number;   // 0..1  — contribution weight in the risk score
  score: number;    // 0..1  — signal strength for this factor
  detail: string;   // exact numbers, e.g. "512 days vs district threshold 143"
}

// ── Per-claim engine output ───────────────────────────────────
export interface ClaimResult {
  claimId: string;
  riskScore: number;    // 0..1 weighted sum of factors
  factors: Factor[];    // non-empty only for flagged claims
}

// ── Per-district engine output ────────────────────────────────
export interface DistrictResult {
  district: string;
  state: string;
  riskScore: number;          // 0..1 — aggregate district risk
  anomalyCount: number;       // number of flagged claims
  totalClaims: number;
  dominantFactors: Factor[];  // top 2 factor types in this district
  claimResults: ClaimResult[];
}

// ── Full engine output ────────────────────────────────────────
export interface EngineOutput {
  districts: DistrictResult[];
  // Flat list, sorted by riskScore desc — the prioritization queue
  topClaims: ClaimResult[];
}

// ── Seeded RNG (mulberry32) for the TypeScript side ───────────
// Python uses random.Random(1337). This gives the same sequence
// in TS when seeded with 1337 — used only if TS ever needs to
// reproduce the same pseudo-random sequence.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
