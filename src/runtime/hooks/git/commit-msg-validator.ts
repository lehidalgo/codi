/**
 * commit-msg-validator — commit-msg hook. Enforces Conventional Commits
 * format on the commit message file. ADR-013 Paso 9.
 *
 * Replaces COMMIT_MSG_TEMPLATE. Same regex, same allowed types, same
 * subject-length limit. Reads the commit message from the path passed
 * as the first git argument (`.git/COMMIT_EDITMSG` by default).
 */

import { readFileSync } from "node:fs";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const TYPES: readonly string[] = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];
const HEADER_RE = new RegExp(
  `^(${TYPES.join("|")})(\\([a-z0-9-_/]+\\))?!?: .+`,
);
const MERGE_RE = /^(Merge|Revert|fixup!|squash!|amend!) /;
const MAX_SUBJECT_LEN = 100;

function readCommitMsg(msgPath: string): string | null {
  try {
    return readFileSync(msgPath, "utf8");
  } catch {
    return null;
  }
}

export function checkCommitMsg(
  ctx: GitHookContext,
  msgPath: string,
): GitHookVerdict {
  void ctx;
  try {
    const raw = readCommitMsg(msgPath);
    if (raw === null) {
      return failOpen("commit-msg-validator", new Error(`unable to read ${msgPath}`));
    }
    // Strip comment lines (#…) and trailing whitespace.
    const lines = raw
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .join("\n")
      .trim();
    if (lines.length === 0) {
      return {
        severity: "block",
        check: "commit-msg-validator",
        messages: ["Empty commit message."],
      };
    }
    const header = lines.split("\n")[0] ?? "";
    if (MERGE_RE.test(header)) {
      return { severity: "pass", check: "commit-msg-validator", messages: [] };
    }
    if (!HEADER_RE.test(header)) {
      return {
        severity: "block",
        check: "commit-msg-validator",
        messages: [
          `Commit message header does not match Conventional Commits:`,
          `  ${header}`,
          `Expected: <type>(<scope>)?: <subject>`,
          `Allowed types: ${TYPES.join(", ")}`,
          `Example: feat(api): add retry logic for rate-limited requests`,
        ],
      };
    }
    if (header.length > MAX_SUBJECT_LEN) {
      return {
        severity: "warn",
        check: "commit-msg-validator",
        messages: [
          `Commit subject is ${header.length} chars (recommended max ${MAX_SUBJECT_LEN}).`,
          `Consider shortening or moving detail to the body.`,
        ],
      };
    }
    return { severity: "pass", check: "commit-msg-validator", messages: [] };
  } catch (err) {
    return failOpen("commit-msg-validator", err);
  }
}
