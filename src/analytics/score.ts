// src/analytics/score.ts
// ─────────────────────────────────────────────────────────────
// Orchestrator — runs all 4 detectors, combines into one
// explainable risk score per claim and per district.
//
// The Factor[] list IS the explainability — the UI renders it
// verbatim in the "Why flagged?" panel. No AI in the scoring
// path; the AI only explains what this module already proved.
// ─────────────────────────────────────────────────────────────

import type {
  Claim,
  ClaimResult,
  DistrictResult,
  EngineOutput,
  Factor,
} from "../lib/types";
import { detectProcessingAnomalies } from "./processing";
import { detectConsistencyAnomalies } from "./consistency";
import { detectDuplicateAnomalies } from "./duplicates";
import { detectSpatialAnomalies, rankDistrictsByDensity } from "./spatial";

// ── Weights (must sum to 1.0) ─────────────────────────────────
// These match the weight fields in each detector's Factor output.
// Changing here alone won't fix things — also update detector files.
const WEIGHTS = {
  processing: 0.3,
  consistency: 0.25,
  duplicate: 0.25,
  spatial: 0.2,
} as const;

// ── Weighted risk score (0..1) ────────────────────────────────
export function riskScore(factors: Factor[]): number {
  const raw = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  return Math.round(Math.min(raw, 1) * 1000) / 1000;
}

// ── Human-readable risk band ──────────────────────────────────
export function riskBand(score: number): "normal" | "watch" | "high" {
  if (score >= 0.55) return "high";
  if (score >= 0.25) return "watch";
  return "normal";
}

// ── Colour for the choropleth map ────────────────────────────
// Theme-aligned hexes shared by the map, legend, and dashboard.
export const noDataColor = "#62666d";

export function riskColor(score: number): string {
  const band = riskBand(score);
  if (band === "high") return "#ef4444"; // risk-high
  if (band === "watch") return "#f5a623"; // risk-watch
  return "#27a644"; // risk-low
}

// ── Main engine: run all detectors + combine ──────────────────
export function runEngine(claims: Claim[]): EngineOutput {
  // Run all 4 detectors
  const processingFlags = detectProcessingAnomalies(claims);
  const consistencyFlags = detectConsistencyAnomalies(claims);
  const duplicateFlags = detectDuplicateAnomalies(claims);
  const spatialFlags = detectSpatialAnomalies(claims);

  // Per-claim: combine non-null factors into one ClaimResult
  const allClaimResults: ClaimResult[] = claims.map((claim) => {
    const factors: Factor[] = [
      processingFlags.get(claim.claimId),
      consistencyFlags.get(claim.claimId),
      duplicateFlags.get(claim.claimId),
      spatialFlags.get(claim.claimId),
    ]
      .filter((f): f is Factor => f !== null && f !== undefined)
      .sort((a, b) => b.weight * b.score - a.weight * a.score);

    return {
      claimId: claim.claimId,
      riskScore: riskScore(factors),
      factors,
    };
  });

  // Index for quick lookup
  const claimResultByid = new Map(allClaimResults.map((r) => [r.claimId, r]));

  // Per-district: aggregate
  const byDistrict = new Map<string, { claims: Claim[]; state: string }>();
  for (const c of claims) {
    const d = c.location.district;
    if (!byDistrict.has(d))
      byDistrict.set(d, { claims: [], state: c.location.state });
    byDistrict.get(d)!.claims.push(c);
  }

  const districts: DistrictResult[] = [];

  for (const [district, { claims: dClaims, state }] of byDistrict.entries()) {
    const claimResults = dClaims
      .map((c) => claimResultByid.get(c.claimId)!)
      .sort((a, b) => b.riskScore - a.riskScore);

    const flagged = claimResults.filter((r) => r.factors.length > 0);
    const anomalyCount = flagged.length;

    // District risk = average of top-10 claim scores (or all if fewer)
    const top10 = claimResults.slice(0, 10);
    const districtScore =
      top10.length > 0
        ? Math.round(
            (top10.reduce((s, r) => s + r.riskScore, 0) / top10.length) * 1000,
          ) / 1000
        : 0;

    // Dominant factors: most common factor keys among flagged claims
    const factorCounts = new Map<string, number>();
    for (const r of flagged) {
      for (const f of r.factors) {
        factorCounts.set(f.key, (factorCounts.get(f.key) ?? 0) + 1);
      }
    }
    const dominantFactors: Factor[] = [...factorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([key, count]) => ({
        key: key as Factor["key"],
        label: factorKeyLabel(key as Factor["key"]),
        weight: WEIGHTS[key as keyof typeof WEIGHTS],
        score: count / dClaims.length,
        detail: `${count} of ${dClaims.length} claims in ${district}`,
      }));

    districts.push({
      district,
      state,
      riskScore: districtScore,
      anomalyCount,
      totalClaims: dClaims.length,
      dominantFactors,
      claimResults,
    });
  }

  // Sort districts by risk score descending
  districts.sort((a, b) => b.riskScore - a.riskScore);

  // Top claims across all districts, sorted by risk score
  const topClaims = allClaimResults
    .filter((r) => r.factors.length > 0)
    .sort((a, b) => b.riskScore - a.riskScore);

  return { districts, topClaims };
}

// ── Convenience: look up one district's result ────────────────
export function districtRisk(
  districtName: string,
  output: EngineOutput,
): number {
  return (
    output.districts.find((d) => d.district === districtName)?.riskScore ?? 0
  );
}

// ── Factor key → human label ──────────────────────────────────
function factorKeyLabel(key: Factor["key"]): string {
  switch (key) {
    case "processing":
      return "Workflow bottleneck";
    case "consistency":
      return "Land record mismatch";
    case "duplicate":
      return "Near-duplicate claims";
    case "spatial":
      return "Geographic concentration";
  }
}

// Re-export so UI can import from one place
export { rankDistrictsByDensity };
