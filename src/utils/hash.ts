import { createHash } from "node:crypto";

/**
 * Compute a SHA-256 hex digest of the given string content.
 *
 * Used to fingerprint generated file content for change detection and
 * to populate `GeneratedFile.hash`.
 *
 * @param content - UTF-8 string to hash.
 * @returns 64-character lowercase hex string.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
