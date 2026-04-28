import { describe, it, expect } from "vitest";
import {
  computeToolingDefaults,
  buildToolingReasons,
  renderSummary,
} from "#src/cli/wizard-summary.js";
import type { DetectionContext } from "#src/core/hooks/auto-detection.js";

const baseCtx: DetectionContext = {
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

describe("wizard summary", () => {
  it("computeToolingDefaults returns industry defaults for empty ctx", () => {
    expect(computeToolingDefaults(baseCtx)).toEqual({
      python_type_checker: "basedpyright",
      js_format_lint: "eslint-prettier",
      commit_type_check: "off",
      commit_test_run: "off",
    });
  });

  it("computeToolingDefaults picks mypy for django projects", () => {
    expect(computeToolingDefaults({ ...baseCtx, pythonDeps: ["django"] }).python_type_checker).toBe(
      "mypy",
    );
  });

  it("buildToolingReasons surfaces the matching signal", () => {
    expect(buildToolingReasons({ ...baseCtx, pythonDeps: ["fastapi"] }).pyReason).toMatch(
      /fastapi/,
    );
    expect(
      buildToolingReasons({ ...baseCtx, has: { ...baseCtx.has, biomeConfig: true } }).jsReason,
    ).toMatch(/biome/);
    expect(
      buildToolingReasons({ ...baseCtx, has: { ...baseCtx.has, monorepoSignal: true } }).ttReason,
    ).toMatch(/monorepo/);
  });

  it("renderSummary contains all four labels and the resolved values", () => {
    const d = computeToolingDefaults(baseCtx);
    const r = buildToolingReasons(baseCtx);
    const text = renderSummary(d, r);
    expect(text).toMatch(/Python type checker/);
    expect(text).toMatch(/JS lint\+format/);
    expect(text).toMatch(/Type-check on commit/);
    expect(text).toMatch(/Tests on commit/);
    expect(text).toMatch(/basedpyright/);
    expect(text).toMatch(/eslint-prettier/);
  });
});
