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
  type DetectionContext,
} from "#src/core/hooks/auto-detection.js";

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
  it("off for large codebases", () => {
    expect(
      resolveCommitTypeCheck({ ...empty, locFiles: { python: 15_000, ts: 10_000, js: 0 } }),
    ).toBe("off");
  });

  it("off for monorepos", () => {
    expect(resolveCommitTypeCheck({ ...empty, has: { ...empty.has, monorepoSignal: true } })).toBe(
      "off",
    );
  });

  it("falls back to off (industry default)", () => {
    expect(resolveCommitTypeCheck(empty)).toBe("off");
  });
});

describe("resolveCommitTestRun", () => {
  it("always off", () => {
    expect(resolveCommitTestRun(empty)).toBe("off");
    expect(resolveCommitTestRun({ ...empty, locFiles: { python: 1, ts: 1, js: 1 } })).toBe("off");
  });
});
