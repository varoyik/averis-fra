// src/analytics/index.ts
// ─────────────────────────────────────────────────────────────
// Barrel export for the entire analytics engine.
// Allows clean imports across the project:
//   import { runEngine, riskColor, riskScore } from "../analytics";
// ─────────────────────────────────────────────────────────────

// Orchestration, scoring, and UI color utilities
export {
  runEngine,
  riskScore,
  riskBand,
  riskColor,
} from "./score";

// Detector 1: Temporal / processing bottleneck
export { detectProcessingAnomalies } from "./processing";

// Detector 2: Land record mismatch
export { detectConsistencyAnomalies } from "./consistency";

// Detector 3: Near-duplicate claims (Jaccard similarity)
export { detectDuplicateAnomalies } from "./duplicates";

// Detector 4: Spatial concentration
export {
  detectSpatialAnomalies,
  rankDistrictsByDensity,
  gridCell,
} from "./spatial";
