import { PROJECT_NAME } from "#src/constants.js";
import type { HookSpec } from "../hook-spec.js";
import { TYPESCRIPT_HOOKS } from "./typescript.js";
import { JAVASCRIPT_HOOKS } from "./javascript.js";
import { PYTHON_HOOKS } from "./python.js";
import { GO_HOOKS } from "./go.js";
import { RUST_HOOKS } from "./rust.js";
import { JAVA_HOOKS } from "./java.js";
import { KOTLIN_HOOKS } from "./kotlin.js";
import { SWIFT_HOOKS } from "./swift.js";
import { CSHARP_HOOKS } from "./csharp.js";
import { CPP_HOOKS } from "./cpp.js";
import { PHP_HOOKS } from "./php.js";
import { RUBY_HOOKS } from "./ruby.js";
import { DART_HOOKS } from "./dart.js";
import { SHELL_HOOKS } from "./shell.js";
import { GLOBAL_HOOKS } from "./global.js";

const LANGUAGE_HOOKS: Record<string, HookSpec[]> = {
  typescript: TYPESCRIPT_HOOKS,
  javascript: JAVASCRIPT_HOOKS,
  python: PYTHON_HOOKS,
  go: GO_HOOKS,
  rust: RUST_HOOKS,
  java: JAVA_HOOKS,
  kotlin: KOTLIN_HOOKS,
  swift: SWIFT_HOOKS,
  csharp: CSHARP_HOOKS,
  cpp: CPP_HOOKS,
  php: PHP_HOOKS,
  ruby: RUBY_HOOKS,
  dart: DART_HOOKS,
  shell: SHELL_HOOKS,
};

export function getDoctorHook(): HookSpec {
  return GLOBAL_HOOKS.find((h) => h.name === `${PROJECT_NAME}-doctor`)!;
}

export function getCommitlintHook(): HookSpec {
  return GLOBAL_HOOKS.find((h) => h.name === "commitlint")!;
}

export function getGlobalHooks(): HookSpec[] {
  return [...GLOBAL_HOOKS];
}

export function getHooksForLanguage(language: string): HookSpec[] {
  const normalized = language.toLowerCase();
  const hooks = LANGUAGE_HOOKS[normalized] ?? [];
  return hooks.map((h) => ({ ...h, language: normalized as HookSpec["language"] }));
}

export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_HOOKS);
}
