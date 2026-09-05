// src/analytics/processing.ts
// ─────────────────────────────────────────────────────────────
// Detector 1 — Processing bottleneck (Scenario A)
//
// Per district: compute each claim's per-stage durations,
// compare against the district IQR threshold, flag claims
// where ANY stage is statistically unusual.
//
// Language: never "overdue" — always "statistically unusual
// processing time" or "workflow bottleneck".
// ─────────────────────────────────────────────────────────────

import type { Claim, Factor } from "../lib/types";
import { districtKey } from "../lib/geo";

// ── Stage keys in canonical order ────────────────────────────
const STAGE_PAIRS: Array<{
  from: keyof Claim["stages"];
  to: keyof Claim["stages"];
  label: string;
}> = [
  {
    from: "gsResolution",
    to: "sdlcForward",
    label: "Gram Sabha → SDLC forward",
  },
  { from: "sdlcForward", to: "sdlcDecision", label: "SDLC processing" },
  { from: "sdlcDecision", to: "dlcDecision", label: "DLC processing" },
  { from: "dlcDecision", to: "titleIssued", label: "DLC → Title issuance" },
];

// ── IQR-based outlier threshold ───────────────────────────────
// Robust to the heavy tail of processing delays.
// Returns the upper fence: Q3 + 1.5 × IQR
// Any duration above this is "statistically unusual".
function iqrThreshold(durations: number[]): number {
  if (durations.length < 4) return Infinity; // too few to compute
  const s = [...durations].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  return q3 + 1.5 * (q3 - q1);
}

// ── Days between two ISO date strings ────────────────────────
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000,
  );
}

// ── Per-stage durations for one claim ────────────────────────
function stageDurations(claim: Claim): Array<{
  label: string;
  days: number;
}> {
  const result: Array<{ label: string; days: number }> = [];
  for (const { from, to, label } of STAGE_PAIRS) {
    const start = claim.stages[from];
    const end = claim.stages[to];
    if (start && end) {
      result.push({ label, days: daysBetween(start, end) });
    }
  }
  return result;
}

// ── Main export ───────────────────────────────────────────────
// Analyses all claims, returns a map of claimId → Factor | null.
// null means this claim has no processing anomaly.
export function detectProcessingAnomalies(
  claims: Claim[],
): Map<string, Factor | null> {
  // 1. Group claims by (state, district) — district names alone collide
  //    across states (e.g. Aurangabad in Maharashtra and Bihar)
  const byDistrict = new Map<string, Claim[]>();
  for (const c of claims) {
    const key = districtKey(c.location.state, c.location.district);
    if (!byDistrict.has(key)) byDistrict.set(key, []);
    byDistrict.get(key)!.push(c);
  }

  const result = new Map<string, Factor | null>();

  for (const [, districtClaims] of byDistrict) {
    // 2. Collect all stage durations for this district to build the baseline
    const allDurations = districtClaims.flatMap((c) =>
      stageDurations(c).map((s) => s.days),
    );
    const threshold = iqrThreshold(allDurations);

    // 3. Per-claim: find the worst offending stage
    for (const claim of districtClaims) {
      const durations = stageDurations(claim);
      if (durations.length === 0) {
        result.set(claim.claimId, null);
        continue;
      }

      const worst = durations.reduce(
        (max, d) => (d.days > max.days ? d : max),
        durations[0],
      );

      if (worst.days > threshold && threshold !== Infinity) {
        // Normalise: 1.0 = 3× threshold, scale linearly
        const rawScore = Math.min(
          (worst.days - threshold) / (2 * threshold),
          1,
        );

        result.set(claim.claimId, {
          key: "processing",
          label: `Statistically unusual ${worst.label} stage`,
          weight: 0.3,
          score: Math.round(rawScore * 100) / 100,
          detail: `${worst.days} days vs district threshold ${Math.round(threshold)} days`,
        });
      } else {
        result.set(claim.claimId, null);
      }
    }
  }

  return result;
}
