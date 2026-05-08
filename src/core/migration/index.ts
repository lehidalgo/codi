export { importAgentsMd } from "./agents-md.js";
export type { MigrationResult } from "./agents-md.js";
export { importClaudeMd } from "./claude-md.js";

// Sprint 7 — codi v2 → v3 migration planner
export {
  detectV2Layout,
  planMigration,
  formatPlan,
  type V2DetectionResult,
  type MigrationPlan,
  type MigrationStep,
  type MigrationStepKind,
  type PlanOptions,
} from "./v2-to-v3.js";
