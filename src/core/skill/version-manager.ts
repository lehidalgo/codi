import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { Logger } from "../output/logger.js";
import { VERSIONS_DIR, SKILL_OUTPUT_FILENAME } from "#src/constants.js";
import { buildUnifiedDiff } from "../../utils/diff.js";

export interface VersionInfo {
  version: number;
  path: string;
  timestamp: string;
  sizeBytes: number;
}

function versionsDir(skillDir: string): string {
  return path.join(skillDir, VERSIONS_DIR);
}

function versionFilename(version: number): string {
  return `v${version}.${SKILL_OUTPUT_FILENAME}`;
}

function parseVersionNumber(filename: string): number | null {
  const match = filename.match(/^v(\d+)\.SKILL\.md$/);
  return match ? parseInt(match[1]!, 10) : null;
}

async function getNextVersion(skillDir: string): Promise<number> {
  const dir = versionsDir(skillDir);
  try {
    const entries = await fs.readdir(dir);
    const versions = entries
      .map(parseVersionNumber)
      .filter((v): v is number => v !== null);
    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
  } catch (cause) {
    Logger.getInstance().debug(
      "Versions directory not found, starting at v1",
      cause,
    );
    return 1;
  }
}

export async function saveVersion(
  skillDir: string,
): Promise<Result<{ version: number; path: string }>> {
  const skillPath = path.join(skillDir, SKILL_OUTPUT_FILENAME);

  let content: string;
  try {
    content = await fs.readFile(skillPath, "utf-8");
  } catch {
    return err([
      createError("E_SKILL_NOT_FOUND", {
        name: path.basename(skillDir),
        path: skillPath,
      }),
    ]);
  }

  const dir = versionsDir(skillDir);
  const version = await getNextVersion(skillDir);
  const filename = versionFilename(version);
  const filePath = path.join(dir, filename);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, filePath);
    return ok({ version, path: filePath });
  } catch (cause) {
    await fs.unlink(tmpPath).catch(() => {});
    return err([
      createError("E_FEEDBACK_WRITE_FAILED", {
        reason: (cause as Error).message,
      }),
    ]);
  }
}

export async function listVersions(
  skillDir: string,
): Promise<Result<VersionInfo[]>> {
  const dir = versionsDir(skillDir);

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (cause) {
    Logger.getInstance().debug("No version history found", cause);
    return ok([]);
  }

  const versions: VersionInfo[] = [];
  for (const entry of entries) {
    const version = parseVersionNumber(entry);
    if (version === null) continue;

    const filePath = path.join(dir, entry);
    const stat = await fs.stat(filePath);
    versions.push({
      version,
      path: filePath,
      timestamp: stat.mtime.toISOString(),
      sizeBytes: stat.size,
    });
  }

  return ok(versions.sort((a, b) => a.version - b.version));
}

export async function restoreVersion(
  skillDir: string,
  version: number,
): Promise<Result<void>> {
  const versionPath = path.join(
    versionsDir(skillDir),
    versionFilename(version),
  );
  const skillPath = path.join(skillDir, SKILL_OUTPUT_FILENAME);

  let content: string;
  try {
    content = await fs.readFile(versionPath, "utf-8");
  } catch {
    return err([
      createError("E_VERSION_NOT_FOUND", {
        version: String(version),
        name: path.basename(skillDir),
      }),
    ]);
  }

  const tmpPath = `${skillPath}.tmp.${Date.now()}`;
  try {
    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, skillPath);
    return ok(undefined);
  } catch (cause) {
    await fs.unlink(tmpPath).catch(() => {});
    return err([
      createError("E_FEEDBACK_WRITE_FAILED", {
        reason: (cause as Error).message,
      }),
    ]);
  }
}

export async function diffVersions(
  skillDir: string,
  v1: number,
  v2: number,
): Promise<Result<string>> {
  const dir = versionsDir(skillDir);
  const path1 = path.join(dir, versionFilename(v1));
  const path2 = path.join(dir, versionFilename(v2));
  const skillName = path.basename(skillDir);

  let content1: string;
  let content2: string;
  try {
    content1 = await fs.readFile(path1, "utf-8");
  } catch {
    return err([
      createError("E_VERSION_NOT_FOUND", {
        version: String(v1),
        name: skillName,
      }),
    ]);
  }
  try {
    content2 = await fs.readFile(path2, "utf-8");
  } catch {
    return err([
      createError("E_VERSION_NOT_FOUND", {
        version: String(v2),
        name: skillName,
      }),
    ]);
  }

  const lines1 = content1.split("\n");
  const lines2 = content2.split("\n");
  const diff = buildUnifiedDiff(
    `v${v1}.SKILL.md`,
    `v${v2}.SKILL.md`,
    lines1,
    lines2,
  );

  return ok(diff);
}

// buildUnifiedDiff is now imported from ../../utils/diff.js
