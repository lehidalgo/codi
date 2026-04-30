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

/**
 * Compute a SHA-256 hex digest of raw bytes. Used for binary assets (fonts,
 * PDFs, images, archives) that must not be coerced through UTF-8.
 *
 * @param bytes - Raw byte buffer to hash.
 * @returns 64-character lowercase hex string.
 */
export function hashBuffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** SHA-256 of the empty input. Generators that skip hashing binary assets
 *  store this as the placeholder `generatedHash`. detectOrphans uses it as
 *  an "always-clean" sentinel so binary leftovers are deleted on agent
 *  unselect instead of being misclassified as drifted. */
export const EMPTY_INPUT_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
