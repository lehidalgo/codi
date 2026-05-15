#!/usr/bin/env node
/**
 * ISSUE-015 architectural guard.
 *
 * Rejects imports that flow UPWARD through the architecture layers.
 * Dependencies must flow inward: cli/ → core/, runtime/ → core/, etc.
 * core/ and runtime/ files must never import from cli/.
 *
 * The rule is documented in src/templates/rules/architecture.md
 * ("Dependencies flow inward"). This guard enforces it mechanically.
 *
 * Inspected patterns inside src/core/** and src/runtime/**:
 *   import ... from "#src/cli/..."        (Node subpath)
 *   import ... from "../cli/..."          (relative)
 *   import ... from "../../cli/..."       (deep relative — already forbidden
 *                                          by codi-typescript.md, but caught
 *                                          here too)
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one upward-layer import found
 *   2 — internal error walking the tree
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const FORBIDDEN_LAYERS = [
  // (consumer-root, forbidden-target)
  { from: "src/core", to: "cli" },
  { from: "src/runtime", to: "cli" },
];

const ALIAS_IMPORT_RE = /from\s+"#src\/cli\//g;
const RELATIVE_CLI_RE = /from\s+"(?:\.\.\/)+cli\//g;

/**
 * CORE-003 — symbol-level boundary rules.
 *
 * `utils/` and `adapters/` must NOT do a *value* import of `Logger` from
 * `core/output/logger`. They may use `import type { Logger }` (stripped
 * at compile, zero runtime dep) — utils/adapters thread loggers via DI
 * options instead of calling `Logger.getInstance()` directly.
 *
 * Each rule: (consumer-root, regex matching the offending import line).
 * The regex must NOT match `import type { ... }` (type-only imports).
 */
const FORBIDDEN_SYMBOL_IMPORTS = [
  {
    from: "src/utils",
    pattern: /^\s*import\s+(?!type\b)\{[^}]*\bLogger\b[^}]*\}\s+from\s+["'][^"']*core\/output\/logger/,
    message: "utils/ may only import `type { Logger }` — pass via DI options instead",
  },
  {
    from: "src/adapters",
    pattern: /^\s*import\s+(?!type\b)\{[^}]*\bLogger\b[^}]*\}\s+from\s+["'][^"']*core\/output\/logger/,
    message: "adapters/ may only import `type { Logger }` — pass via GenerateOptions.log",
  },
  {
    // CORE-006 — leaf adapter files must not value-import heartbeat-hooks
    // directly. The single allowed importer is `heartbeat-emission.ts`,
    // which wraps tracker/observer/launcher emission behind a stable
    // `buildHeartbeatArtifacts()` API. `claude-settings.ts` is the one
    // exception that still needs the filename constants for its hook
    // command builder; it stays on the allowlist explicitly.
    from: "src/adapters",
    pattern: /^\s*import\s+(?!type\b)[^;]*from\s+["'][^"']*core\/hooks\/heartbeat-hooks/,
    message:
      "adapters/ leaf adapters must not import heartbeat-hooks directly — " +
      "use buildHeartbeatArtifacts() from ./heartbeat-emission.js (CORE-006)",
    allowFiles: ["heartbeat-emission.ts", "claude-settings.ts"],
  },
];

async function walk(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walk(full, out);
      continue;
    }
    if (entry.name.endsWith(".ts")) out.push(full);
  }
}

async function findOffenders() {
  const offenders = [];
  for (const { from, to } of FORBIDDEN_LAYERS) {
    const root = join(REPO, from);
    const files = [];
    try {
      await walk(root, files);
    } catch (err) {
      console.error(`[guard-layering] walk failed for ${from}: ${err.message ?? err}`);
      process.exit(2);
    }
    for (const abs of files) {
      let src;
      try {
        src = await readFile(abs, "utf8");
      } catch (err) {
        console.error(`[guard-layering] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`);
        process.exit(2);
      }
      const aliasMatches = src.match(ALIAS_IMPORT_RE) ?? [];
      const relMatches = src.match(RELATIVE_CLI_RE) ?? [];
      if (aliasMatches.length === 0 && relMatches.length === 0) continue;
      const lines = src.split(/\r?\n/);
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        if (
          ALIAS_IMPORT_RE.test(lines[i]) ||
          RELATIVE_CLI_RE.test(lines[i]) ||
          /from\s+"#src\/cli\//.test(lines[i]) ||
          /from\s+"(?:\.\.\/)+cli\//.test(lines[i])
        ) {
          hits.push({ line: i + 1, text: lines[i].trim() });
        }
      }
      offenders.push({
        path: relative(REPO, abs),
        from,
        to,
        hits,
      });
    }
  }

  // CORE-003 / CORE-006: symbol-level checks. Scan each consumer root for
  // the specific forbidden import patterns and report each match as an
  // offender alongside the layer offenders. Rules may declare an
  // `allowFiles` array of basenames that are exempt (e.g. the single
  // central helper that consolidates an otherwise-banned import).
  for (const { from, pattern, message, allowFiles } of FORBIDDEN_SYMBOL_IMPORTS) {
    const root = join(REPO, from);
    const files = [];
    try {
      await walk(root, files);
    } catch (err) {
      console.error(`[guard-layering] walk failed for ${from}: ${err.message ?? err}`);
      process.exit(2);
    }
    for (const abs of files) {
      const basename = abs.split("/").pop() ?? "";
      if (allowFiles && allowFiles.includes(basename)) continue;
      let src;
      try {
        src = await readFile(abs, "utf8");
      } catch (err) {
        console.error(`[guard-layering] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`);
        process.exit(2);
      }
      const lines = src.split(/\r?\n/);
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        if (pattern.test(lines[i])) {
          hits.push({ line: i + 1, text: lines[i].trim() });
        }
      }
      if (hits.length > 0) {
        offenders.push({
          path: relative(REPO, abs),
          from,
          to: "forbidden symbol import",
          hits,
          symbolMessage: message,
        });
      }
    }
  }

  return offenders;
}

async function main() {
  const offenders = await findOffenders();
  if (offenders.length === 0) {
    console.log(
      "[guard-layering] no upward-layer imports found — pass (core/ and runtime/ are independent of cli/).",
    );
    process.exit(0);
  }

  console.error("[guard-layering] FAIL — boundary violations detected:");
  for (const off of offenders) {
    console.error(`\n  ${off.path}  (${off.from} → ${off.to})`);
    for (const hit of off.hits) {
      console.error(`    line ${hit.line}: ${hit.text}`);
    }
    if (off.symbolMessage) {
      console.error(`    → ${off.symbolMessage}`);
    }
  }
  console.error(
    "\nWhy: dependencies must flow inward — cli/ depends on core/, never the reverse.\n" +
      "utils/ and adapters/ must not value-import core/output/logger — pass via DI.\n" +
      "Fix options (in order of preference):\n" +
      "  1. For Logger: switch to `import type { Logger } from \"#src/types/logger.js\"`\n" +
      "     and read the injected logger from your function's options bag.\n" +
      "  2. Move the imported symbol DOWN a layer (cli/ → core/ or types/).\n" +
      "     Pure data / types / errors almost always belong in core/.\n" +
      "  3. Pass the cli-side symbol as a function parameter from the\n" +
      "     composition root (cli/) so core/ never imports it.\n" +
      "  4. Last resort: define a port interface in core/ and implement it in cli/.\n" +
      "See src/templates/rules/architecture.md for the canonical rule.",
  );
  process.exit(1);
}

main();
