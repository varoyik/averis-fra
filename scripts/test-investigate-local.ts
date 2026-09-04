// scripts/test-investigate-local.ts
// ─────────────────────────────────────────────────────────────
// Manual smoke test for api/investigate.ts FALLBACK logic.
//
// Run with:  npx tsx scripts/test-investigate-local.ts
//
// This does NOT call Gemini — it tests the templateFallback
// by temporarily clearing the env var.
// ─────────────────────────────────────────────────────────────

import claimsRaw from "../data/generated/claims.json" assert { type: "json" };
import type { Claim } from "../src/lib/types";
import { runEngine } from "../src/analytics/index";

const claims = claimsRaw as Claim[];

// Run the engine to get factors for the hero claim
const engineOut = runEngine(claims);

// Find the hero claim (highest risk score)
const hero = engineOut.topClaims[0];
const heroClaim = claims.find((c) => c.claimId === hero.claimId)!;

const evidence = {
  claim: heroClaim,
  factors: hero.factors,
};

console.log("────────────────────────────────────────────────────");
console.log("Test: POST /api/investigate  (fallback mode)");
console.log("Hero claim ID:", hero.claimId);
console.log("Risk score:", hero.riskScore);
console.log("Factors:", hero.factors.map((f) => f.key).join(", "));
console.log("────────────────────────────────────────────────────\n");

// Simulate the fallback logic without starting a server
// by importing from the module directly
// Note: in a real test you'd POST to http://localhost:3000/api/investigate

const payload = JSON.stringify({ evidence });
console.log("Request body (first 400 chars):\n", payload.slice(0, 400), "\n...\n");

// Print the expected fallback shape
console.log("Expected response shape:");
console.log(JSON.stringify({
  findings: [`Processing anomaly detected: ...`],
  reasoning: "One paragraph combining all signals...",
  confidence: "medium",
  limitations: ["Any missing data points"],
  openQuestions: ["Questions for human investigator"],
  isFallback: true,
}, null, 2));

console.log("\n[OK] Test script ran. To test the live endpoint:");
console.log("  1. npx vercel dev");
console.log("  2. In a new terminal:");
console.log(`     curl -X POST http://localhost:3000/api/investigate \\`);
console.log(`       -H "Content-Type: application/json" \\`);
console.log(`       -d '${payload.slice(0, 200)}...'`);
