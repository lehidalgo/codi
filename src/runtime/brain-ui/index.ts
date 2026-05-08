/**
 * Public surface of `src/runtime/brain-ui/` (Sprint 4).
 */

export { buildApp, type AppHandle, type BuildAppOptions } from "./server.js";
export { registerApiRoutes } from "./routes-api.js";
export { registerPages } from "./pages.js";
export {
  DEFAULT_BRAIN_UI_PORT,
  defaultPidfilePath,
  readPidfile,
  writePidfile,
  clearPidfile,
  isPidAlive,
  probeHealthz,
  resolveAttachOrSpawn,
  type PidfileRecord,
  type AttachDecision,
} from "./lifecycle.js";
