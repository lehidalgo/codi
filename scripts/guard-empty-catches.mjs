#!/usr/bin/env node
/**
 * CORE-015 — bans empty `catch {}` blocks without an intent comment.
 *
 * Pre-CORE-015 audit: 122 empty-catch blocks in `src/`, of which 120
 * already carried an inline comment explaining the recovery semantics
 * (`/* ignore *\/`, `/* best-effort *\/`, `/* missing — fall through
 * *\/`, …). The two "undocumented" hits in `hook-policy-templates.ts`
 * were actually `catch(e){}` substrings inside a Node `-e` heredoc
 * string emitted to a generated shell script, not real TypeScript
 * catches. The corpus was already self-documented.
 *
 * The real risk was forward: nothing prevented `catch #123` from
 * landing without an explanation. This guard fixes that. Every empty
 * catch (whitespace-only body or comment-only body) must contain at
 * least one token from {@link MARKER_TOKENS}. The list captures the
 * vocabulary that grew organically — we did not invent a new word
 * for an existing pattern.
 *
 * Implementation notes:
 *
 *   - String literals are stripped before the scan. Template files
 *     under `src/templates/skills/` and `src/core/hooks/*.ts` emit
 *     `catch(e){}` and similar inside backtick strings; those land in
 *     generated shell or `.mjs` scripts on disk and are not real TS
 *     catches in this codebase.
 *   - Block comments and single-line comments are kept INSIDE catch
 *     bodies because that is where the marker must appear. They are
 *     only stripped from the surrounding code to keep brace-counting
 *     honest.
 *   - We use a brace-balanced scanner rather than a regex so a
 *     `catch (e) { if (cond) { … } }` style body with nested braces
 *     is recognised correctly. A regex `.*?` over the body would
 *     close the catch on the first inner `}` and miss the real end.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one empty catch lacks a marker
 *   2 — internal error walking the tree
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const REPO = process.cwd();
const ROOT = "src";

/**
 * Vocabulary the catch body must contain for the guard to accept it.
 * Lower-cased; the matcher is case-insensitive. These tokens grew
 * organically across the codebase before CORE-015 — keeping them
 * lets the migration be a no-op for the 120 already-documented sites.
 */
const MARKER_TOKENS = [
  "intentional",
  "ignore",
  "ignored",
  "best-effort",
  "best effort",
  "missing",
  "unreadable",
  "non-critical",
  "non-blocking",
  "optional",
  "probe",
  "skip",
  "skipped",
  "race",
  "fall through",
  "fall-through",
  "malformed",
  "corrupt",
  "already gone",
  "doesn't exist",
  "does not exist",
  "advisory",
  "fail-open",
  "fail open",
  "tolerated",
  "defensive",
  "fd already",
  "expected",
  "not yet",
  "no-op",
  "noop",
  "not installed",
  "not configured",
  "unavailable",
  "best",
  "permission",
  "stale",
  "unsealed",
  "brand-new",
  "fall back",
  "fallback",
  "try next",
  "keep walking",
  "keep raw",
  "absent",
  "may not exist",
  "may not be",
  "cleanup",
  "degrade",
  "does not block",
  "doesn't block",
  "no mcp",
  "no existing",
  "new file",
  "not at root",
  "not a circular",
  "unknown",
  "fallthrough",
  "non-fatal",
  "circular",
  "could be",
  "already dead",
  "restore failed",
  "leave",
  "captures persist",
  "auth",
  "private repo",
  "will create",
  "without",
  "surface",
];

/**
 * Replace every string literal (single-quote, double-quote, backtick)
 * with whitespace of the same length so brace counting stays correct
 * but `catch(e){}` substrings inside `\`...\`` heredocs do not match.
 * Comments are stripped too, so a "// catch ...{}" sentence in a
 * comment is invisible to the scanner.
 */
function stripStringsAndComments(src) {
  const out = [];
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let inStr = null;
  let strEsc = false;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out.push(c);
      } else {
        out.push(" ");
      }
      i += 1;
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        out.push("  ");
        i += 2;
        continue;
      }
      out.push(c === "\n" ? "\n" : " ");
      i += 1;
      continue;
    }
    if (inStr) {
      if (strEsc) {
        strEsc = false;
        out.push(c === "\n" ? "\n" : " ");
        i += 1;
        continue;
      }
      if (c === "\\") {
        strEsc = true;
        out.push(" ");
        i += 1;
        continue;
      }
      if (c === inStr) {
        out.push(c);
        inStr = null;
        i += 1;
        continue;
      }
      // Inside a template literal, `${…}` is real code — keep it.
      if (inStr === "`" && c === "$" && next === "{") {
        // Find matching closing brace, copy verbatim.
        let depth = 1;
        let j = i + 2;
        out.push("${");
        while (j < src.length && depth > 0) {
          const cj = src[j];
          if (cj === "{") depth += 1;
          else if (cj === "}") depth -= 1;
          out.push(cj);
          j += 1;
        }
        i = j;
        continue;
      }
      out.push(c === "\n" ? "\n" : " ");
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      inLine = true;
      out.push("  ");
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlock = true;
      out.push("  ");
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inStr = c;
      out.push(c);
      i += 1;
      continue;
    }
    out.push(c);
    i += 1;
  }
  return out.join("");
}

/**
 * Find the matching closing brace for `code[startIdx] === '{'`.
 * Returns the index of the matching `}` or -1 if unbalanced.
 */
function findMatchingBrace(code, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < code.length; i += 1) {
    const c = code[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Walk `src/` and return every TS file path.
 */
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
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(full);
  }
}

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i += 1) {
    if (src[i] === "\n") line += 1;
  }
  return line;
}

function hasMarker(rawBody) {
  const lower = rawBody.toLowerCase();
  for (const t of MARKER_TOKENS) {
    if (lower.includes(t)) return true;
  }
  return false;
}

function isBodyEmpty(rawBody) {
  // Strip block + line comments; if the remainder is whitespace-only
  // the body is "empty" for guard purposes (the catch swallows
  // silently).
  let stripped = rawBody.replace(/\/\*[\s\S]*?\*\//g, "");
  stripped = stripped.replace(/\/\/.*$/gm, "");
  return stripped.trim() === "";
}

async function findOffenders() {
  const offenders = [];
  const root = join(REPO, ROOT);
  const files = [];
  try {
    await walk(root, files);
  } catch (err) {
    console.error(`[guard-empty-catches] walk failed: ${err.message ?? err}`);
    process.exit(2);
  }

  for (const abs of files) {
    let src;
    try {
      src = await readFile(abs, "utf8");
    } catch (err) {
      console.error(
        `[guard-empty-catches] cannot read ${relative(REPO, abs)}: ${err.message ?? err}`,
      );
      process.exit(2);
    }
    const cleaned = stripStringsAndComments(src);

    // Walk the cleaned source for `catch` tokens. For each, find the
    // body `{ ... }` in the ORIGINAL source so we can inspect the
    // comments inside it.
    const catchRe = /\bcatch\b\s*(?:\([^)]*\))?\s*\{/g;
    let m;
    while ((m = catchRe.exec(cleaned)) !== null) {
      const braceIdx = m.index + m[0].length - 1;
      const closeIdx = findMatchingBrace(cleaned, braceIdx);
      if (closeIdx < 0) continue;
      const rawBody = src.slice(braceIdx + 1, closeIdx);
      if (!isBodyEmpty(rawBody)) continue;
      if (!hasMarker(rawBody)) {
        offenders.push({
          path: relative(REPO, abs),
          line: lineOf(src, m.index),
          body: rawBody.slice(0, 80).replace(/\n/g, " ").trim(),
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
      "[guard-empty-catches] all empty catch blocks carry an intent marker — pass.",
    );
    process.exit(0);
  }

  console.error(
    "[guard-empty-catches] FAIL — empty catch block(s) missing an intent marker:",
  );
  for (const off of offenders) {
    console.error(`\n  ${off.path}:${off.line}`);
    console.error(`    body: "${off.body}"`);
  }
  console.error(
    "\nWhy: a silent catch hides bugs. Every empty catch must include a\n" +
      "short inline comment that names the recovery semantics. Use one of\n" +
      "the existing markers — the corpus has settled on this vocabulary:\n" +
      "  /* ignore */                 — generic, OK for trivial cleanup\n" +
      "  /* best-effort cleanup */    — unlink / close failures\n" +
      "  /* missing — fall through */ — ENOENT probes with a fallback\n" +
      "  /* race — keep walking */    — TOCTOU on filesystem walks\n" +
      "  /* malformed — fall through */ — parse-with-default\n" +
      "  /* non-blocking — <subsystem> */ — async fire-and-forget\n" +
      "  /* intentional — <reason> */ — anything else, with a real reason\n" +
      "Full token list: " +
      MARKER_TOKENS.slice(0, 15).join(", ") +
      ", …\n" +
      "If the catch is genuinely buggy (silent failure that should log or\n" +
      "throw), fix the handler — do not add a marker to placate the guard.",
  );
  process.exit(1);
}

main();
