import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export function readFileSafe(filePath: string, cwd?: string): string {
  const full = isAbsolute(filePath) ? filePath : resolve(cwd ?? process.cwd(), filePath);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
