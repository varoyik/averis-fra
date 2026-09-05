// src/analytics/spatial.ts
// ─────────────────────────────────────────────────────────────
// Detector 4 — Spatial concentration (Scenario D)
//
// Algorithm:
//   1. Bin every claim into a 0.25° × 0.25° grid cell.
//   2. Count claims per cell across the whole dataset.
//   3. Compute the top-decile threshold (90th percentile of
//      cell counts).
//   4. Flag any claim whose cell count is in the top decile.
//
// Also ranks districts by anomaly-claim density (flagged claims
// per total claims) — used to colour the choropleth map.
// ─────────────────────────────────────────────────────────────

import type { Claim, Factor } from "../lib/types";
import { districtKey } from "../lib/geo";

const GRID_SIZE = 0.25; // degrees

// ── Grid cell key ─────────────────────────────────────────────
export function gridCell(lat: number, lon: number): string {
  return `${Math.floor(lat / GRID_SIZE)}:${Math.floor(lon / GRID_SIZE)}`;
}

// ── Nth percentile of an array ────────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

// ── Main export ───────────────────────────────────────────────
// Returns a map of claimId → Factor | null.
export function detectSpatialAnomalies(
  claims: Claim[],
): Map<string, Factor | null> {
  const result = new Map<string, Factor | null>(
    claims.map((c) => [c.claimId, null]),
  );

  // Claims without geo coords can't be spatially analysed
  const geoTagged = claims.filter((c) => c.geo != null);
  if (geoTagged.length === 0) return result;

  // 1. Build cell → claims map
  const cellMap = new Map<string, Claim[]>();
  for (const c of geoTagged) {
    const key = gridCell(c.geo!.lat, c.geo!.lon);
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key)!.push(c);
  }

  // 2. Sorted cell counts for percentile calculation
  const counts = [...cellMap.values()]
    .map((arr) => arr.length)
    .sort((a, b) => a - b);
  const topDecileThreshold = percentile(counts, 90);

  // 3. Flag claims in top-decile cells
  for (const [cell, cellClaims] of cellMap.entries()) {
    const count = cellClaims.length;
    if (count <= topDecileThreshold) continue;

    // Score: how far above the threshold (0..1)
    const maxCount = counts[counts.length - 1];
    const rawScore =
      maxCount > topDecileThreshold
        ? (count - topDecileThreshold) / (maxCount - topDecileThreshold)
        : 1;

    for (const claim of cellClaims) {
      result.set(claim.claimId, {
        key: "spatial",
        label: "Unusual geographic concentration of claims",
        weight: 0.2,
        score: Math.round(Math.min(rawScore, 1) * 100) / 100,
        detail: `${count} claims in grid cell ${cell} (top-decile threshold: ${topDecileThreshold})`,
      });
    }
  }

  return result;
}

// ── District anomaly density ranking ─────────────────────────
// Used to colour the choropleth map. Returns districts sorted
// by (flaggedClaims / totalClaims) descending. Keyed by
// (state, district) so shared district names stay separate.
export function rankDistrictsByDensity(
  claims: Claim[],
  spatialFlags: Map<string, Factor | null>,
): Array<{
  district: string;
  state: string;
  density: number;
  flagged: number;
  total: number;
}> {
  const byDistrict = new Map<
    string,
    { district: string; state: string; flagged: number; total: number }
  >();

  for (const c of claims) {
    const key = districtKey(c.location.state, c.location.district);
    if (!byDistrict.has(key)) {
      byDistrict.set(key, {
        district: c.location.district,
        state: c.location.state,
        flagged: 0,
        total: 0,
      });
    }
    const entry = byDistrict.get(key)!;
    entry.total += 1;
    if (spatialFlags.get(c.claimId)) entry.flagged += 1;
  }

  return [...byDistrict.values()]
    .map(({ district, state, flagged, total }) => ({
      district,
      state,
      density: total > 0 ? flagged / total : 0,
      flagged,
      total,
    }))
    .sort((a, b) => b.density - a.density);
}
