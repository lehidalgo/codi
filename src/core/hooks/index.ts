export { detectHookSetup } from './hook-detector.js';
export type { HookSetup } from './hook-detector.js';

export { getHooksForLanguage, getSupportedLanguages } from './hook-registry.js';
export type { HookEntry } from './hook-registry.js';

export { installHooks, buildRunnerScript, buildSecretScanScript, buildFileSizeScript } from './hook-installer.js';
export type { InstallOptions } from './hook-installer.js';

export { generateHooksConfig } from './hook-config-generator.js';
export type { HooksConfig } from './hook-config-generator.js';

export { detectStack } from './stack-detector.js';
