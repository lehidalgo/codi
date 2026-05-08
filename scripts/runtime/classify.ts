#!/usr/bin/env tsx
/**
 * classify CLI — invokes the change classifier on a file change.
 *
 * Reads JSON from stdin or accepts file paths. Emits the classification
 * result as JSON on stdout. Exit code is 0 always — the classifier itself
 * does not block; consumers (hooks) decide what to do with the verdict.
 *
 * Usage modes:
 *   1. Stdin JSON (preferred for hooks):
 *      echo '{"file_path":"...","old_content":"...","new_content":"..."}' \
 *        | classify
 *
 *   2. Explicit args:
 *      classify --file <path> --old <old-file> --new <new-file>
 *
 *   3. Diff against working tree:
 *      classify --file <path>     # reads original from git, new from FS
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { classifyChange, type ClassifyResult } from "../lib/classifier.js";
import { EventLog } from "../lib/event-log.js";
import { reduce } from "../lib/reducer.js";

interface InputJson {
  file_path: string;
  old_content?: string;
  new_content?: string;
  files_in_plan?: string[];
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, next);
        i += 1;
      } else {
        flags.set(key, true);
      }
    }
  }
  return flags;
}

function fileFromGit(filePath: string): string {
  // execFileSync avoids shell parsing — file paths are passed as a single
  // argument and cannot inject shell metacharacters.
  try {
    return execFileSync("git", ["show", `HEAD:${filePath}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function readFileSafe(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

function getFilesInPlan(): string[] {
  try {
    const log = EventLog.fromCwd(process.cwd());
    const id = log.getActiveWorkflowId();
    if (!id) return [];
    const events = log.loadEvents(id);
    if (events.length === 0) return [];
    return reduce(events).scope.files_in_plan;
  } catch {
    return [];
  }
}

function main(): void {
  const flags = parseArgs(process.argv.slice(2));
  let input: InputJson;

  // Mode 1: stdin JSON
  const stdinRaw = readStdin();
  if (stdinRaw.trim().length > 0 && stdinRaw.trim().startsWith("{")) {
    input = JSON.parse(stdinRaw) as InputJson;
  } else if (typeof flags.get("file") === "string") {
    const filePath = flags.get("file") as string;
    const oldFlag = flags.get("old");
    const newFlag = flags.get("new");
    const oldContent = typeof oldFlag === "string" ? readFileSafe(oldFlag) : fileFromGit(filePath);
    const newContent =
      typeof newFlag === "string" ? readFileSafe(newFlag) : readFileSafe(resolve(filePath));
    input = { file_path: filePath, old_content: oldContent, new_content: newContent };
  } else {
    console.error("classify: provide stdin JSON or --file <path> [--old <path>] [--new <path>]");
    process.exit(1);
  }

  const filesInPlan = input.files_in_plan ?? getFilesInPlan();
  const result: ClassifyResult = classifyChange({
    file_path: input.file_path,
    old_content: input.old_content ?? "",
    new_content: input.new_content ?? "",
    files_in_plan: filesInPlan,
  });

  console.log(JSON.stringify(result, null, 2));
}

main();
