// scripts/test-investigate-local.ts
// ─────────────────────────────────────────────────────────────
// Smoke test for api/investigate.ts — exercises the FALLBACK path
// locally: with no GEMINI_API_KEY set, the handler must still
// return 200 with the deterministic template narrative.
//
// Run with:  npx tsx scripts/test-investigate-local.ts
// ─────────────────────────────────────────────────────────────

import claimsRaw from "../data/generated/claims.json" with { type: "json" };
import type { Claim } from "../src/lib/types";
import { runEngine } from "../src/analytics/index";
import handler from "../api/investigate";

const claims = claimsRaw as Claim[];
const out = runEngine(claims);
const hero = out.topClaims[0];
const heroClaim = claims.find((c) => c.claimId === hero.claimId)!;

console.log("Hero claim:", hero.claimId, "| risk:", hero.riskScore);
console.log("Factors:", hero.factors.map((f) => f.key).join(", "));

// No GEMINI_API_KEY in the env → the handler must fall back gracefully.
const req = new Request("http://localhost/api/investigate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    evidence: { claim: heroClaim, factors: hero.factors },
  }),
});

const res = await handler(req);
const body = (await res.json()) as {
  isFallback: boolean;
  findings: unknown[];
  confidence: string;
  openQuestions: unknown[];
};

console.log("\nstatus:", res.status);
console.log("isFallback:", body.isFallback);
console.log("findings:", body.findings.length);
console.log("confidence:", body.confidence);
console.log("openQuestions:", body.openQuestions.length);

if (res.status !== 200 || !body.isFallback) {
  console.error("\n[FAIL] handler did not return the fallback narrative");
  process.exit(1);
}
console.log("\n[OK] handler returned the fallback narrative.");
