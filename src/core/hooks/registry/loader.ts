/**
 * CORE-010 — YAML-driven hook language registry loader.
 *
 * Reads `src/core/hooks/registry/yaml/<language>.yaml` files at first
 * call and caches the parsed-and-validated `GitHookArtifact[]` in a
 * module-level Map. Replaces the 15 hand-rolled `<lang>.ts` files
 * that previously held the data (cpp, csharp, dart, go, java,
 * javascript, kotlin, php, python, ruby, rust, shell, swift,
 * typescript, global) and the matching `LANGUAGE_HOOKS` literal map
 * in `registry/index.ts`.
 *
 * Adding language #N is now a one-file change: drop a new YAML in
 * `yaml/`, add the language string to `HOOK_LANGUAGES` in
 * `hook-spec.ts` + `hook-artifact.schema.ts`, ship.
 *
 * Synchronous I/O is deliberate — the registry is consulted on the
 * CLI startup path (`init-wizard`, `hook-config-generator`,
 * `state.ts`) where every existing call is sync. Cold load reads ~15
 * tiny files once per process; the cache absorbs every subsequent
 * call.
 *
 * `runtime/` hooks are NOT in scope — they carry `evaluate()`
 * closures that cannot serialize to data. `RUNTIME_HOOKS` stays in
 * TS.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { PROJECT_CLI, PROJECT_NAME } from "#src/constants.js";
import type { GitHookArtifact } from "../hook-artifact.js";
import type { HookLanguage } from "../hook-spec.js";
import { yamlRegistryFileSchema } from "./hook-artifact.schema.js";

/**
 * Resolve the YAML directory relative to this file. Using
 * `import.meta.url` works both in dev (tsx reads `src/...`) and in
 * the built artefact (esm reads `dist/...`) — the build step copies
 * the YAML files alongside the compiled loader.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const YAML_DIR = join(HERE, "yaml");

const cache = new Map<string, GitHookArtifact[]>();
let languageListCache: string[] | null = null;

/**
 * Read a YAML file from `yaml/`, parse with strict duplicate-key
 * detection, validate against the zod schema, and substitute
 * `${PROJECT_NAME}` / `${PROJECT_CLI}` placeholders (only `global`
 * needs them today, but we run the substitution uniformly to keep
 * the loader behavior consistent across files).
 */
function readYamlFile(language: string): GitHookArtifact[] {
  const filePath = join(YAML_DIR, `${language}.yaml`);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8")
      .replace(/^﻿/, "") // strip BOM
      .replace(/\r\n/g, "\n"); // normalise EOL
  } catch (cause) {
    throw new Error(
      `[hook-registry] cannot read YAML for language "${language}" at ${filePath}: ` +
        ((cause as Error)?.message ?? String(cause)),
    );
  }

  // Template substitution must happen on the raw string so that values
  // like `${PROJECT_NAME}-doctor` (no quotes in YAML) parse correctly.
  const substituted = raw
    .replaceAll("${PROJECT_NAME}", PROJECT_NAME)
    .replaceAll("${PROJECT_CLI}", PROJECT_CLI);

  let parsed: unknown;
  try {
    parsed = parseYaml(substituted, { uniqueKeys: true });
  } catch (cause) {
    throw new Error(
      `[hook-registry] invalid YAML at ${filePath}: ` +
        ((cause as Error)?.message ?? String(cause)),
    );
  }

  const result = yamlRegistryFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `[hook-registry] schema validation failed for ${filePath}:\n` +
        result.error.issues
          .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
          .join("\n"),
    );
  }
  return result.data.hooks as GitHookArtifact[];
}

/**
 * Load the hooks for a single language. Cached after first call.
 * Throws when the YAML file is missing, malformed, or schema-invalid.
 */
export function loadLanguageHooks(language: string): GitHookArtifact[] {
  const normalized = language.toLowerCase();
  const cached = cache.get(normalized);
  if (cached) return cached;
  const hooks = readYamlFile(normalized);
  cache.set(normalized, hooks);
  return hooks;
}

/**
 * Global hooks (gitleaks, commitlint, codi-doctor) live in
 * `yaml/global.yaml` with template-substituted `${PROJECT_NAME}` and
 * `${PROJECT_CLI}` tokens.
 */
export function loadGlobalHooks(): GitHookArtifact[] {
  return loadLanguageHooks("global");
}

/**
 * Canonical iteration order, preserved from the pre-CORE-010 TS
 * registry where `LANGUAGE_HOOKS` was an object literal whose key
 * order matched the `getGitHooks()` / `getAllHooks()` consumer
 * contract (TypeScript-first because that's the framework's default
 * language; rest in roadmap-original order). Sorting alphabetically
 * via `readdirSync` would change the bytes of every consumer that
 * accumulates `getGitHooks()` in order — the byte-equal contract
 * for CORE-010 requires we keep it.
 *
 * The `readdirSync` scan still happens (below) to surface any
 * orphan YAML file in `yaml/` not registered here — that's a
 * developer error worth catching.
 */
const CANONICAL_LANGUAGES: ReadonlyArray<string> = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "csharp",
  "cpp",
  "php",
  "ruby",
  "dart",
  "shell",
];

/**
 * Enumerate every language present in `yaml/` excluding "global", in
 * the canonical order pinned above. Validates that every YAML on
 * disk is accounted for (no orphans) and every canonical language
 * has a YAML.
 */
export function listAvailableLanguages(): string[] {
  if (languageListCache !== null) return languageListCache;
  const entries = readdirSync(YAML_DIR);
  const present = new Set(
    entries
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.slice(0, -".yaml".length)),
  );
  const ordered: string[] = [];
  for (const lang of CANONICAL_LANGUAGES) {
    if (!present.has(lang)) {
      throw new Error(
        `[hook-registry] canonical language "${lang}" has no YAML at ${YAML_DIR}/${lang}.yaml`,
      );
    }
    ordered.push(lang);
  }
  // Catch YAML files not in the canonical list. "global" is the only
  // legitimate non-language YAML.
  for (const name of present) {
    if (name === "global") continue;
    if (!CANONICAL_LANGUAGES.includes(name)) {
      throw new Error(
        `[hook-registry] orphan YAML "${name}.yaml" at ${YAML_DIR} — ` +
          `add to CANONICAL_LANGUAGES in loader.ts or remove the file`,
      );
    }
  }
  languageListCache = ordered;
  return ordered;
}

/**
 * Test-only — clears every cache so a fresh fixture YAML directory
 * is reloaded. Not exported from any barrel; tests reach in by name.
 */
export function __resetRegistryCacheForTests(): void {
  cache.clear();
  languageListCache = null;
}

/**
 * Re-exported for callers that need the union type at compile time.
 * Use `loadLanguageHooks(lang)` for runtime data.
 */
export type { HookLanguage };
