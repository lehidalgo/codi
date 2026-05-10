import { PROJECT_NAME } from "#src/constants.js";
import type { GitHookArtifact, HookArtifact, RuntimeHookArtifact } from "../hook-artifact.js";
import type { HookLanguage } from "../hook-spec.js";
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
import { RUNTIME_HOOKS } from "./runtime/index.js";

const LANGUAGE_HOOKS: Record<string, GitHookArtifact[]> = {
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

export function getGitHooks(): GitHookArtifact[] {
  const out: GitHookArtifact[] = [...GLOBAL_HOOKS];
  for (const arr of Object.values(LANGUAGE_HOOKS)) out.push(...arr);
  return out;
}

export function getRuntimeHooks(): RuntimeHookArtifact[] {
  return [...RUNTIME_HOOKS];
}

export function getAllHooks(): HookArtifact[] {
  return [...getGitHooks(), ...getRuntimeHooks()];
}

export function getHook(name: string): HookArtifact | null {
  return getAllHooks().find((h) => h.name === name) ?? null;
}

export function getDoctorHook(): GitHookArtifact {
  const hook = GLOBAL_HOOKS.find((h) => h.name === `${PROJECT_NAME}-doctor`);
  if (!hook) throw new Error("doctor hook missing from global registry");
  return hook;
}

export function getCommitlintHook(): GitHookArtifact {
  const hook = GLOBAL_HOOKS.find((h) => h.name === "commitlint");
  if (!hook) throw new Error("commitlint hook missing from global registry");
  return hook;
}

export function getGlobalHooks(): GitHookArtifact[] {
  return [...GLOBAL_HOOKS];
}

export function getHooksForLanguage(language: string): GitHookArtifact[] {
  const normalized = language.toLowerCase();
  const hooks = LANGUAGE_HOOKS[normalized] ?? [];
  return hooks.map((h) => ({ ...h, language: normalized as HookLanguage }));
}

export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_HOOKS);
}

export function getDefaultGitHookNames(languages: string[]): string[] {
  const names = new Set<string>();
  for (const h of GLOBAL_HOOKS) if (h.default) names.add(h.name);
  for (const lang of languages) {
    const arr = LANGUAGE_HOOKS[lang.toLowerCase()] ?? [];
    for (const h of arr) if (h.default) names.add(h.name);
  }
  return [...names];
}

export function getDefaultRuntimeHookNames(): string[] {
  return RUNTIME_HOOKS.filter((h) => h.default || h.required).map((h) => h.name);
}
