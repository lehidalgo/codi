import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

const CLI_PATH = path.resolve(__dirname, "../../../dist/cli.js");

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs the codi CLI with given arguments in the specified directory.
 * Always appends --json for parseable output.
 */
export async function runCodi(
  cwd: string,
  args: string[],
  options: { json?: boolean; timeout?: number } = {},
): Promise<CliResult> {
  const finalArgs = [CLI_PATH, ...args];
  if (options.json !== false) {
    finalArgs.push("--json");
  }

  try {
    const { stdout, stderr } = await execFileAsync("node", finalArgs, {
      cwd,
      timeout: options.timeout ?? 30_000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

/**
 * Creates an isolated temporary project directory for E2E testing.
 * Returns the project path and a cleanup function.
 */
export async function createTempProject(
  name = "test-project",
): Promise<{ projectDir: string; cleanup: () => Promise<void> }> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "codi-e2e-"));
  const projectDir = path.join(base, name);
  await fs.mkdir(projectDir, { recursive: true });

  // Create a minimal package.json for stack detection
  await fs.writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({ name, version: "1.0.0" }),
    "utf-8",
  );

  return {
    projectDir,
    cleanup: async () => {
      await fs.rm(base, { recursive: true, force: true });
    },
  };
}

/**
 * Checks if a file exists at the given path.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

/**
 * Reads a file and returns its content.
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

/**
 * Parses JSON output from a codi CLI command.
 */
export function parseJsonOutput(stdout: string): Record<string, unknown> {
  // CLI may output non-JSON lines before the JSON; find the JSON block
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (line.startsWith("{")) {
      try {
        return JSON.parse(lines.slice(i).join("\n")) as Record<string, unknown>;
      } catch {
        continue;
      }
    }
  }
  throw new Error(`No JSON found in CLI output:\n${stdout}`);
}
