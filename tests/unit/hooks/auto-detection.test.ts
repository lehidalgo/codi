import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildDetectionContext,
  resolvePythonTypeChecker,
  resolveJsFormatLint,
  resolveCommitTypeCheck,
  resolveCommitTestRun,
  resolveAutoFlags,
  type DetectionContext,
} from "#src/core/hooks/auto-detection.js";
import type { ResolvedFlags } from "#src/types/flags.js";

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "codi-detect-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf-8");
  }
  return dir;
}

describe("buildDetectionContext", () => {
  it("parses pyproject.toml and reads dependencies", async () => {
    const root = await fixture({
      "pyproject.toml": `[project]\nname = "x"\ndependencies = ["fastapi", "pydantic>=2"]\n`,
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.pythonDeps).toEqual(expect.arrayContaining(["fastapi", "pydantic"]));
  });

  it("detects django from requirements.txt", async () => {
    const root = await fixture({
      "requirements.txt": "Django==5.0\nrequests\n",
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.pythonDeps).toContain("django");
  });

  it("counts python and ts LOC roughly", async () => {
    const root = await fixture({
      "a.py": "x = 1\ny = 2\n",
      "b.ts": "const x = 1;\nconst y = 2;\n",
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.locFiles.python).toBeGreaterThan(0);
    expect(ctx.locFiles.ts).toBeGreaterThan(0);
  });

  it("reads existing tool-config presence flags", async () => {
    const root = await fixture({
      "mypy.ini": "[mypy]\n",
      "biome.json": "{}",
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.has.mypyConfig).toBe(true);
    expect(ctx.has.biomeConfig).toBe(true);
  });

  it("detects [tool.mypy] inside pyproject.toml", async () => {
    const root = await fixture({
      "pyproject.toml": "[tool.mypy]\nstrict = true\n",
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.has.mypyConfig).toBe(true);
  });

  it("detects [tool.mypy] in a realistic pyproject with [project] header", async () => {
    const root = await fixture({
      "pyproject.toml": `[project]
name = "x"
version = "0.1.0"

[tool.mypy]
strict = true
`,
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.has.mypyConfig).toBe(true);
    expect(ctx.has.basedpyrightConfig).toBe(false);
  });

  it("detects setup.cfg [mypy] section when no pyproject", async () => {
    const root = await fixture({
      "setup.cfg": "[metadata]\nname = x\n\n[mypy]\nstrict = True\n",
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.has.mypyConfig).toBe(true);
  });

  it("reads Poetry [tool.poetry.dependencies] without including 'python'", async () => {
    const root = await fixture({
      "pyproject.toml": `[tool.poetry]
name = "x"
version = "0.1"

[tool.poetry.dependencies]
python = "^3.11"
django = "^5.0"
`,
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.pythonDeps).toContain("django");
    expect(ctx.pythonDeps).not.toContain("python");
  });

  it("ignores comments mentioning [tool.mypy] (TOML parser, not regex)", async () => {
    const root = await fixture({
      "pyproject.toml": `[project]
name = "x"
# this comment mentions [tool.mypy] but no actual section exists
`,
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.has.mypyConfig).toBe(false);
  });

  it("detects [tool.basedpyright] section", async () => {
    const root = await fixture({
      "pyproject.toml": "[tool.basedpyright]\ntypeCheckingMode = 'strict'\n",
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.has.basedpyrightConfig).toBe(true);
  });

  it("detects monorepo signal from package.json workspaces", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ name: "x", workspaces: ["packages/*"] }),
    });
    const ctx = await buildDetectionContext(root);
    expect(ctx.has.monorepoSignal).toBe(true);
  });
});

const empty: DetectionContext = {
  projectRoot: "/",
  pythonDeps: [],
  jsDeps: [],
  locFiles: { python: 0, ts: 0, js: 0 },
  has: {
    mypyConfig: false,
    basedpyrightConfig: false,
    pyrightConfig: false,
    biomeConfig: false,
    eslintConfig: false,
    prettierConfig: false,
    monorepoSignal: false,
  },
};

describe("resolvePythonTypeChecker", () => {
  it("respects [tool.mypy]", () => {
    expect(resolvePythonTypeChecker({ ...empty, has: { ...empty.has, mypyConfig: true } })).toBe(
      "mypy",
    );
  });

  it("respects [tool.basedpyright]", () => {
    expect(
      resolvePythonTypeChecker({ ...empty, has: { ...empty.has, basedpyrightConfig: true } }),
    ).toBe("basedpyright");
  });

  it("treats existing pyright config as basedpyright (compatible)", () => {
    expect(resolvePythonTypeChecker({ ...empty, has: { ...empty.has, pyrightConfig: true } })).toBe(
      "basedpyright",
    );
  });

  it("picks mypy for django/sqlalchemy projects", () => {
    expect(resolvePythonTypeChecker({ ...empty, pythonDeps: ["django"] })).toBe("mypy");
  });

  it("picks basedpyright for fastapi/pydantic projects", () => {
    expect(resolvePythonTypeChecker({ ...empty, pythonDeps: ["fastapi", "pydantic"] })).toBe(
      "basedpyright",
    );
  });

  it("picks basedpyright for large codebases", () => {
    expect(
      resolvePythonTypeChecker({
        ...empty,
        locFiles: { python: 25_000, ts: 0, js: 0 },
      }),
    ).toBe("basedpyright");
  });

  it("falls back to basedpyright", () => {
    expect(resolvePythonTypeChecker(empty)).toBe("basedpyright");
  });
});

describe("resolveJsFormatLint", () => {
  it("biome.json wins", () => {
    expect(resolveJsFormatLint({ ...empty, has: { ...empty.has, biomeConfig: true } })).toBe(
      "biome",
    );
  });

  it("existing eslint config picks eslint-prettier", () => {
    expect(resolveJsFormatLint({ ...empty, has: { ...empty.has, eslintConfig: true } })).toBe(
      "eslint-prettier",
    );
  });

  it("falls back to eslint-prettier", () => {
    expect(resolveJsFormatLint(empty)).toBe("eslint-prettier");
  });
});

describe("resolveCommitTypeCheck", () => {
  it("always resolves to off (spec §11 — defer to pre-push)", () => {
    // The function is a constant by design: type-check on commit is rejected
    // by upstream tooling (pytest #291, husky+lint-staged guidance). The ctx
    // parameter is retained for symmetry with sibling resolvers and for the
    // wizard reason text, but does not influence the outcome.
    expect(resolveCommitTypeCheck(empty)).toBe("off");
    expect(
      resolveCommitTypeCheck({ ...empty, locFiles: { python: 15_000, ts: 10_000, js: 0 } }),
    ).toBe("off");
    expect(resolveCommitTypeCheck({ ...empty, has: { ...empty.has, monorepoSignal: true } })).toBe(
      "off",
    );
  });
});

describe("resolveCommitTestRun", () => {
  it("always off", () => {
    expect(resolveCommitTestRun(empty)).toBe("off");
    expect(resolveCommitTestRun({ ...empty, locFiles: { python: 1, ts: 1, js: 1 } })).toBe("off");
  });
});

describe("resolveAutoFlags", () => {
  function flagsWithAuto(): ResolvedFlags {
    return {
      python_type_checker: { mode: "enabled", value: "auto", source: "default", locked: false },
      js_format_lint: { mode: "enabled", value: "auto", source: "default", locked: false },
      commit_type_check: { mode: "enabled", value: "auto", source: "default", locked: false },
      commit_test_run: { mode: "enabled", value: "auto", source: "default", locked: false },
    };
  }

  it("substitutes 'auto' for resolved values from project signals (mypy wins)", async () => {
    const root = await fixture({
      "pyproject.toml": "[project]\nname='x'\nversion='0.1.0'\n\n[tool.mypy]\nstrict=true\n",
    });
    const out = await resolveAutoFlags(root, flagsWithAuto());
    expect(out["python_type_checker"]?.value).toBe("mypy");
    expect(out["js_format_lint"]?.value).toBe("eslint-prettier");
    expect(out["commit_type_check"]?.value).toBe("off");
    expect(out["commit_test_run"]?.value).toBe("off");
  });

  it("substitutes 'auto' to basedpyright for FastAPI projects", async () => {
    const root = await fixture({
      "pyproject.toml": `[project]\nname="x"\nversion="0.1.0"\ndependencies = ["fastapi"]\n`,
    });
    const out = await resolveAutoFlags(root, flagsWithAuto());
    expect(out["python_type_checker"]?.value).toBe("basedpyright");
  });

  it("returns input unchanged when no flag is 'auto' (no detection cost)", async () => {
    const explicit: ResolvedFlags = {
      python_type_checker: { mode: "enabled", value: "mypy", source: "user", locked: false },
      js_format_lint: { mode: "enabled", value: "biome", source: "user", locked: false },
    };
    const out = await resolveAutoFlags("/no/such/dir", explicit);
    expect(out).toBe(explicit);
  });

  it("only resolves the flags that are 'auto', leaves others untouched", async () => {
    const root = await fixture({
      "pyproject.toml": "[tool.mypy]\nstrict=true\n",
    });
    const mixed: ResolvedFlags = {
      python_type_checker: { mode: "enabled", value: "auto", source: "default", locked: false },
      js_format_lint: { mode: "enabled", value: "biome", source: "user", locked: false },
    };
    const out = await resolveAutoFlags(root, mixed);
    expect(out["python_type_checker"]?.value).toBe("mypy");
    expect(out["js_format_lint"]?.value).toBe("biome");
  });
});
