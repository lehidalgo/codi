import fs from "node:fs/promises";
import path from "node:path";
import type { Result } from "#src/types/result.js";
import { ok, err } from "#src/types/result.js";
import { createError } from "../output/errors.js";
import type { HookEntry } from "./hook-registry.js";
import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

interface HookFileResult {
  files: string[];
}

export const PRE_COMMIT_BEGIN_MARKER = `# ${PROJECT_NAME_DISPLAY} hooks: BEGIN (auto-generated — do not edit between markers)`;
export const PRE_COMMIT_END_MARKER = `# ${PROJECT_NAME_DISPLAY} hooks: END`;

/**
 * Convert a stagedFilter glob to a Python regex suitable for pre-commit's `files:` field.
 * pre-commit uses re.search, so patterns match anywhere in the path unless anchored.
 * Returns an empty string for catch-all filters (caller should use always_run instead).
 */
export function globToPythonRegex(glob: string): string {
  if (!glob || glob === "**" || glob === "**/*" || glob === "**/**") return "";

  // Expand brace alternatives: {a,b,c} → (a|b|c) before escaping
  const BRACE_OPEN = "\x01";
  const BRACE_PIPE = "\x02";
  const BRACE_CLOSE = "\x03";
  const withBraces = glob.replace(/\{([^}]+)\}/g, (_, alts: string) => {
    const parts = alts.split(",").map((a) => a.trim());
    return BRACE_OPEN + parts.join(BRACE_PIPE) + BRACE_CLOSE;
  });

  // Escape regex metacharacters (but not our placeholders or glob wildcards)
  let pattern = withBraces.replace(/[.+^$()|[\]\\]/g, (c) => "\\" + c);

  // Expand glob wildcards via a temporary marker so ** is handled before *
  const DOUBLESTAR = "\x04";
  pattern = pattern.replace(/\*\*/g, DOUBLESTAR);
  pattern = pattern.replace(/\*/g, "[^/]*");
  pattern = pattern.replace(new RegExp(DOUBLESTAR, "g"), ".*");

  // Restore brace group markers as regex alternation
  pattern = pattern
    .replace(new RegExp(BRACE_OPEN, "g"), "(")
    .replace(new RegExp(BRACE_PIPE, "g"), "|")
    .replace(new RegExp(BRACE_CLOSE, "g"), ")");

  // Anchor:
  // - "**/foo" → match "foo" at any depth, including root
  // - "docs/**" → anchored at start
  // - "**/*.py" → extension anywhere (no anchor needed; ends with $ via dot-rule)
  if (glob.startsWith("**/")) {
    // pattern starts with ".*/" — allow root-level match too
    pattern = "(^|/)" + pattern.slice(3);
  } else if (glob.startsWith("**")) {
    // match anywhere
  } else {
    pattern = "^" + pattern;
  }

  // Anchor the end for patterns that look like a filename/extension match
  const looksLikeFileEnd = /\.[a-zA-Z0-9()|]+$/.test(pattern) || /[a-zA-Z0-9]\)$/.test(pattern);
  if (looksLikeFileEnd && !pattern.endsWith("$") && !pattern.endsWith(".*")) {
    pattern += "$";
  }

  return pattern;
}

interface PreCommitHookYaml {
  lines: string[];
}

function renderPreCommitHook(h: HookEntry, indent: string): PreCommitHookYaml {
  // Legacy renderer for the text-based path. The yaml-renderer (commit 6) will
  // supersede this. For the duration of the migration we read entry/files/
  // pass_filenames from the new HookSpec.shell + HookSpec.files fields.
  const entry = h.shell.command;
  const lines: string[] = [
    `${indent}- id: ${h.name}`,
    `${indent}  name: ${h.name}`,
    `${indent}  entry: ${entry}`,
    `${indent}  language: system`,
  ];

  const regex = globToPythonRegex(h.files);
  if (regex) {
    lines.push(`${indent}  files: '${regex.replace(/'/g, "''")}'`);
  } else {
    lines.push(`${indent}  always_run: true`);
  }

  if (h.shell.passFiles === false || !regex) {
    lines.push(`${indent}  pass_filenames: false`);
  }

  if (h.files === "") {
    lines.push(`${indent}  always_run: true`);
  }

  return { lines };
}

/**
 * Produce the generated Codi block for .pre-commit-config.yaml at the requested indent.
 * The block is a single `- repo: local` list item whose `hooks:` key contains every
 * managed hook. Enclosed in BEGIN/END comment markers for deterministic stripping.
 */
export function renderPreCommitBlock(hooks: HookEntry[], listIndent: string): string {
  const hookIndent = listIndent + "    "; // 4 more spaces than the list item
  const body: string[] = [
    `${listIndent}${PRE_COMMIT_BEGIN_MARKER}`,
    `${listIndent}- repo: local`,
    `${listIndent}  hooks:`,
  ];
  for (const h of hooks) {
    const rendered = renderPreCommitHook(h, hookIndent);
    body.push(...rendered.lines);
  }
  body.push(`${listIndent}${PRE_COMMIT_END_MARKER}`);
  return body.join("\n");
}

/**
 * Remove any previously generated Codi block between BEGIN/END markers, plus
 * the legacy column-0 block emitted by older versions of this installer
 * (lines starting with `# Codi hooks` followed by `- repo: local`).
 */
export function stripPreCommitGeneratedBlock(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let skipping = false;
  let legacySkipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!skipping && trimmed === PRE_COMMIT_BEGIN_MARKER.trim()) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (trimmed === PRE_COMMIT_END_MARKER.trim()) {
        skipping = false;
      }
      continue;
    }

    // Legacy cleanup: a top-level `# Codi hooks` comment immediately followed by
    // `- repo: local` at column 0 — the broken form that produced invalid YAML.
    if (
      !legacySkipping &&
      trimmed === `# ${PROJECT_NAME_DISPLAY} hooks` &&
      lines[i + 1]?.startsWith("- repo: local")
    ) {
      legacySkipping = true;
      continue;
    }
    if (legacySkipping) {
      // Consume lines that belong to the legacy block: the comment's repo entry
      // at column 0 and its indented children (2+ spaces). Stop when we hit
      // another top-level construct (non-indented, non-list) or EOF.
      if (line.startsWith("- ") || line.startsWith("  ") || line === "") {
        continue;
      }
      legacySkipping = false;
      // fall through — this line is real content
    }

    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "\n");
}

/**
 * Locate the `repos:` list and return the index to insert a new list item at,
 * along with the indent of existing list items. Returns null if `repos:` is
 * absent or the structure cannot be parsed with simple text heuristics.
 */
export function findReposInsertionPoint(
  lines: string[],
): { insertAt: number; listIndent: string } | null {
  const reposIdx = lines.findIndex((l) => /^repos\s*:\s*$/.test(l));
  if (reposIdx === -1) return null;

  // Lock the list indent to the FIRST list item under repos: encountered.
  // Nested list items inside an existing repo's hooks: must NOT redefine it,
  // otherwise the inserted block lands inside that repo's hooks: list (C1).
  let listIndent: string | null = null;
  let lastMemberIdx = reposIdx;

  for (let i = reposIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === "" || /^\s*#/.test(line)) continue;
    if (/^[A-Za-z_][\w-]*\s*:/.test(line)) break;

    const indentMatch = line.match(/^(\s+)- /);
    if (indentMatch && listIndent === null) {
      listIndent = indentMatch[1]!;
    }
    if (/^\s+\S/.test(line)) {
      lastMemberIdx = i;
    }
  }

  return { insertAt: lastMemberIdx + 1, listIndent: listIndent ?? "  " };
}

export async function installPreCommitFramework(
  projectRoot: string,
  hooks: HookEntry[],
): Promise<Result<HookFileResult>> {
  const configPath = path.join(projectRoot, ".pre-commit-config.yaml");

  try {
    let existing = "";
    try {
      existing = await fs.readFile(configPath, "utf-8");
    } catch {
      // file doesn't exist yet
    }

    const cleaned = stripPreCommitGeneratedBlock(existing);
    const cleanedLines = cleaned.replace(/\n+$/, "").split("\n");

    let nextContent: string;
    const insertion = findReposInsertionPoint(cleanedLines);

    if (insertion) {
      const block = renderPreCommitBlock(hooks, insertion.listIndent);
      const before = cleanedLines.slice(0, insertion.insertAt);
      const after = cleanedLines.slice(insertion.insertAt);
      // Ensure a blank line before the generated block for readability.
      if (before.length > 0 && before[before.length - 1] !== "") {
        before.push("");
      }
      nextContent = [...before, block, ...after].join("\n").replace(/\n+$/, "") + "\n";
    } else {
      // No repos: key (empty file or unrelated content). Synthesize a full
      // document. Preserve any prior user content above repos:.
      const prefix = cleaned.trim();
      const block = renderPreCommitBlock(hooks, "  ");
      const parts: string[] = [];
      if (prefix.length > 0) {
        parts.push(prefix, "");
      }
      parts.push("repos:", block);
      nextContent = parts.join("\n").replace(/\n+$/, "") + "\n";
    }

    await fs.writeFile(configPath, nextContent, "utf-8");
    return ok({ files: [path.relative(projectRoot, configPath)] });
  } catch (cause) {
    return err([
      createError("E_HOOK_FAILED", {
        hook: "pre-commit-config",
        reason: `Failed to write config: ${(cause as Error).message}`,
      }),
    ]);
  }
}
