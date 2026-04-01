import fs from "node:fs/promises";

/** Remove a temp directory with retry to handle OS file handle race conditions. */
export async function cleanupTmpDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}
