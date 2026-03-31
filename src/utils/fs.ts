import fs from "node:fs/promises";

/** Check whether a file or directory exists at the given path. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Remove a directory with retry to handle OS file handle race conditions. */
export async function safeRm(dirPath: string): Promise<boolean> {
  try {
    await fs.rm(dirPath, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    return true;
  } catch {
    return false;
  }
}
