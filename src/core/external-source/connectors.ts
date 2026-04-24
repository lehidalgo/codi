import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PROJECT_NAME } from "#src/constants.js";

const execFileAsync = promisify(execFile);

export interface ExternalSource {
  /** Stable identifier shown to the user and stored in manifest provenance. */
  id: string;
  /**
   * Absolute path to the on-disk root containing the standard codi layout
   * (rules/ skills/ agents/ mcp-servers/). Caller reads from here.
   */
  rootPath: string;
  /**
   * Releases temp resources (extracted zip, cloned repo). Safe to call
   * multiple times; safe to ignore the result.
   */
  cleanup: () => Promise<void>;
}

const NOOP_CLEANUP = async (): Promise<void> => {};

function makeTempDir(suffix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return path.join(os.tmpdir(), `${PROJECT_NAME}-import-${suffix}-${Date.now()}-${rand}`);
}

async function safeRmRecursive(target: string): Promise<void> {
  await fs.rm(target, { recursive: true, force: true }).catch(() => {});
}

/**
 * Connect to a local directory. Validates the path exists and is readable.
 * Cleanup is a no-op (caller's filesystem, not ours).
 */
export async function connectLocalDirectory(dirPath: string): Promise<ExternalSource> {
  const resolved = path.resolve(dirPath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Not a readable directory: ${dirPath}`);
  }
  return {
    id: `local:${resolved}`,
    rootPath: resolved,
    cleanup: NOOP_CLEANUP,
  };
}

/**
 * Connect to a ZIP file. Extracts to os.tmpdir() and guards against ZIP-slip
 * by verifying every extracted path resolves under the extraction root.
 */
export async function connectZipFile(zipPath: string): Promise<ExternalSource> {
  const resolvedZip = path.resolve(zipPath);
  const stat = await fs.stat(resolvedZip).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`Not a readable file: ${zipPath}`);
  }

  const extractRoot = makeTempDir("zip");
  await fs.mkdir(extractRoot, { recursive: true });

  try {
    await execFileAsync("unzip", ["-q", "-o", resolvedZip, "-d", extractRoot]);
  } catch (cause) {
    await safeRmRecursive(extractRoot);
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Failed to extract ZIP (ensure 'unzip' is installed): ${reason}`);
  }

  // ZIP-slip guard: re-walk the tree and reject anything outside extractRoot.
  await assertPathsContained(extractRoot);

  return {
    id: `zip:${path.basename(resolvedZip)}`,
    rootPath: extractRoot,
    cleanup: () => safeRmRecursive(extractRoot),
  };
}

/**
 * Parse a github spec into a clone URL and optional ref.
 *   "org/repo"              → https + no ref
 *   "org/repo@v1.0"         → https + ref v1.0
 *   "github:org/repo@sha"   → https + ref sha
 *   "https://github.com/o/r" or full URL → as-is + no ref
 */
function parseGithubSpec(spec: string): { url: string; ref?: string } {
  const trimmed = spec.replace(/^github:/, "");
  const [base, ref] = trimmed.split("@");
  if (!base) throw new Error(`Invalid GitHub spec: ${spec}`);
  const url = base.startsWith("http") ? base : `https://github.com/${base}.git`;
  return ref ? { url, ref } : { url };
}

/**
 * Connect to a public GitHub repository. Shallow clones to os.tmpdir().
 * Private repos are not supported in V1 (no auth handling).
 */
export async function connectGithubRepo(spec: string): Promise<ExternalSource> {
  const { url, ref } = parseGithubSpec(spec);
  const cloneRoot = makeTempDir("github");

  const args = ["clone", "--depth", "1"];
  if (ref) args.push("--branch", ref);
  args.push(url, cloneRoot);

  try {
    await execFileAsync("git", args);
  } catch (cause) {
    await safeRmRecursive(cloneRoot);
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Failed to clone ${url}: ${reason}`);
  }

  return {
    id: `github:${spec}`,
    rootPath: cloneRoot,
    cleanup: () => safeRmRecursive(cloneRoot),
  };
}

/** Walk the tree and reject any path that escapes the root via symlinks etc. */
async function assertPathsContained(root: string): Promise<void> {
  const realRoot = await fs.realpath(root);
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const real = await fs.realpath(abs);
      if (!real.startsWith(realRoot + path.sep) && real !== realRoot) {
        throw new Error(`Path escapes extraction root (possible ZIP-slip): ${abs}`);
      }
      if (entry.isDirectory()) await walk(abs);
    }
  }
  await walk(realRoot);
}
