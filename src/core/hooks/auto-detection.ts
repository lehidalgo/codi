import fs from "node:fs/promises";
import path from "node:path";
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

const PYPROJECT_DEPS_RE = /dependencies\s*=\s*\[([^\]]*)\]/m;
const TOOL_MYPY_RE = /\[tool\.mypy\]/m;
const TOOL_BASEDPYRIGHT_RE = /\[tool\.basedpyright\]/m;
const TOOL_PYRIGHT_RE = /\[tool\.pyright\]/m;

async function readSafe(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
}

function parsePyprojectDeps(text: string): string[] {
  const m = PYPROJECT_DEPS_RE.exec(text);
  if (!m) return [];
  return m[1]!
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .map((s) => s.split(/[<>=!~\s]/)[0]!.toLowerCase())
    .filter(Boolean);
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
  const pyproject = await readSafe(path.join(projectRoot, "pyproject.toml"));
  const requirements = await readSafe(path.join(projectRoot, "requirements.txt"));
  const packageJson = await readSafe(path.join(projectRoot, "package.json"));

  const pythonDeps = [
    ...(pyproject ? parsePyprojectDeps(pyproject) : []),
    ...(requirements ? parseRequirementsTxt(requirements) : []),
  ];
  const jsDeps = packageJson ? parsePackageJsonDeps(packageJson) : [];

  const has = {
    mypyConfig:
      (await fileExists(path.join(projectRoot, "mypy.ini"))) ||
      (pyproject ? TOOL_MYPY_RE.test(pyproject) : false),
    basedpyrightConfig: pyproject ? TOOL_BASEDPYRIGHT_RE.test(pyproject) : false,
    pyrightConfig:
      (await fileExists(path.join(projectRoot, "pyrightconfig.json"))) ||
      (pyproject ? TOOL_PYRIGHT_RE.test(pyproject) : false),
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

export function resolveCommitTypeCheck(ctx: DetectionContext): "on" | "off" {
  const totalLoc = ctx.locFiles.ts + ctx.locFiles.python;
  if (totalLoc > 20_000) return "off";
  if (ctx.has.monorepoSignal) return "off";
  return "off";
}

export function resolveCommitTestRun(_ctx: DetectionContext): "on" | "off" {
  return "off";
}
