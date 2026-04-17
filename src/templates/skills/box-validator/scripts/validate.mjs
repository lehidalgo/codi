#!/usr/bin/env node
// validate.mjs — Box Layout Theory validator CLI.
//
// Usage:
//   node validate.mjs --input <path> --width <px> --height <px>
//     [--tolerance <px>] [--threshold <0-1>] [--preset strict|lenient]
//     [--pretty]
//
// All numeric thresholds derive from a ValidationContext computed from
// canvas dimensions + tree stats — see lib/context.mjs. The CLI only
// lets you override the tolerance floor, the pass threshold, and pick a
// severity preset.
//
// Exit codes: 0 valid, 1 invalid, 2 error.
// Default output: JSON on stdout. --pretty for human text.

import { renderAndExtract } from "./lib/renderer.mjs";
import { annotate } from "./lib/tree-walker.mjs";
import { runRules } from "./lib/rule-engine.mjs";
import { buildReport } from "./lib/report-builder.mjs";
import { computeContext, applyPreset } from "./lib/context.mjs";

function parseArgs(argv) {
  const args = { threshold: 0.85, pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pretty") args.pretty = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[++i];
      if (key === "input") args.input = val;
      else if (key === "width") args.width = Number(val);
      else if (key === "height") args.height = Number(val);
      else if (key === "tolerance") args.toleranceOverride = Number(val);
      else if (key === "threshold") args.threshold = Number(val);
      else if (key === "preset") args.preset = val;
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    "Usage: validate.mjs --input <path> --width <px> --height <px> [options]\n" +
      "Options:\n" +
      "  --tolerance <px>        override computed tolerance (default scales with canvas)\n" +
      "  --threshold <0-1>       pass threshold (default 0.85)\n" +
      "  --preset <strict|lenient>  severity preset\n" +
      "  --pretty                human-readable output instead of JSON\n",
  );
}

function validateArgs(args) {
  if (args.help) return "help";
  if (!args.input) return "missing --input";
  if (!args.width || !args.height) return "missing --width / --height";
  if (args.threshold < 0 || args.threshold > 1) return "--threshold must be in [0,1]";
  if (args.preset && !["strict", "lenient"].includes(args.preset)) {
    return "--preset must be 'strict' or 'lenient'";
  }
  return null;
}

function formatPretty(report) {
  const lines = [];
  lines.push(`Box Validator Report`);
  lines.push(`  valid:     ${report.valid}`);
  lines.push(`  score:     ${report.score} / ${report.threshold}`);
  lines.push(
    `  nodes:     ${report.summary.totalNodes} (${report.summary.parentNodes} parents, ${report.summary.leafNodes} leaves)`,
  );
  lines.push(
    `  maxDepth:  ${report.summary.maxDepth}   siblingGroups: ${report.summary.siblingGroups}`,
  );
  lines.push(
    `  errors:    ${report.summary.errors}    warnings: ${report.summary.warnings}`,
  );
  if (report.violations.length > 0) {
    lines.push("");
    lines.push("Violations:");
    for (const v of report.violations) {
      lines.push(`  [${v.rule} ${v.severity}] ${v.path}`);
      lines.push(`    ${v.message}`);
      lines.push(`    fix: ${v.fix}`);
    }
  }
  lines.push("");
  lines.push("Fix instructions:");
  lines.push(`  ${report.fixInstructions}`);
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const error = validateArgs(args);
  if (error === "help") {
    printHelp();
    return 0;
  }
  if (error) {
    process.stderr.write(`error: ${error}\n`);
    printHelp();
    return 2;
  }

  try {
    const raw = await renderAndExtract({
      inputPath: args.input,
      width: args.width,
      height: args.height,
    });

    // Two-pass context build: we need nodeCount for the scoring
    // normalizer, but nodeCount comes from tree-walker. Build a
    // provisional context for annotation (nodeCount unused there),
    // then rebuild a final context once we know the real count.
    const overrides = collectOverrides(args);
    const provisional = computeContext({
      canvasWidth: args.width,
      canvasHeight: args.height,
      nodeCount: 1,
      overrides,
    });
    const { root, siblingGroups, nodeCount } = annotate(raw, provisional);
    const context = computeContext({
      canvasWidth: args.width,
      canvasHeight: args.height,
      nodeCount,
      overrides,
    });

    const violations = runRules(root, siblingGroups, context);
    const report = buildReport({
      root,
      siblingGroups,
      violations,
      threshold: args.threshold,
      context,
    });

    if (args.pretty) {
      process.stdout.write(formatPretty(report) + "\n");
    } else {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    }
    return report.valid ? 0 : 1;
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    if (e.cause) process.stderr.write(`cause: ${e.cause.message}\n`);
    return 2;
  }
}

// Merge CLI overrides into the context input. Supports --tolerance and
// --preset. Preset is applied first, then explicit tolerance wins.
function collectOverrides(args) {
  let overrides = {};
  if (args.preset) overrides = applyPreset(overrides, args.preset);
  if (args.toleranceOverride != null) {
    overrides.tolerance = args.toleranceOverride;
    overrides.errorTolerance = args.toleranceOverride * 4;
  }
  return overrides;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`fatal: ${err && err.stack ? err.stack : err}\n`);
    process.exit(2);
  },
);
