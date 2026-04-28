import { execFileSync } from "node:child_process";

export type PreviousVersionResult =
  | { kind: "found"; version: number }
  | { kind: "new-file" }
  | { kind: "no-head" };

export function getPreviousVersion(ref: string, path: string): PreviousVersionResult {
  let content: string;
  try {
    content = execFileSync("git", ["show", `${ref}:${path}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const e = err as { stderr?: Buffer | string };
    const stderr = e.stderr ? e.stderr.toString() : "";
    if (stderr.includes("does not exist") || stderr.includes("exists on disk, but not in")) {
      return { kind: "new-file" };
    }
    return { kind: "no-head" };
  }

  const match = content.match(/^version:\s*(\d+)\s*$/m);
  return match ? { kind: "found", version: Number(match[1]) } : { kind: "found", version: 1 };
}
