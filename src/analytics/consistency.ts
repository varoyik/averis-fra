// src/analytics/consistency.ts
// ─────────────────────────────────────────────────────────────
// Detector 2 — Land record mismatch (Scenario B)
//
// Formula: |areaClaimedHa − areaInRecordHa| / areaInRecordHa > 0.30
//
// A mismatch means the area on the claim form doesn't match the
// area found in the official land record. Could be an error,
// could be intentional — the engine flags it, a human decides.
// ─────────────────────────────────────────────────────────────

import type { Claim, Factor } from "../lib/types";

// ── Mismatch threshold (30 %) ─────────────────────────────────
const MISMATCH_THRESHOLD = 0.30;

// ── Main export ───────────────────────────────────────────────
// Returns a map of claimId → Factor | null.
// null = no mismatch on this claim.
export function detectConsistencyAnomalies(
  claims: Claim[]
): Map<string, Factor | null> {
  const result = new Map<string, Factor | null>();

  for (const claim of claims) {
    const { areaClaimedHa, areaInRecordHa } = claim.land;

    // Guard: both values must be positive
    if (
      !areaClaimedHa ||
      !areaInRecordHa ||
      areaInRecordHa <= 0 ||
      areaClaimedHa <= 0
    ) {
      result.set(claim.claimId, null);
      continue;
    }

    const ratio = Math.abs(areaClaimedHa - areaInRecordHa) / areaInRecordHa;

    if (ratio > MISMATCH_THRESHOLD) {
      // Score: 0.3 → ~0.1,  1.0 mismatch → 1.0, capped at 1
      const rawScore = Math.min(ratio / 1.0, 1);

      const direction =
        areaClaimedHa > areaInRecordHa ? "over-claimed" : "under-claimed";

      result.set(claim.claimId, {
        key: "consistency",
        label: "Claimed area inconsistent with land records",
        weight: 0.25,
        score: Math.round(rawScore * 100) / 100,
        detail: `Claimed ${areaClaimedHa} Ha, record shows ${areaInRecordHa} Ha (${Math.round(ratio * 100)}% ${direction})`,
      });
    } else {
      result.set(claim.claimId, null);
    }
  }

  return result;
}
