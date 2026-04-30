import fs from "node:fs/promises";
import path from "node:path";
import { BACKUP_MANIFEST_FILENAME } from "#src/constants.js";
import type { Result } from "#src/types/result.js";
import { ok, err } from "#src/types/result.js";
import type { BackupManifestV2, BackupManifestEntry } from "#src/core/backup/types.js";

export type ManifestReadError = "incomplete" | "malformed";

/**
 * Read a backup manifest, transparently upgrading v1 manifests on the fly.
 * Never mutates the on-disk file.
 */
export async function readManifest(
  backupDir: string,
): Promise<Result<BackupManifestV2, ManifestReadError>> {
  const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILENAME);
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, "utf8");
  } catch {
    return err<ManifestReadError>("incomplete");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err<ManifestReadError>("malformed");
  }
  if (!parsed || typeof parsed !== "object") return err<ManifestReadError>("malformed");

  const candidate = parsed as Record<string, unknown>;
  if (candidate.version === 2) {
    return ok(candidate as unknown as BackupManifestV2) as Result<
      BackupManifestV2,
      ManifestReadError
    >;
  }

  if (typeof candidate.timestamp !== "string" || !Array.isArray(candidate.files)) {
    return err<ManifestReadError>("malformed");
  }
  const files: BackupManifestEntry[] = candidate.files
    .filter((p): p is string => typeof p === "string")
    .map((p) => ({ path: p, scope: "output" as const }));

  const upgraded: BackupManifestV2 = {
    version: 2,
    timestamp: candidate.timestamp,
    trigger: "generate",
    codiVersion: "<unknown>",
    files,
  };
  return ok(upgraded) as Result<BackupManifestV2, ManifestReadError>;
}

/**
 * Write a v2 manifest. Caller is responsible for ordering — manifest should
 * be the LAST file written so its presence acts as a commit marker.
 */
export async function writeManifest(backupDir: string, manifest: BackupManifestV2): Promise<void> {
  const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILENAME);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}
