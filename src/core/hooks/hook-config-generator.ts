import { existsSync } from "node:fs";
import type { ResolvedFlags } from "#src/types/flags.js";
import { PROJECT_NAME } from "#src/constants.js";
import type { ProjectManifest } from "#src/types/config.js";
import type { HookCategory, HookSpec, HookStage } from "./hook-spec.js";
import type { HookEntry } from "./hook-registry.js";
import { getHooksForLanguage, getDoctorHook, getGlobalHooks } from "./hook-registry.js";

/**
 * Construct a HookSpec for a Codi-internal `.mjs` check that lives in
 * .git/hooks/. These hooks are runner-agnostic — the same `node ...` command
 * is used by both the shell renderer and the pre-commit framework's
 * `repo: local` entry.
 */
function metaHook(opts: {
  name: string;
  entry: string;
  files: string;
  passFiles?: boolean;
  category?: HookCategory;
  stages?: HookStage[];
}): HookSpec {
  const passFiles = opts.passFiles !== false;
  return {
    name: opts.name,
    language: "global",
    category: opts.category ?? "lint",
    files: opts.files,
    stages: opts.stages ?? ["pre-commit"],
    required: false,
    shell: {
      command: opts.entry,
      passFiles,
      modifiesFiles: false,
      toolBinary: "node",
    },
    preCommit: {
      kind: "local",
      entry: opts.entry,
      language: "system",
      passFilenames: passFiles,
    },
    installHint: { command: "" },
  };
}

export interface HooksConfig {
  hooks: HookEntry[];
  secretScan: boolean;
  fileSizeCheck: boolean;
  versionCheck: boolean;
  commitMsgValidation: boolean;
  testBeforeCommit: boolean;
  templateWiringCheck: boolean;
  docNamingCheck: boolean;
  artifactValidation: boolean;
  importDepthCheck: boolean;
  skillYamlValidation: boolean;
  skillResourceCheck: boolean;
  skillPathWrapCheck: boolean;
  stagedJunkCheck: boolean;
  conflictMarkerCheck: boolean;
  versionBump: boolean;
  versionVerify: boolean;
  brandSkillValidation: boolean;
  docCheck: boolean;
  docProtectedBranches: string[];
}

interface FlagHookMapping {
  flagName: string;
  hookNames: string[];
  check: (flag: { value: unknown; mode: string }) => boolean;
}

const FLAG_HOOK_MAPPINGS: FlagHookMapping[] = [
  {
    flagName: "type_checking",
    hookNames: ["tsc", "pyright", "dotnet-build"],
    check: (flag) => flag.value !== "off" && flag.mode !== "disabled",
  },
  {
    flagName: "security_scan",
    hookNames: ["gitleaks", "bandit", "gosec", "brakeman", "phpcs-security"],
    check: (flag) => flag.value !== false && flag.mode !== "disabled",
  },
];

function isHookEnabled(hookName: string, flags: ResolvedFlags): boolean {
  for (const mapping of FLAG_HOOK_MAPPINGS) {
    if (mapping.hookNames.includes(hookName)) {
      const flag = flags[mapping.flagName];
      if (flag) {
        return mapping.check(flag);
      }
    }
  }
  return true;
}

function isSecurityScanEnabled(flags: ResolvedFlags): boolean {
  const flag = flags["security_scan"];
  if (!flag) return true;
  if (flag.mode === "disabled") return false;
  return flag.value !== false;
}

export function generateHooksConfig(
  flags: ResolvedFlags,
  languages: string[],
  manifest?: ProjectManifest,
): HooksConfig {
  const allHooks: HookEntry[] = [];

  // ── Stage 0: Version-bump auto-fix ───────────────────────────────────────
  // Runs FIRST so the bump lands before lint/tsc/tests see the staged files.
  // Pre-push companion (version-verify) runs at push time, not commit.

  const versionBump = hasVersionBump();
  if (versionBump) {
    allHooks.push(
      metaHook({
        name: "version-bump",
        entry: `node .git/hooks/${PROJECT_NAME}-version-bump.mjs`,
        files: "src/templates/**",
        passFiles: false,
      }),
    );
    allHooks.push(
      metaHook({
        name: "version-verify",
        entry: `node .git/hooks/${PROJECT_NAME}-version-verify.mjs`,
        files: "**/*",
        passFiles: false,
        stages: ["pre-push"],
      }),
    );
  }

  // ── Stage 1: Instant filename / pattern checks ───────────────────────────
  // These reject obvious problems in milliseconds before any file I/O or
  // tool invocations. Always run first so the hook exits fast on bad input.

  allHooks.push(
    metaHook({
      name: "staged-junk-check",
      entry: `node .git/hooks/${PROJECT_NAME}-staged-junk-check.mjs`,
      files: "**",
    }),
  );

  allHooks.push(
    metaHook({
      name: "conflict-marker-check",
      entry: `node .git/hooks/${PROJECT_NAME}-conflict-marker-check.mjs`,
      files: "**/*",
      category: "meta",
    }),
  );

  allHooks.push(
    metaHook({
      name: "file-size-check",
      entry: `node .git/hooks/${PROJECT_NAME}-file-size-check.mjs`,
      files: "**/*",
    }),
  );

  allHooks.push(
    metaHook({
      name: "import-depth-check",
      entry: `node .git/hooks/${PROJECT_NAME}-import-depth-check.mjs`,
      files: "**/*.{ts,tsx,js,jsx,mts,mjs}",
    }),
  );

  const docNamingCheck = hasDocNamingCheck();
  if (docNamingCheck) {
    allHooks.push(
      metaHook({
        name: "doc-naming-check",
        entry: `node .git/hooks/${PROJECT_NAME}-doc-naming-check.mjs`,
        files: "docs/**",
      }),
    );
  }

  // ── Stage 2: Fast content checks ─────────────────────────────────────────
  // Read file contents but no compilation or external tool startup cost.

  // Global hooks: gitleaks gated by security_scan, commitlint gated by
  // commitMsgValidation (always-on for now), doctor only when manifest
  // declares a version requirement (handled separately below).
  for (const globalHook of getGlobalHooks()) {
    if (globalHook.name === `${PROJECT_NAME}-doctor`) continue;
    if (globalHook.name === "gitleaks") {
      if (isSecurityScanEnabled(flags)) allHooks.push(globalHook);
      continue;
    }
    if (globalHook.name === "commitlint") {
      // commit-msg stage hook — always added when commit-msg validation is on
      // (which it is, by default). The yaml-renderer wires the commit-msg
      // stage into the generated config via the spec's stages: ['commit-msg'].
      allHooks.push(globalHook);
      continue;
    }
    // Future global hooks fall through here.
    allHooks.push(globalHook);
  }

  const secretScan = isSecurityScanEnabled(flags);
  if (secretScan) {
    allHooks.push(
      metaHook({
        name: "secret-scan",
        entry: `node .git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
        files: "**/*",
        category: "security",
      }),
    );
  }

  // Codi-authoring hooks — skills, artifacts, brand. Only install in repos
  // that actually author Codi artifacts (Codi source repo or preset repos).
  // Detection: presence of src/templates/ signals an authoring context.
  // Consumer projects (the common case) skip all of these — they just use
  // Codi's generated output and would never trigger these validators anyway.
  const authoringContext = isCodiAuthoringContext();
  if (authoringContext) {
    allHooks.push(
      metaHook({
        name: "skill-yaml-validate",
        entry: `node .git/hooks/${PROJECT_NAME}-skill-yaml-validate.mjs`,
        files: "**/SKILL.md",
      }),
    );

    allHooks.push(
      metaHook({
        name: "skill-resource-check",
        entry: `node .git/hooks/${PROJECT_NAME}-skill-resource-check.mjs`,
        files: "**/{SKILL.md,template.ts,*.md}",
      }),
    );

    allHooks.push(
      metaHook({
        name: "skill-path-wrap-check",
        entry: `node .git/hooks/${PROJECT_NAME}-skill-path-wrap-check.mjs`,
        files: "**/{SKILL.md,template.ts,*.md}",
      }),
    );

    allHooks.push(
      metaHook({
        name: "brand-skill-validate",
        entry: `node .git/hooks/${PROJECT_NAME}-brand-skill-validate.mjs`,
        files: "**/*.{json,css,html,svg,md}",
      }),
    );

    allHooks.push(
      metaHook({
        name: "artifact-validate",
        entry: `node .git/hooks/${PROJECT_NAME}-artifact-validate.mjs`,
        files: ".codi/**",
      }),
    );
  }

  // ── Stage 3: Environment / tooling checks ────────────────────────────────
  // These invoke external tools or make network calls — run after cheap checks.

  const hasVersionRequirement = Boolean(manifest?.engine?.requiredVersion);
  if (hasVersionRequirement) {
    allHooks.push(getDoctorHook());
    allHooks.push(
      metaHook({
        name: "version-check",
        entry: `node .git/hooks/${PROJECT_NAME}-version-check.mjs`,
        files: "",
        passFiles: false,
      }),
    );
  }

  // ── Stage 4: Language hooks (lint → format → type-check → security) ──────
  // Ordered within each language from fastest to slowest by hook-registry.

  const pyChecker = selectedPythonTypeChecker(flags);
  const jsToolchain = selectedJsFormatLint(flags);
  const commitTypeCheck = selectedCommitTypeCheck(flags);

  for (const lang of languages) {
    const langHooks = getHooksForLanguage(lang);
    for (const hook of langHooks) {
      if (!isHookEnabled(hook.name, flags)) continue;
      if (!isPythonTypeCheckerSelected(hook.name, pyChecker)) continue;
      if (!isJsToolchainSelected(hook, jsToolchain)) continue;

      // Promote type-check hooks to pre-commit when commit_type_check === 'on'.
      // Default registry stages are already ['pre-push'] for type-check hooks.
      const final =
        commitTypeCheck === "on" && hook.category === "type-check"
          ? { ...hook, stages: ["pre-commit"] as HookSpec["stages"] }
          : hook;

      const alreadyAdded = allHooks.some((h) => h.name === final.name);
      if (!alreadyAdded) {
        allHooks.push(final);
      }
    }
  }

  // ── Stage 5: Codi-dev hooks ───────────────────────────────────────────────
  // Only active inside the Codi repository itself.

  const templateWiringCheck = hasTemplateWiringCheck();
  if (templateWiringCheck) {
    allHooks.push(
      metaHook({
        name: "template-wiring-check",
        entry: `node .git/hooks/${PROJECT_NAME}-template-wiring-check.mjs`,
        files: "src/templates/**",
      }),
    );
  }

  // ── Stage 6: Test suite — always last ────────────────────────────────────
  // Running the full test suite is the most expensive check. Only run it after
  // all fast checks pass, so cheap failures don't pay the test startup cost.

  const testBeforeCommit = isTestBeforeCommitEnabled(flags);
  if (testBeforeCommit) {
    const testHooks = getTestHooksForLanguages(languages);
    for (const hook of testHooks) {
      const alreadyAdded = allHooks.some(
        (h) => h.name === hook.name || h.shell.command === hook.shell.command,
      );
      if (!alreadyAdded) {
        allHooks.push(hook);
      }
    }
  }

  const docCheck = isDocCheckEnabled(flags);
  const docProtectedBranches = getDocProtectedBranches(flags);

  return {
    hooks: allHooks,
    secretScan,
    fileSizeCheck: true,
    versionCheck: hasVersionRequirement,
    commitMsgValidation: true,
    testBeforeCommit,
    templateWiringCheck,
    docNamingCheck,
    artifactValidation: authoringContext,
    importDepthCheck: true,
    skillYamlValidation: authoringContext,
    skillResourceCheck: authoringContext,
    skillPathWrapCheck: authoringContext,
    stagedJunkCheck: true,
    conflictMarkerCheck: true,
    versionBump,
    versionVerify: versionBump,
    brandSkillValidation: authoringContext,
    docCheck,
    docProtectedBranches,
  };
}

function hasTemplateWiringCheck(): boolean {
  // Only enable for projects that have a src/templates/ directory (codi contributors)
  return existsSync("src/templates");
}

/**
 * True when the current project authors Codi artifacts (rules/skills/agents).
 * Signals: presence of src/templates/ (Codi source repo) or an explicit
 * authoring-repo flag set by preset maintainers.
 * Consumer projects return false — they consume Codi output, not author it.
 */
function isCodiAuthoringContext(): boolean {
  return existsSync("src/templates");
}

function hasDocNamingCheck(): boolean {
  return true;
}

function hasVersionBump(): boolean {
  // Enable for source-template authors (codi repo) and consumers with .codi/.
  // Both layers are auto-bumped by the dual-mode hook; baseline file is gone.
  return existsSync("src/templates") || existsSync(".codi");
}

function isDocCheckEnabled(flags: ResolvedFlags): boolean {
  const flag = flags["require_documentation"];
  if (!flag) return false;
  if (flag.mode === "disabled") return false;
  return flag.value === true;
}

function getDocProtectedBranches(flags: ResolvedFlags): string[] {
  const flag = flags["doc_protected_branches"];
  if (!flag || flag.mode === "disabled") return ["main", "develop", "release/*"];
  const val = flag.value;
  if (Array.isArray(val) && val.every((v) => typeof v === "string")) {
    return val as string[];
  }
  return ["main", "develop", "release/*"];
}

function isTestBeforeCommitEnabled(flags: ResolvedFlags): boolean {
  // commit_test_run is the new canonical flag; falls back to legacy
  // test_before_commit only when commit_test_run is missing.
  const newFlag = flags["commit_test_run"];
  if (newFlag && newFlag.mode !== "disabled") {
    return newFlag.value === "on";
  }
  const flag = flags["test_before_commit"];
  if (!flag) return false;
  if (flag.mode === "disabled") return false;
  return flag.value !== false;
}

/** Resolve the python_type_checker flag value, with safe fallback. */
function selectedPythonTypeChecker(
  flags: ResolvedFlags,
): "mypy" | "basedpyright" | "pyright" | "off" {
  const f = flags["python_type_checker"];
  if (!f || f.mode === "disabled" || f.value === "auto") return "basedpyright";
  return f.value as "mypy" | "basedpyright" | "pyright" | "off";
}

/** Resolve the js_format_lint flag value, with safe fallback. */
function selectedJsFormatLint(flags: ResolvedFlags): "eslint-prettier" | "biome" | "off" {
  const f = flags["js_format_lint"];
  if (!f || f.mode === "disabled" || f.value === "auto") return "eslint-prettier";
  return f.value as "eslint-prettier" | "biome" | "off";
}

/** Resolve the commit_type_check flag value, with safe fallback. */
function selectedCommitTypeCheck(flags: ResolvedFlags): "on" | "off" {
  const f = flags["commit_type_check"];
  if (!f || f.mode === "disabled" || f.value === "auto") return "off";
  return f.value as "on" | "off";
}

/**
 * Filter Python type checker hooks by the user's python_type_checker flag.
 * Only the selected checker survives; the others are dropped from the spec
 * list. Non-Python hooks pass through unchanged.
 */
function isPythonTypeCheckerSelected(
  hookName: string,
  selected: "mypy" | "basedpyright" | "pyright" | "off",
): boolean {
  const isPyChecker = hookName === "mypy" || hookName === "basedpyright" || hookName === "pyright";
  if (!isPyChecker) return true;
  if (selected === "off") return false;
  return hookName === selected;
}

/**
 * Filter JS/TS lint+format hooks by the user's js_format_lint flag.
 * - 'eslint-prettier' keeps eslint + prettier, drops biome.
 * - 'biome' keeps biome, drops eslint + prettier.
 * - 'off' drops all three.
 * Hooks outside the JS/TS lint+format set (tsc, etc.) pass through unchanged.
 */
function isJsToolchainSelected(
  hook: HookSpec,
  selected: "eslint-prettier" | "biome" | "off",
): boolean {
  const isEslintPrettier =
    (hook.language === "typescript" || hook.language === "javascript") &&
    (hook.name === "eslint" || hook.name === "prettier");
  const isBiome =
    (hook.language === "typescript" || hook.language === "javascript") && hook.name === "biome";
  if (!isEslintPrettier && !isBiome) return true;
  if (selected === "off") return false;
  if (selected === "biome") return isBiome;
  return isEslintPrettier; // 'eslint-prettier'
}

// Pre-commit test command for npm projects:
// If the project defines a "test:pre-commit" script in package.json, run it
// instead of "npm test". This allows projects to exclude slow E2E tests from
// pre-commit hooks while keeping the full suite for CI.
// To use: add "test:pre-commit": "vitest run tests/unit tests/integration"
// (or equivalent) to your package.json scripts.
// Marked shell: true because the command uses &&, ||, and 2>/dev/null operators.
// passFiles: false because test runners do not accept staged file paths as arguments.
const NPM_PRECOMMIT_TEST =
  "node -e \"const p=require('./package.json');process.exit(p.scripts?.['test:pre-commit']?0:1)\" 2>/dev/null && npm run test:pre-commit || npm test";

/**
 * Detects the Python test runner command based on project tooling.
 * - uv.lock present → uv run pytest
 * - poetry.lock present → poetry run pytest
 * - fallback → pytest (assumes activated venv or global install)
 */
function getPythonTestCommand(): string {
  if (existsSync("uv.lock")) return "uv run pytest";
  if (existsSync("poetry.lock")) return "poetry run pytest";
  return "pytest";
}

function testHook(opts: {
  name: string;
  language: HookSpec["language"];
  command: string;
  toolBinary: string;
}): HookSpec {
  return {
    name: opts.name,
    language: opts.language,
    category: "test",
    files: "",
    // Stage retained as pre-commit here for behavioural parity with v1.
    // Task 8.2 in the plan moves this to ["pre-push"] in a dedicated commit.
    stages: ["pre-commit"],
    required: false,
    shell: {
      command: opts.command,
      passFiles: false,
      modifiesFiles: false,
      toolBinary: opts.toolBinary,
    },
    preCommit: {
      kind: "local",
      entry: opts.command,
      language: "system",
      passFilenames: false,
    },
    installHint: { command: "" },
  };
}

function getTestHooksForLanguages(languages: string[]): HookSpec[] {
  const TEST_COMMANDS: Record<string, HookSpec> = {
    typescript: testHook({
      name: "test-ts",
      language: "typescript",
      command: NPM_PRECOMMIT_TEST,
      toolBinary: "npm",
    }),
    javascript: testHook({
      name: "test-js",
      language: "javascript",
      command: NPM_PRECOMMIT_TEST,
      toolBinary: "npm",
    }),
    python: testHook({
      name: "test-py",
      language: "python",
      command: getPythonTestCommand(),
      toolBinary: "pytest",
    }),
    go: testHook({ name: "test-go", language: "go", command: "go test ./...", toolBinary: "go" }),
    rust: testHook({
      name: "test-rs",
      language: "rust",
      command: "cargo test",
      toolBinary: "cargo",
    }),
    java: testHook({
      name: "test-java",
      language: "java",
      command: "mvn test -q",
      toolBinary: "mvn",
    }),
    kotlin: testHook({
      name: "test-kt",
      language: "kotlin",
      command: "gradle test",
      toolBinary: "gradle",
    }),
    swift: testHook({
      name: "test-swift",
      language: "swift",
      command: "swift test",
      toolBinary: "swift",
    }),
    csharp: testHook({
      name: "test-cs",
      language: "csharp",
      command: "dotnet test",
      toolBinary: "dotnet",
    }),
    dart: testHook({
      name: "test-dart",
      language: "dart",
      command: "dart test",
      toolBinary: "dart",
    }),
    php: testHook({ name: "test-php", language: "php", command: "phpunit", toolBinary: "phpunit" }),
    ruby: testHook({
      name: "test-rb",
      language: "ruby",
      command: "bundle exec rspec",
      toolBinary: "bundle",
    }),
  };
  const hooks: HookSpec[] = [];
  for (const lang of languages) {
    const hook = TEST_COMMANDS[lang.toLowerCase()];
    if (hook) hooks.push(hook);
  }
  return hooks;
}
