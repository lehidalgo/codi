/**
 * Backward-compat shim. The canonical registry now lives under
 * src/core/hooks/registry/ with one file per language. New code should
 * import from "./registry/index.js" (or transitively via this shim).
 */
export type { InstallHint, HookSpec } from "./hook-spec.js";

import type { HookSpec } from "./hook-spec.js";

/** @deprecated Use HookSpec directly. Retained so existing callers compile. */
export type HookEntry = HookSpec;

export {
  getDoctorHook,
  getCommitlintHook,
  getGlobalHooks,
  getHooksForLanguage,
  getSupportedLanguages,
} from "./registry/index.js";
