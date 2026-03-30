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
