// scripts/smoke-engine.ts
// ─────────────────────────────────────────────────────────────
// Smoke test for the anomaly engine.
// Run: npx tsx scripts/smoke-engine.ts
//
// Asserts each scenario A–E in claims.json produces its expected
// flag. Exit 0 = all pass. Exit 1 = one or more failures.
//
// This is the machine-checkable "done" for Phase 1.2.
// ─────────────────────────────────────────────────────────────

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import type { Claim } from "../src/lib/types";
import { runEngine } from "../src/analytics/score";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load claims ───────────────────────────────────────────────
const claimsPath = join(__dirname, "..", "data", "generated", "claims.json");
const claims: Claim[] = JSON.parse(readFileSync(claimsPath, "utf-8"));

// ── Run engine ────────────────────────────────────────────────
const output = runEngine(claims);

// ── Result collector ──────────────────────────────────────────
type Result = { label: string; pass: boolean; detail: string };
const results: Result[] = [];

function assert(label: string, pass: boolean, detail: string) {
  results.push({ label, pass, detail });
}

// ──────────────────────────────────────────────────────────────
// Scenario A — Processing bottleneck
// Expected: ≥10 claims in Shahdol district with a "processing"
// factor whose detail mentions "> district threshold"
// ──────────────────────────────────────────────────────────────
const shahdolResult = output.districts.find(
  (d) => d.district === "Shahdol"
);
const shahdolBottleneck = shahdolResult
  ? shahdolResult.claimResults.filter((r) =>
      r.factors.some((f) => f.key === "processing")
    ).length
  : 0;

assert(
  "A — Processing bottleneck in Shahdol (≥10 flagged)",
  shahdolBottleneck >= 10,
  `Found: ${shahdolBottleneck} claims with processing factor in Shahdol`
);

// ──────────────────────────────────────────────────────────────
// Scenario B — Land record mismatch
// Expected: ≥15 claims across all districts with a "consistency"
// factor (>30% mismatch)
// ──────────────────────────────────────────────────────────────
const mismatchCount = output.topClaims.filter((r) =>
  r.factors.some((f) => f.key === "consistency")
).length;

assert(
  "B — Area mismatch flagged (≥15 claims)",
  mismatchCount >= 15,
  `Found: ${mismatchCount} claims with consistency factor`
);

// ──────────────────────────────────────────────────────────────
// Scenario C — Duplicate pairs
// Expected: ≥10 claims with a "duplicate" factor
// ──────────────────────────────────────────────────────────────
const dupCount = output.topClaims.filter((r) =>
  r.factors.some((f) => f.key === "duplicate")
).length;

assert(
  "C — Duplicate pairs detected (≥10 claims flagged)",
  dupCount >= 10,
  `Found: ${dupCount} claims with duplicate factor`
);

// ──────────────────────────────────────────────────────────────
// Scenario D — Spatial cluster
// Expected: ≥8 claims with a "spatial" factor
// ──────────────────────────────────────────────────────────────
const spatialCount = output.topClaims.filter((r) =>
  r.factors.some((f) => f.key === "spatial")
).length;

assert(
  "D — Spatial cluster detected (≥8 claims flagged)",
  spatialCount >= 8,
  `Found: ${spatialCount} claims with spatial factor`
);

// ──────────────────────────────────────────────────────────────
// Scenario E — Hero claim (MP-DIN-HERO-001)
// Expected: exists in output AND carries ALL 4 factor types
// ──────────────────────────────────────────────────────────────
const HERO_ID = "MP-DIN-HERO-001";
const heroResult = output.topClaims.find((r) => r.claimId === HERO_ID)
  ?? output.districts
       .flatMap((d) => d.claimResults)
       .find((r) => r.claimId === HERO_ID);

assert(
  "E — Hero claim exists in engine output",
  heroResult !== undefined,
  heroResult ? `riskScore=${heroResult.riskScore}` : "NOT FOUND"
);

if (heroResult) {
  const heroKeys = new Set(heroResult.factors.map((f) => f.key));
  const allFour =
    heroKeys.has("processing") &&
    heroKeys.has("consistency") &&
    heroKeys.has("duplicate") &&
    heroKeys.has("spatial");

  assert(
    "E — Hero claim carries all 4 signal types",
    allFour,
    `Factors present: [${[...heroKeys].join(", ")}]`
  );

  assert(
    "E — Hero risk score > 0.5",
    heroResult.riskScore > 0.5,
    `riskScore=${heroResult.riskScore}`
  );
}

// ── Extra sanity checks ───────────────────────────────────────
assert(
  "Engine — districts output non-empty",
  output.districts.length >= 8,
  `${output.districts.length} districts`
);

assert(
  "Engine — topClaims sorted desc by riskScore",
  output.topClaims.every(
    (r, i) => i === 0 || r.riskScore <= output.topClaims[i - 1].riskScore
  ),
  "order check"
);

// ── Print results ─────────────────────────────────────────────
const width = Math.max(...results.map((r) => r.label.length)) + 2;
const sep = "-".repeat(width + 30);

console.log("\n" + sep);
console.log(
  `${"Assertion".padEnd(width)}  ${"Result".padEnd(8)}  Detail`
);
console.log(sep);

for (const { label, pass, detail } of results) {
  const icon = pass ? "[PASS]" : "[FAIL]";
  console.log(`${label.padEnd(width)}  ${icon.padEnd(8)}  ${detail}`);
}

console.log(sep);

const failed = results.filter((r) => !r.pass).length;
if (failed === 0) {
  console.log("\n[OK]  All smoke tests passed. Engine is ready.\n");
  process.exit(0);
} else {
  console.log(`\n[FAIL]  ${failed} test(s) failed.\n`);
  process.exit(1);
}
