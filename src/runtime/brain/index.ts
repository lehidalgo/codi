/**
 * Public surface of `src/runtime/brain/`. Other modules import from here.
 */

export {
  openBrain,
  defaultBrainPath,
  type BrainDb,
  type BrainHandle,
  type OpenBrainOptions,
} from "./db.js";
export { applyMigrations, CURRENT_SCHEMA_VERSION } from "./migrate.js";
export * as schema from "./schema.js";
