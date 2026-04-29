import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { fileExists } from "#src/utils/fs.js";

export interface DetectionContext {
  projectRoot: string;
  pythonDeps: string[];
  jsDeps: string[];
  locFiles: { python: number; ts: number; js: number };
  has: {
    mypyConfig: boolean;
    basedpyrightConfig: boolean;
    pyrightConfig: boolean;
    biomeConfig: boolean;
    eslintConfig: boolean;
    prettierConfig: boolean;
    monorepoSignal: boolean;
  };
}

interface Pyproject {
  project?: { dependencies?: unknown };
  tool?: {
    mypy?: unknown;
    basedpyright?: unknown;
    pyright?: unknown;
    poetry?: { dependencies?: Record<string, unknown> };
  };
}

async function readSafe(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Parse a pyproject.toml string into a typed object. Returns null on parse
 * failure so callers can fall back to filesystem-only signals without
 * crashing the wizard.
 */
function parsePyproject(text: string): Pyproject | null {
  try {
    return parseToml(text) as Pyproject;
  } catch {
    return null;
  }
}

/**
 * Extract Python dependency names from a parsed pyproject.toml.
 * Covers PEP 621 `[project] dependencies = [...]` and Poetry
 * `[tool.poetry.dependencies] = {...}`. Strips version specifiers.
 */
function pyprojectDeps(py: Pyproject | null): string[] {
  if (!py) return [];
  const out: string[] = [];
  // PEP 621 [project] dependencies
  const projectDeps = py.project?.dependencies;
  if (Array.isArray(projectDeps)) {
    for (const raw of projectDeps) {
      if (typeof raw !== "string") continue;
      const name = raw
        .split(/[<>=!~\s;]/)[0]
        ?.trim()
        .toLowerCase();
      if (name) out.push(name);
    }
  }
  // Poetry [tool.poetry.dependencies]
  const poetryDeps = py.tool?.poetry?.dependencies;
  if (poetryDeps && typeof poetryDeps === "object") {
    for (const name of Object.keys(poetryDeps)) {
      if (name.toLowerCase() !== "python") out.push(name.toLowerCase());
    }
  }
  return out;
}

/** setup.cfg uses INI; one-line scan for the [mypy] section header is sufficient. */
function hasSetupCfgMypySection(text: string): boolean {
  return /^\s*\[mypy\]\s*$/m.test(text);
}

function parseRequirementsTxt(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/[<>=!~\s;]/)[0]!.toLowerCase())
    .filter(Boolean);
}

function parsePackageJsonDeps(text: string): string[] {
  try {
    const pkg = JSON.parse(text) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  } catch {
    return [];
  }
}

const SCAN_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
]);
const PY_EXT = /\.py$/;
const TS_EXT = /\.(ts|tsx)$/;
const JS_EXT = /\.(js|jsx|mjs|cjs)$/;

async function countLoc(
  dir: string,
  depth = 0,
  acc: { python: number; ts: number; js: number } = { python: 0, ts: 0, js: 0 },
): Promise<{ python: number; ts: number; js: number }> {
  if (depth > 4) return acc;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SCAN_SKIP.has(entry.name)) continue;
      await countLoc(path.join(dir, entry.name), depth + 1, acc);
    } else {
      const name = entry.name;
      const which = PY_EXT.test(name)
        ? "python"
        : TS_EXT.test(name)
          ? "ts"
          : JS_EXT.test(name)
            ? "js"
            : null;
      if (!which) continue;
      try {
        const text = await fs.readFile(path.join(dir, name), "utf-8");
        acc[which] += text.split("\n").length;
      } catch {
        // unreadable, skip
      }
    }
  }
  return acc;
}

export async function buildDetectionContext(projectRoot: string): Promise<DetectionContext> {
  const pyprojectText = await readSafe(path.join(projectRoot, "pyproject.toml"));
  const requirements = await readSafe(path.join(projectRoot, "requirements.txt"));
  const setupCfg = await readSafe(path.join(projectRoot, "setup.cfg"));
  const packageJson = await readSafe(path.join(projectRoot, "package.json"));

  const pyproject = pyprojectText ? parsePyproject(pyprojectText) : null;

  const pythonDeps = [
    ...pyprojectDeps(pyproject),
    ...(requirements ? parseRequirementsTxt(requirements) : []),
  ];
  const jsDeps = packageJson ? parsePackageJsonDeps(packageJson) : [];

  const has = {
    mypyConfig:
      (await fileExists(path.join(projectRoot, "mypy.ini"))) ||
      pyproject?.tool?.mypy !== undefined ||
      (setupCfg ? hasSetupCfgMypySection(setupCfg) : false),
    basedpyrightConfig: pyproject?.tool?.basedpyright !== undefined,
    pyrightConfig:
      (await fileExists(path.join(projectRoot, "pyrightconfig.json"))) ||
      pyproject?.tool?.pyright !== undefined,
    biomeConfig:
      (await fileExists(path.join(projectRoot, "biome.json"))) ||
      (await fileExists(path.join(projectRoot, "biome.jsonc"))),
    eslintConfig:
      (await fileExists(path.join(projectRoot, ".eslintrc.json"))) ||
      (await fileExists(path.join(projectRoot, ".eslintrc.js"))) ||
      (await fileExists(path.join(projectRoot, ".eslintrc.cjs"))) ||
      (await fileExists(path.join(projectRoot, "eslint.config.js"))) ||
      (await fileExists(path.join(projectRoot, "eslint.config.mjs"))),
    prettierConfig:
      (await fileExists(path.join(projectRoot, ".prettierrc"))) ||
      (await fileExists(path.join(projectRoot, ".prettierrc.json"))) ||
      (await fileExists(path.join(projectRoot, ".prettierrc.js"))) ||
      (await fileExists(path.join(projectRoot, "prettier.config.js"))),
    monorepoSignal: (() => {
      if (!packageJson) return false;
      try {
        const pkg = JSON.parse(packageJson) as { workspaces?: unknown };
        return pkg.workspaces !== undefined;
      } catch {
        return false;
      }
    })(),
  };

  const locFiles = await countLoc(projectRoot);

  return {
    projectRoot,
    pythonDeps,
    jsDeps,
    locFiles,
    has,
  };
}

const PYTHON_DEPS_FAVORING_MYPY = new Set(["django", "django-stubs", "sqlalchemy"]);
const PYTHON_DEPS_FAVORING_BASEDPYRIGHT = new Set(["fastapi", "pydantic", "sqlmodel"]);

export function resolvePythonTypeChecker(ctx: DetectionContext): "mypy" | "basedpyright" | "off" {
  if (ctx.has.mypyConfig) return "mypy";
  if (ctx.has.basedpyrightConfig) return "basedpyright";
  if (ctx.has.pyrightConfig) return "basedpyright";
  if (ctx.pythonDeps.some((d) => PYTHON_DEPS_FAVORING_MYPY.has(d))) return "mypy";
  if (ctx.pythonDeps.some((d) => PYTHON_DEPS_FAVORING_BASEDPYRIGHT.has(d))) return "basedpyright";
  if (ctx.locFiles.python > 20_000) return "basedpyright";
  return "basedpyright";
}

export function resolveJsFormatLint(ctx: DetectionContext): "eslint-prettier" | "biome" | "off" {
  if (ctx.has.biomeConfig) return "biome";
  if (ctx.has.eslintConfig || ctx.has.prettierConfig) return "eslint-prettier";
  return "eslint-prettier";
}

/**
 * Whether the type checker runs on `pre-commit` (vs deferred to `pre-push`).
 *
 * Always resolves to `'off'` per spec §11 — type-check on commit is rejected
 * by upstream tooling (pytest issue #291, husky+lint-staged guidance) because
 * 10–60s commits train users to bypass hooks with `--no-verify`. Users who
 * want it on can set `commit_type_check: on` explicitly.
 *
 * The `_ctx` parameter is retained for symmetry with the other resolvers and
 * for future use if the spec ever flips the default for small non-monorepo
 * repos. The `wizard-summary` reason text still reads `ctx` to surface the
 * codebase shape to the user — it does not influence this decision.
 *
 * @see docs/20260428_1430_SPEC_precommit-multilanguage-redesign.md §5.3, §11
 */
export function resolveCommitTypeCheck(_ctx: DetectionContext): "on" | "off" {
  return "off";
}

export function resolveCommitTestRun(_ctx: DetectionContext): "on" | "off" {
  return "off";
}

/**
 * Substitute `value: "auto"` on the four tooling-default flags
 * (`python_type_checker`, `js_format_lint`, `commit_type_check`,
 * `commit_test_run`) with the value resolved from the project's filesystem
 * signals. Explicit flag values pass through unchanged.
 *
 * Cheap on every-commit regenerations: returns the input unchanged when no
 * flag is set to `"auto"`, skipping the detection-context build entirely.
 *
 * Every CLI command that calls `generateHooksConfig` MUST run this first.
 * `generateHooksConfig` throws if it sees a literal `"auto"` value.
 */
export async function resolveAutoFlags(
  projectRoot: string,
  flags: import("#src/types/flags.js").ResolvedFlags,
): Promise<import("#src/types/flags.js").ResolvedFlags> {
  const needs = (key: string): boolean => flags[key]?.value === "auto";
  if (
    !needs("python_type_checker") &&
    !needs("js_format_lint") &&
    !needs("commit_type_check") &&
    !needs("commit_test_run")
  ) {
    return flags;
  }
  const ctx = await buildDetectionContext(projectRoot);
  const out: import("#src/types/flags.js").ResolvedFlags = { ...flags };
  if (needs("python_type_checker") && out["python_type_checker"]) {
    out["python_type_checker"] = {
      ...out["python_type_checker"],
      value: resolvePythonTypeChecker(ctx),
    };
  }
  if (needs("js_format_lint") && out["js_format_lint"]) {
    out["js_format_lint"] = {
      ...out["js_format_lint"],
      value: resolveJsFormatLint(ctx),
    };
  }
  if (needs("commit_type_check") && out["commit_type_check"]) {
    out["commit_type_check"] = {
      ...out["commit_type_check"],
      value: resolveCommitTypeCheck(ctx),
    };
  }
  if (needs("commit_test_run") && out["commit_test_run"]) {
    out["commit_test_run"] = {
      ...out["commit_test_run"],
      value: resolveCommitTestRun(ctx),
    };
  }
  return out;
}
