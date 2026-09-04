// src/analytics/duplicates.ts
// ─────────────────────────────────────────────────────────────
// Detector 3 — Near-duplicate claims (Scenario C)
//
// Two-pass approach (keeps it O(n), no all-pairs blowup):
//
//   Pass 1 — Blocking
//     Group by (village.toLowerCase().trim(), khasraNo.trim()).
//     Any group with ≥2 claims is a candidate block.
//
//   Pass 2 — Jaccard similarity within each block
//     Tokenise claimant name fields (name + fatherName).
//     Jaccard(tokenSetA, tokenSetB) ≥ 0.85 → flag as duplicate pair.
//     Also flag trivially: >1 claimant on the exact same khasra.
//
// Every flagged claim gets a Factor. Pairs share each other's
// claimId in the detail string.
// ─────────────────────────────────────────────────────────────

import type { Claim, Factor } from "../lib/types";

const JACCARD_THRESHOLD = 0.85;

// ── Token set from name fields ────────────────────────────────
function tokenSet(claim: Claim): Set<string> {
  const raw = `${claim.claimant.name} ${claim.claimant.fatherName}`;
  return new Set(
    raw
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1)  // drop single-letter noise
  );
}

// ── Jaccard similarity between two token sets ─────────────────
function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── Blocking key ──────────────────────────────────────────────
function blockKey(claim: Claim): string {
  return `${claim.location.village.toLowerCase().trim()}|${claim.land.khasraNo.trim()}`;
}

// ── Main export ───────────────────────────────────────────────
// Returns a map of claimId → Factor | null.
// If a claim is part of a duplicate pair it gets a Factor with
// the matched claimId in the detail.
export function detectDuplicateAnomalies(
  claims: Claim[]
): Map<string, Factor | null> {
  const result = new Map<string, Factor | null>(
    claims.map((c) => [c.claimId, null])
  );

  // ── Pass 1: blocking ─────────────────────────────────────────
  const blocks = new Map<string, Claim[]>();
  for (const c of claims) {
    const k = blockKey(c);
    if (!blocks.has(k)) blocks.set(k, []);
    blocks.get(k)!.push(c);
  }

  // ── Pass 2: within each block, check Jaccard ─────────────────
  for (const block of blocks.values()) {
    if (block.length < 2) continue;

    // Trivial case: >1 claimant on same khasra in same village
    // (exact blocking key match = guaranteed duplicate candidate)
    if (block.length >= 2) {
      for (let i = 0; i < block.length; i++) {
        for (let j = i + 1; j < block.length; j++) {
          const a = block[i];
          const b = block[j];

          const sim = jaccard(tokenSet(a), tokenSet(b));
          const isTrivial = a.land.khasraNo === b.land.khasraNo &&
                            a.location.village.toLowerCase() === b.location.village.toLowerCase();

          if (sim >= JACCARD_THRESHOLD || isTrivial) {
            const score = Math.min(0.5 + sim * 0.5, 1.0); // 0.5 baseline for trivial
            const pct   = Math.round(sim * 100);

            // Flag A pointing to B
            result.set(a.claimId, {
              key: "duplicate",
              label: "Near-duplicate claim detected",
              weight: 0.25,
              score: Math.round(score * 100) / 100,
              detail: `${pct}% name similarity with claim ${b.claimId} on khasra ${a.land.khasraNo}, village ${a.location.village}`,
            });

            // Flag B pointing to A
            result.set(b.claimId, {
              key: "duplicate",
              label: "Near-duplicate claim detected",
              weight: 0.25,
              score: Math.round(score * 100) / 100,
              detail: `${pct}% name similarity with claim ${a.claimId} on khasra ${b.land.khasraNo}, village ${b.location.village}`,
            });
          }
        }
      }
    }
  }

  return result;
}
