import {
  resolvePythonTypeChecker,
  resolveJsFormatLint,
  resolveCommitTypeCheck,
  resolveCommitTestRun,
  type DetectionContext,
} from "#src/core/hooks/auto-detection.js";

export interface ToolingDefaults {
  python_type_checker: "mypy" | "basedpyright" | "pyright" | "off";
  js_format_lint: "eslint-prettier" | "biome" | "off";
  commit_type_check: "on" | "off";
  commit_test_run: "on" | "off";
}

export interface ToolingReasons {
  pyReason: string;
  jsReason: string;
  ttReason: string;
  trReason: string;
}

/** Pure: derive concrete tooling picks from the detection context. */
export function computeToolingDefaults(ctx: DetectionContext): ToolingDefaults {
  return {
    python_type_checker: resolvePythonTypeChecker(ctx),
    js_format_lint: resolveJsFormatLint(ctx),
    commit_type_check: resolveCommitTypeCheck(ctx),
    commit_test_run: resolveCommitTestRun(ctx),
  };
}

/** Pure: human-readable reason strings paired with the resolved values. */
export function buildToolingReasons(ctx: DetectionContext): ToolingReasons {
  return {
    pyReason: ctx.has.mypyConfig
      ? "signal: mypy.ini or [tool.mypy]"
      : ctx.has.basedpyrightConfig
        ? "signal: [tool.basedpyright]"
        : ctx.has.pyrightConfig
          ? "signal: [tool.pyright] (compatible with basedpyright)"
          : ctx.pythonDeps.includes("django")
            ? "signal: django dependency"
            : ctx.pythonDeps.includes("fastapi")
              ? "signal: fastapi dependency"
              : ctx.pythonDeps.includes("pydantic")
                ? "signal: pydantic dependency"
                : ctx.locFiles.python > 20_000
                  ? "signal: python LOC > 20k (favours speed)"
                  : "fallback default",
    jsReason: ctx.has.biomeConfig
      ? "signal: biome.json"
      : ctx.has.eslintConfig
        ? "signal: existing eslint config"
        : ctx.has.prettierConfig
          ? "signal: existing prettier config"
          : "fallback default",
    ttReason: ctx.has.monorepoSignal
      ? "signal: monorepo (workspaces) — defer to pre-push"
      : ctx.locFiles.ts + ctx.locFiles.python > 20_000
        ? "signal: codebase > 20k LOC — defer to pre-push"
        : "default: defer to pre-push",
    trReason: "industry default — defer to pre-push or CI",
  };
}

/** Pure: the multi-line summary string shown to the user during init. */
export function renderSummary(d: ToolingDefaults, r: ToolingReasons): string {
  const pad = (s: string): string => s.padEnd(15);
  return [
    "Tooling defaults Codi will install:",
    "",
    `  Python type checker     ${pad(d.python_type_checker)} (${r.pyReason})`,
    `  JS lint+format          ${pad(d.js_format_lint)} (${r.jsReason})`,
    `  Type-check on commit    ${pad(d.commit_type_check)} (${r.ttReason})`,
    `  Tests on commit         ${pad(d.commit_test_run)} (${r.trReason})`,
  ].join("\n");
}
