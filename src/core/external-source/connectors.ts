import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PROJECT_NAME } from "#src/constants.js";
import { parsePresetIdentifier } from "#src/core/preset/preset-resolver.js";

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
 * Resolve a github spec into a clone URL + optional ref using codi's canonical
 * preset identifier parser. Accepts every form the rest of the CLI accepts:
 *   "org/repo"
 *   "org/repo@v1.2.0"          (tag)
 *   "github:org/repo#branch"   (branch)
 *   "https://github.com/org/repo"
 *   "https://github.com/org/repo.git"
 *   "https://github.com/org/repo/tree/branch[/subpath]"
 *
 * Exported for unit testing — internal API, do not depend on it from
 * non-test code.
 */
export function resolveGithubCloneTarget(spec: string): { url: string; ref?: string } {
  const trimmed = spec.trim();
  if (!trimmed) throw new Error(`Invalid GitHub spec: ${spec}`);

  // parsePresetIdentifier treats bare "org/repo" as a local preset name
  // (per its docs). For this entry point, the user is explicitly importing
  // from GitHub, so a bare slash-separated name should be interpreted as
  // GitHub shorthand. Prepend `github:` in that case.
  const normalized =
    trimmed.startsWith("github:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `github:${trimmed}`;

  const descriptor = parsePresetIdentifier(normalized);
  if (descriptor.type !== "github") {
    throw new Error(`Not a GitHub identifier: ${spec}`);
  }
  const url = `https://github.com/${descriptor.identifier}.git`;
  // preset-resolver puts a tag in `version` and a branch in `ref`; either
  // works as a `--branch` value for git clone.
  const ref = descriptor.ref ?? descriptor.version;
  return ref ? { url, ref } : { url };
}

/**
 * Connect to a public GitHub repository. Shallow clones to os.tmpdir().
 * Private repos are not supported in V1 (no auth handling).
 */
export async function connectGithubRepo(spec: string): Promise<ExternalSource> {
  const { url, ref } = resolveGithubCloneTarget(spec);
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

/**
 * Walk the tree and reject any path that escapes the root via symlinks etc.
 * Exported for unit testing — internal API, do not depend on it from
 * non-test code.
 */
export async function assertPathsContained(root: string): Promise<void> {
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
