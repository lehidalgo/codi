export { detectHookSetup } from "./hook-detector.js";
export type { HookSetup } from "./hook-detector.js";

export { getHooksForLanguage, getSupportedLanguages } from "./hook-registry.js";
export type { HookEntry } from "./hook-registry.js";

export {
  installHooks,
  buildRunnerScript,
  buildSecretScanScript,
  buildFileSizeScript,
} from "./hook-installer.js";
export type { InstallOptions } from "./hook-installer.js";

export { generateHooksConfig } from "./hook-config-generator.js";
export type { HooksConfig } from "./hook-config-generator.js";

export { detectStack } from "./stack-detector.js";

export { checkHookDependencies } from "./hook-dependency-checker.js";
export type { DependencyCheck } from "./hook-dependency-checker.js";

export { installMissingDeps, logMissingDeps } from "./hook-dep-installer.js";
