#!/usr/bin/env node
/**
 * ISSUE-011 supply-chain guard.
 *
 * Asserts that every hoisted version of `fast-uri` resolves to >=3.1.2.
 * The package.json top-level `overrides` already pins it, but lockfile
 * regenerations under future dep bumps could silently regress; this
 * guard fails CI in that case.
 *
 * Invoked from `.github/workflows/ci.yml`. Returns exit 0 on success,
 * exit 1 with a diagnostic if a stale version is found, exit 2 if
 * `npm ls` cannot be parsed.
 */
import { execFileSync } from "node:child_process";

const MIN = { major: 3, minor: 1, patch: 2 };

function compare(version) {
  const [major, minor, patch] = version.split(".").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    throw new Error(`unparseable version: ${version}`);
  }
  if (major !== MIN.major) return major - MIN.major;
  if (minor !== MIN.minor) return minor - MIN.minor;
  return patch - MIN.patch;
}

// `npm ls fast-uri --all --json` returns a project entry whose
// `dependencies` map is keyed by package name; each value has `version`
// and an optional nested `dependencies` map. We walk the tree and pull
// every `fast-uri` version. `npm ls` exits non-zero when the requested
// package is absent or when there are extraneous packages; we accept
// non-zero exits and parse stdout regardless — JSON.parse will fail if
// the output is genuinely malformed.
function collectVersions(node, found, name) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectVersions(item, found, undefined);
    return;
  }
  if (typeof node !== "object") return;
  if (name === "fast-uri" && typeof node.version === "string") {
    found.add(node.version);
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "dependencies" || k === "devDependencies" || k === "optionalDependencies") {
      if (v && typeof v === "object") {
        for (const [childName, childNode] of Object.entries(v)) {
          collectVersions(childNode, found, childName);
        }
      }
    }
  }
}

let raw;
try {
  raw = execFileSync("npm", ["ls", "fast-uri", "--all", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  // `npm ls` exits non-zero when `fast-uri` is absent or when there are
  // extraneous packages; the JSON payload on stdout is still valid in
  // those cases. Recover stdout from the error object and continue.
  if (err && typeof err === "object" && "stdout" in err && typeof err.stdout === "string") {
    raw = err.stdout;
  } else {
    console.error(`[guard-fast-uri] npm ls failed: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(
    `[guard-fast-uri] could not parse npm output: ${err instanceof Error ? err.message : err}`,
  );
  process.exit(2);
}

const versions = new Set();
collectVersions(parsed, versions);

if (versions.size === 0) {
  console.log("[guard-fast-uri] fast-uri not present in tree — pass.");
  process.exit(0);
}

const list = [...versions].sort();
console.log(`[guard-fast-uri] hoisted fast-uri versions: ${list.join(", ")}`);

const violators = list.filter((v) => compare(v) < 0);
if (violators.length > 0) {
  console.error(
    `[guard-fast-uri] FAIL — versions below required >=3.1.2: ${violators.join(", ")}\n` +
      `Fix: add/update \`overrides.fast-uri\` (top-level) in package.json and regenerate the lockfile.`,
  );
  process.exit(1);
}

console.log("[guard-fast-uri] all hoisted versions satisfy >=3.1.2 — pass.");
process.exit(0);
