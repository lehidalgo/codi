/**
 * CORE-010 — hook registry entry point.
 *
 * Pre-CORE-010 this module imported 15 hand-written `<lang>.ts` files
 * (~1100 LOC of pure data) and a `LANGUAGE_HOOKS` literal map keyed
 * by language. Adding language #N meant a new file + import line +
 * map row. Post-CORE-010, language data lives in
 * `registry/yaml/<lang>.yaml` and the loader discovers + parses them
 * lazily. Adding a language is a single-file change.
 *
 * `runtime/` is out of scope — those hooks carry `evaluate()`
 * closures that are not data.
 */
import { PROJECT_NAME } from "#src/constants.js";
import type { GitHookArtifact, HookArtifact, RuntimeHookArtifact } from "../hook-artifact.js";
import type { HookLanguage } from "../hook-spec.js";
import {
  listAvailableLanguages,
  loadGlobalHooks,
  loadLanguageHooks,
} from "./loader.js";
import { RUNTIME_HOOKS } from "./runtime/index.js";

export function getGitHooks(): GitHookArtifact[] {
  const out: GitHookArtifact[] = [...loadGlobalHooks()];
  for (const lang of listAvailableLanguages()) {
    out.push(...loadLanguageHooks(lang));
  }
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
  const hook = loadGlobalHooks().find((h) => h.name === `${PROJECT_NAME}-doctor`);
  if (!hook) throw new Error("doctor hook missing from global registry");
  return hook;
}

export function getCommitlintHook(): GitHookArtifact {
  const hook = loadGlobalHooks().find((h) => h.name === "commitlint");
  if (!hook) throw new Error("commitlint hook missing from global registry");
  return hook;
}

export function getGlobalHooks(): GitHookArtifact[] {
  return [...loadGlobalHooks()];
}

export function getHooksForLanguage(language: string): GitHookArtifact[] {
  const normalized = language.toLowerCase();
  let hooks: GitHookArtifact[];
  try {
    hooks = loadLanguageHooks(normalized);
  } catch {
    return [];
  }
  return hooks.map((h) => ({ ...h, language: normalized as HookLanguage }));
}

export function getSupportedLanguages(): string[] {
  return listAvailableLanguages();
}

export function getDefaultGitHookNames(languages: string[]): string[] {
  const names = new Set<string>();
  for (const h of loadGlobalHooks()) if (h.default) names.add(h.name);
  for (const lang of languages) {
    const normalized = lang.toLowerCase();
    let arr: GitHookArtifact[];
    try {
      arr = loadLanguageHooks(normalized);
    } catch {
      continue;
    }
    for (const h of arr) if (h.default) names.add(h.name);
  }
  return [...names];
}

export function getDefaultRuntimeHookNames(): string[] {
  return RUNTIME_HOOKS.filter((h) => h.default || h.required).map((h) => h.name);
}
