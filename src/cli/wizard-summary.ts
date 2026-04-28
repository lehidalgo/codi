import * as p from "@clack/prompts";
import {
  resolvePythonTypeChecker,
  resolveJsFormatLint,
  resolveCommitTypeCheck,
  resolveCommitTestRun,
  buildDetectionContext,
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

export interface ToolingPromptResult {
  /** Whether the user opted to skip pre-commit hook installation entirely. */
  skipped: boolean;
  /** Concrete picks. When skipped=true these still hold the auto defaults. */
  accepted: ToolingDefaults;
}

/**
 * Interactive wizard step: shows the auto-resolved tooling defaults and
 * offers Accept (Enter) / Customize / Skip. On Customize, walks the user
 * through one prompt per flag with the auto-pick pre-highlighted.
 *
 * Build the DetectionContext internally so callers can pass just the
 * project root.
 */
export async function promptToolingDefaults(projectRoot: string): Promise<ToolingPromptResult> {
  const ctx = await buildDetectionContext(projectRoot);
  const defaults = computeToolingDefaults(ctx);
  const reasons = buildToolingReasons(ctx);

  p.note(renderSummary(defaults, reasons), "Pre-commit hooks");

  const choice = await p.select({
    message: "Accept defaults?",
    options: [
      { value: "accept", label: "Accept (Enter)" },
      { value: "customize", label: "Customize each" },
      { value: "skip", label: "Skip pre-commit hooks entirely" },
    ],
    initialValue: "accept",
  });

  if (p.isCancel(choice) || choice === "accept") {
    return { skipped: false, accepted: defaults };
  }
  if (choice === "skip") {
    return { skipped: true, accepted: defaults };
  }

  // Customize walkthrough — one prompt per flag with the auto-pick highlighted.
  const py = await p.select({
    message: "Python type checker",
    initialValue: defaults.python_type_checker,
    options: [
      { value: "mypy", label: "mypy (stable, slower)" },
      { value: "basedpyright", label: "basedpyright (fast, no npm)" },
      { value: "pyright", label: "pyright (npm dep)" },
      { value: "off", label: "off" },
    ],
  });
  const js = await p.select({
    message: "JS lint+format toolchain",
    initialValue: defaults.js_format_lint,
    options: [
      { value: "eslint-prettier", label: "eslint+prettier" },
      { value: "biome", label: "biome (Rust, faster, fewer plugins)" },
      { value: "off", label: "off" },
    ],
  });
  const tt = await p.select({
    message: "Run type checker on commit?",
    initialValue: defaults.commit_type_check,
    options: [
      { value: "on", label: "on (slower commits)" },
      { value: "off", label: "off (defer to pre-push, recommended)" },
    ],
  });
  const tr = await p.select({
    message: "Run test suite on commit?",
    initialValue: defaults.commit_test_run,
    options: [
      { value: "on", label: "on (slow)" },
      { value: "off", label: "off (defer to pre-push or CI, recommended)" },
    ],
  });

  return {
    skipped: false,
    accepted: {
      python_type_checker: (p.isCancel(py)
        ? defaults.python_type_checker
        : py) as ToolingDefaults["python_type_checker"],
      js_format_lint: (p.isCancel(js)
        ? defaults.js_format_lint
        : js) as ToolingDefaults["js_format_lint"],
      commit_type_check: (p.isCancel(tt)
        ? defaults.commit_type_check
        : tt) as ToolingDefaults["commit_type_check"],
      commit_test_run: (p.isCancel(tr)
        ? defaults.commit_test_run
        : tr) as ToolingDefaults["commit_test_run"],
    },
  };
}
