/**
 * ISSUE-088 — collect ConflictEntries between two `.codi/` directories.
 *
 * Walks `localDir` and `incomingDir`, building a `ConflictEntry` for
 * every file that exists in both with different content. Files only in
 * `incomingDir` are returned as "additions" (currentContent: "") so the
 * resolver still prompts the user to accept or skip them — that
 * preserves the same accept/skip/diff UX teammates already know from
 * the preset-applier flow.
 *
 * Pure walker — no I/O outside `fs.promises`. The caller is
 * responsible for invoking `resolveConflicts` and writing accepted
 * entries to disk.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { makeConflictEntry, type ConflictEntry } from "./conflict-resolver.js";

const SCAN_SUBDIRS = ["rules", "skills", "agents", "mcp-servers", "workflows"];

interface FileEntry {
  readonly relPath: string;
  readonly absPath: string;
}

async function listFilesUnder(root: string): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        out.push({ relPath: path.relative(root, full), absPath: full });
      }
    }
  }
  for (const sub of SCAN_SUBDIRS) {
    await walk(path.join(root, sub));
  }
  return out;
}

export async function collectCodiDirConflicts(
  localDir: string,
  incomingDir: string,
): Promise<ConflictEntry[]> {
  const localFiles = await listFilesUnder(localDir);
  const incomingFiles = await listFilesUnder(incomingDir);
  const localByRel = new Map(localFiles.map((f) => [f.relPath, f.absPath]));

  const entries: ConflictEntry[] = [];
  for (const f of incomingFiles) {
    const localAbs = localByRel.get(f.relPath);
    const incoming = await fs.readFile(f.absPath, "utf-8");
    const current = localAbs ? await fs.readFile(localAbs, "utf-8") : "";
    if (current === incoming) continue;
    entries.push(makeConflictEntry(f.relPath, path.join(localDir, f.relPath), current, incoming));
  }
  return entries;
}
