#!/usr/bin/env node
/**
 * CORE-024 — meta-skill isolation guard.
 *
 * Skills under `src/templates/skills/<codi-*|dev-*>/` are *meta-skills*:
 * they ship with codi to bootstrap codi itself (brand, init-knowledge-
 * base, rule-creator, skill-creator, e2e-testing, etc.). To keep them
 * portable, replaceable, and removable in user-customised installs,
 * they MUST NOT depend on codi's internal layers:
 *
 *   - `#src/core/**`       — core runtime
 *   - `#src/cli/**`        — Commander handlers
 *   - `#src/runtime/**`    — brain-backed workflow runtime
 *   - `#src/utils/**`      — internal helpers
 *   - `#src/adapters/**`   — generator adapters
 *
 * Allowed dependencies:
 *   - `#src/constants.js`           — project-wide constants (PROJECT_NAME, etc.)
 *   - `#src/templates/skills/**`    — sibling skill modules
 *   - `#src/types/**`               — pure type definitions (Logger interface, Result, etc.)
 *   - `../**` / `./**` relative imports staying inside the skill
 *   - third-party packages (`@clack/prompts`, `yaml`, etc.)
 *   - Node built-ins (`node:fs`, `node:path`, etc.)
 *
 * The naming convention `codi-*` / `dev-*` is enforced separately by
 * the artifact catalog. This guard treats those prefixes as the
 * authoritative tag — adding a new meta-skill means following the
 * convention; renaming a meta-skill out of the namespace would silently
 * lift the isolation guard, which is acceptable (intentional opt-out).
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one banned import found
 *   2 — internal error walking the tree
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const SKILLS_ROOT = "src/templates/skills";
const META_PREFIXES = ["codi-", "dev-"];

// Banned import roots. Use word boundary to avoid catching e.g. `#src/core-x`
// (no such alias exists, but defensive).
const BANNED_ROOTS = ["#src/core", "#src/cli", "#src/runtime", "#src/utils", "#src/adapters"];

function isMetaSkillDir(name) {
  return META_PREFIXES.some((p) => name.startsWith(p));
}

async function listMetaSkills() {
  const root = join(REPO, SKILLS_ROOT);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (err) {
    console.error(
      `[guard-meta-skill-isolation] cannot read ${SKILLS_ROOT}: ${err.message ?? err}`,
    );
    process.exit(2);
  }
  return entries
    .filter((e) => e.isDirectory() && isMetaSkillDir(e.name))
    .map((e) => e.name);
}

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
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    out.push(full);
  }
}

function findBannedImports(src) {
  // Match `import ... from "<root>..."` and `from "<root>..."` (re-exports).
  // Quote-agnostic: handles both single and double quotes.
  const lines = src.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Quick reject: only inspect lines that look import-shaped.
    if (!/\bfrom\s+["']/.test(line)) continue;
    for (const root of BANNED_ROOTS) {
      // `from "<root>"` or `from "<root>/...`
      const re = new RegExp(`\\bfrom\\s+["']${root}(?:/|["'])`);
      if (re.test(line)) {
        hits.push({ line: i + 1, text: line.trim(), root });
        break;
      }
    }
  }
  return hits;
}

async function main() {
  const metaSkills = await listMetaSkills();
  const offenders = [];

  for (const skillName of metaSkills) {
    const skillDir = join(REPO, SKILLS_ROOT, skillName);
    const files = [];
    try {
      await walk(skillDir, files);
    } catch (err) {
      console.error(
        `[guard-meta-skill-isolation] walk failed for ${skillName}: ${err.message ?? err}`,
      );
      process.exit(2);
    }
    for (const abs of files) {
      let src;
      try {
        src = await readFile(abs, "utf8");
      } catch (err) {
        console.error(
          `[guard-meta-skill-isolation] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`,
        );
        process.exit(2);
      }
      const hits = findBannedImports(src);
      if (hits.length > 0) {
        offenders.push({ path: relative(REPO, abs), hits });
      }
    }
  }

  if (offenders.length === 0) {
    console.log(
      `[guard-meta-skill-isolation] ${metaSkills.length} meta-skill(s) (codi-* + dev-*) — no imports from core/cli/runtime/utils/adapters. Pass.`,
    );
    process.exit(0);
  }

  console.error(
    `[guard-meta-skill-isolation] FAIL — meta-skills must not import from codi's internal layers:`,
  );
  for (const off of offenders) {
    console.error(`\n  ${off.path}`);
    for (const hit of off.hits) {
      console.error(`    line ${hit.line}: ${hit.text}`);
      console.error(`       → banned root: ${hit.root}`);
    }
  }
  console.error(
    "\n" +
      "Why: codi-* + dev-* skills ship as portable/replaceable templates.\n" +
      "Reaching into core/cli/runtime/utils/adapters couples them to codi's\n" +
      "internal layering and breaks the 'non-core artifact removal' contract\n" +
      "(CORE-036 smoke). Allowed dependencies:\n" +
      "  - #src/constants.js, #src/types/**\n" +
      "  - sibling skill modules under #src/templates/skills/**\n" +
      "  - relative imports inside the skill\n" +
      "  - third-party packages and Node built-ins\n" +
      "\n" +
      "If the dependency is genuinely needed, either move the function to\n" +
      "#src/constants.js / #src/types/** (pure data, no I/O) or split the\n" +
      "meta-skill into a runtime helper + a thin skill wrapper.",
  );
  process.exit(1);
}

main();
