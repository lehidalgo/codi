import { existsSync } from "node:fs";
import type { ResolvedFlags } from "#src/types/flags.js";
import { PROJECT_NAME } from "#src/constants.js";
import type { ProjectManifest } from "#src/types/config.js";
import type { HookEntry } from "./hook-registry.js";
import { getHooksForLanguage, getDoctorHook, getGlobalHooks } from "./hook-registry.js";

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
  versionBump: boolean;
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

  // ── Stage 1: Instant filename / pattern checks ───────────────────────────
  // These reject obvious problems in milliseconds before any file I/O or
  // tool invocations. Always run first so the hook exits fast on bad input.

  allHooks.push({
    name: "staged-junk-check",
    command: `node .git/hooks/${PROJECT_NAME}-staged-junk-check.mjs`,
    stagedFilter: "**",
  });

  allHooks.push({
    name: "file-size-check",
    command: `node .git/hooks/${PROJECT_NAME}-file-size-check.mjs`,
    stagedFilter: "**/*",
  });

  allHooks.push({
    name: "import-depth-check",
    command: `node .git/hooks/${PROJECT_NAME}-import-depth-check.mjs`,
    stagedFilter: "**/*.{ts,tsx,js,jsx,mts,mjs}",
  });

  const docNamingCheck = hasDocNamingCheck();
  if (docNamingCheck) {
    allHooks.push({
      name: "doc-naming-check",
      command: `node .git/hooks/${PROJECT_NAME}-doc-naming-check.mjs`,
      stagedFilter: "docs/**",
    });
  }

  // ── Stage 2: Fast content checks ─────────────────────────────────────────
  // Read file contents but no compilation or external tool startup cost.

  // Global hooks (gitleaks) — controlled by security_scan flag
  if (isSecurityScanEnabled(flags)) {
    for (const globalHook of getGlobalHooks()) {
      if (globalHook.name !== `${PROJECT_NAME}-doctor`) {
        allHooks.push(globalHook);
      }
    }
  }

  const secretScan = isSecurityScanEnabled(flags);
  if (secretScan) {
    allHooks.push({
      name: "secret-scan",
      command: `node .git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
      stagedFilter: "**/*",
    });
  }

  allHooks.push({
    name: "skill-yaml-validate",
    command: `node .git/hooks/${PROJECT_NAME}-skill-yaml-validate.mjs`,
    stagedFilter: "**/SKILL.md",
  });

  allHooks.push({
    name: "skill-resource-check",
    command: `node .git/hooks/${PROJECT_NAME}-skill-resource-check.mjs`,
    stagedFilter: "**/{SKILL.md,template.ts,*.md}",
  });

  allHooks.push({
    name: "skill-path-wrap-check",
    command: `node .git/hooks/${PROJECT_NAME}-skill-path-wrap-check.mjs`,
    stagedFilter: "**/{SKILL.md,template.ts,*.md}",
  });

  allHooks.push({
    name: "artifact-validate",
    command: `node .git/hooks/${PROJECT_NAME}-artifact-validate.mjs`,
    stagedFilter: ".codi/**",
  });

  // ── Stage 3: Environment / tooling checks ────────────────────────────────
  // These invoke external tools or make network calls — run after cheap checks.

  const hasVersionRequirement = Boolean(manifest?.engine?.requiredVersion);
  if (hasVersionRequirement) {
    allHooks.push(getDoctorHook());
    allHooks.push({
      name: "version-check",
      command: `node .git/hooks/${PROJECT_NAME}-version-check.mjs`,
      stagedFilter: "",
    });
  }

  // ── Stage 4: Language hooks (lint → format → type-check → security) ──────
  // Ordered within each language from fastest to slowest by hook-registry.

  for (const lang of languages) {
    const langHooks = getHooksForLanguage(lang);
    for (const hook of langHooks) {
      if (isHookEnabled(hook.name, flags)) {
        const alreadyAdded = allHooks.some((h) => h.name === hook.name);
        if (!alreadyAdded) {
          allHooks.push(hook);
        }
      }
    }
  }

  // ── Stage 5: Codi-dev hooks ───────────────────────────────────────────────
  // Only active inside the Codi repository itself.

  const versionBump = hasVersionBump();
  if (versionBump) {
    allHooks.push({
      name: "version-bump",
      command: `node .git/hooks/${PROJECT_NAME}-version-bump.mjs`,
      stagedFilter: "src/templates/**",
      passFiles: false,
    });
  }

  const templateWiringCheck = hasTemplateWiringCheck();
  if (templateWiringCheck) {
    allHooks.push({
      name: "template-wiring-check",
      command: `node .git/hooks/${PROJECT_NAME}-template-wiring-check.mjs`,
      stagedFilter: "src/templates/**",
    });
  }

  // ── Stage 6: Test suite — always last ────────────────────────────────────
  // Running the full test suite is the most expensive check. Only run it after
  // all fast checks pass, so cheap failures don't pay the test startup cost.

  const testBeforeCommit = isTestBeforeCommitEnabled(flags);
  if (testBeforeCommit) {
    const testHooks = getTestHooksForLanguages(languages);
    for (const hook of testHooks) {
      const alreadyAdded = allHooks.some((h) => h.name === hook.name || h.command === hook.command);
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
    artifactValidation: true,
    importDepthCheck: true,
    skillYamlValidation: true,
    skillResourceCheck: true,
    skillPathWrapCheck: true,
    stagedJunkCheck: true,
    versionBump,
    docCheck,
    docProtectedBranches,
  };
}

function hasTemplateWiringCheck(): boolean {
  // Only enable for projects that have a src/templates/ directory (codi contributors)
  return existsSync("src/templates");
}

function hasDocNamingCheck(): boolean {
  return true;
}

function hasVersionBump(): boolean {
  // Only enable for projects that have templates + a baseline to compare against
  return (
    existsSync("src/templates") && existsSync("src/core/version/artifact-version-baseline.json")
  );
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
  const flag = flags["test_before_commit"];
  if (!flag) return true;
  if (flag.mode === "disabled") return false;
  return flag.value !== false;
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

function getTestHooksForLanguages(languages: string[]): HookEntry[] {
  const TEST_COMMANDS: Record<string, HookEntry> = {
    typescript: {
      name: "test-ts",
      command: NPM_PRECOMMIT_TEST,
      stagedFilter: "",
      shell: true,
      passFiles: false,
    },
    javascript: {
      name: "test-js",
      command: NPM_PRECOMMIT_TEST,
      stagedFilter: "",
      shell: true,
      passFiles: false,
    },
    python: {
      name: "test-py",
      command: getPythonTestCommand(),
      stagedFilter: "",
      passFiles: false,
    },
    go: { name: "test-go", command: "go test ./...", stagedFilter: "", passFiles: false },
    rust: { name: "test-rs", command: "cargo test", stagedFilter: "", passFiles: false },
    java: { name: "test-java", command: "mvn test -q", stagedFilter: "", passFiles: false },
    kotlin: { name: "test-kt", command: "gradle test", stagedFilter: "", passFiles: false },
    swift: { name: "test-swift", command: "swift test", stagedFilter: "", passFiles: false },
    csharp: { name: "test-cs", command: "dotnet test", stagedFilter: "", passFiles: false },
    dart: { name: "test-dart", command: "dart test", stagedFilter: "", passFiles: false },
    php: { name: "test-php", command: "phpunit", stagedFilter: "", passFiles: false },
    ruby: { name: "test-rb", command: "bundle exec rspec", stagedFilter: "", passFiles: false },
  };
  const hooks: HookEntry[] = [];
  for (const lang of languages) {
    const hook = TEST_COMMANDS[lang.toLowerCase()];
    if (hook) hooks.push(hook);
  }
  return hooks;
}
