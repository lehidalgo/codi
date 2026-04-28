#!/usr/bin/env node
// Verify every artifact change between two refs has a version bump.
// Used by pre-push hook (indirectly via the .mjs template) and by CI
// workflow as a server-side gate.
//
// Usage:
//   node scripts/verify-artifact-versions.mjs --base <ref> --head <ref>
//
// Exit codes:
//   0 = no offenders
//   1 = one or more artifact changes without version bump
//   2 = invocation error (bad args, git error)
import { execFileSync } from "child_process";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const base = arg("--base");
const head = arg("--head");
if (!base || !head) {
  console.error("usage: verify-artifact-versions --base <ref> --head <ref>");
  process.exit(2);
}

function isArtifactPath(p) {
  return (
    /^src\/templates\/(skills|agents)\/[^/]+\/template\.ts$/.test(p) ||
    (/^src\/templates\/rules\/[^/]+\.ts$/.test(p) && !p.endsWith("/index.ts")) ||
    /^\.codi\/(rules|agents)\/[^/]+\.md$/.test(p) ||
    /^\.codi\/skills\/[^/]+\/SKILL\.md$/.test(p)
  );
}

function gitShow(ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function parseVersion(c) {
  const m = c.match(/^version:\s*(\d+)\s*$/m);
  return m ? Number(m[1]) : 1;
}

function stripVersion(s) {
  return s.replace(/^version:\s*\d+\s*$/m, "version: 0");
}

let diffOut = "";
try {
  diffOut = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", `${base}..${head}`],
    { encoding: "utf-8" },
  );
} catch (e) {
  console.error("git diff failed:", String(e));
  process.exit(2);
}

const files = diffOut.trim().split("\n").filter(Boolean).filter(isArtifactPath);
const offenders = [];

for (const path of files) {
  const baseContent = gitShow(base, path);
  const headContent = gitShow(head, path);
  if (!baseContent || !headContent) continue;
  if (stripVersion(baseContent) === stripVersion(headContent)) continue;

  const baseVer = parseVersion(baseContent);
  const headVer = parseVersion(headContent);

  if (headVer < baseVer) {
    offenders.push({ path, base: baseVer, head: headVer, reason: "regression" });
  } else if (headVer === baseVer) {
    offenders.push({ path, base: baseVer, head: headVer, reason: "no-bump" });
  }
}

if (offenders.length === 0) {
  console.log(`[verify-artifact-versions] OK — ${files.length} artifact path(s) inspected, all bumped`);
  process.exit(0);
}

console.error("");
console.error(`✗ [verify-artifact-versions] ${offenders.length} artifact(s) need version bumps`);
console.error("  files:");
for (const o of offenders) {
  const tag = o.reason === "regression"
    ? `(v${o.base} -> v${o.head}, version regression)`
    : `(v${o.base} -> v${o.head}, content changed)`;
  console.error(`    - ${o.path} ${tag}`);
}
console.error("  reason: artifact content changed without a corresponding version bump");
console.error("  fix: bump the version: field in the frontmatter of each listed file");
process.exit(1);
