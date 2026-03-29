import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  marketplaceSearchHandler,
  marketplaceInstallHandler,
} from "../../../src/cli/marketplace.js";
import { Logger } from "../../../src/core/output/logger.js";
import { EXIT_CODES } from "../../../src/core/output/exit-codes.js";
import {
  REGISTRY_INDEX_FILENAME,
  PROJECT_NAME,
  PROJECT_DIR,
} from "../../../src/constants.js";

// Mock child_process.execFile to avoid real git clone operations
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// We need to intercept the cloneRegistry function.
// Since it uses execFile internally, we mock the entire module's git clone
// by providing a local registry directory instead.
// The approach: mock execFile so that 'git clone' creates a local dir with an index.

let mockRegistryDir: string;

beforeEach(async () => {
  // Create a fake registry directory
  mockRegistryDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `${PROJECT_NAME}-mock-registry-`),
  );

  const registryIndex = [
    {
      name: "test-skill",
      description: "A test skill for unit testing",
      path: "skills/test-skill.md",
    },
    {
      name: "another-skill",
      description: "Another skill for search",
      path: "skills/another-skill.md",
    },
  ];
  await fs.writeFile(
    path.join(mockRegistryDir, REGISTRY_INDEX_FILENAME),
    JSON.stringify(registryIndex),
    "utf-8",
  );

  // Create the actual skill files
  const skillsDir = path.join(mockRegistryDir, "skills");
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.writeFile(
    path.join(skillsDir, "test-skill.md"),
    "# Test Skill\nContent here.",
    "utf-8",
  );
  await fs.writeFile(
    path.join(skillsDir, "another-skill.md"),
    "# Another Skill\nMore content.",
    "utf-8",
  );

  // Mock execFile to simulate git clone by copying our mock registry
  const { execFile } = await import("node:child_process");
  const mockedExecFile = vi.mocked(execFile);
  mockedExecFile.mockImplementation((...args: unknown[]) => {
    const command = args[0] as string;
    const cmdArgs = args[1] as string[];
    const callback = args[args.length - 1] as (
      error: Error | null,
      result: { stdout: string; stderr: string },
    ) => void;

    if (command === "git" && cmdArgs[0] === "clone") {
      // The last arg before options is the target directory
      const targetDir = cmdArgs[cmdArgs.length - 1] as string;
      // Copy mock registry to target
      fs.cp(mockRegistryDir, targetDir, { recursive: true }).then(() => {
        if (typeof callback === "function") {
          callback(null, { stdout: "", stderr: "" });
        }
      });
    }

    // Return a fake ChildProcess
    return {
      on: vi.fn(),
      stdout: null,
      stderr: null,
      pid: 0,
    } as unknown as ReturnType<typeof execFile>;
  });
});

afterEach(async () => {
  await fs.rm(mockRegistryDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("marketplace search handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-mp-search-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("searches and finds matching skills", async () => {
    const result = await marketplaceSearchHandler(tmpDir, "test", {});

    expect(result.success).toBe(true);
    expect(result.command).toBe("marketplace search");
    expect(result.data.action).toBe("search");
    expect(result.data.results).toBeDefined();
    expect(result.data.results!.length).toBeGreaterThan(0);
    expect(result.data.results!.some((r) => r.name === "test-skill")).toBe(
      true,
    );
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("returns empty results for non-matching query", async () => {
    const result = await marketplaceSearchHandler(
      tmpDir,
      "nonexistent-xyz",
      {},
    );

    expect(result.success).toBe(true);
    expect(result.data.results).toBeDefined();
    expect(result.data.results!.length).toBe(0);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});

describe("marketplace install handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-mp-install-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("installs an existing skill", async () => {
    const result = await marketplaceInstallHandler(tmpDir, "test-skill", {});

    expect(result.success).toBe(true);
    expect(result.command).toBe("marketplace install");
    expect(result.data.action).toBe("install");
    expect(result.data.installed).toBe("test-skill");
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    // Verify the file was actually written
    const destPath = path.join(tmpDir, PROJECT_DIR, "skills", "test-skill.md");
    const content = await fs.readFile(destPath, "utf-8");
    expect(content).toContain("Test Skill");
  });

  it("fails for a non-existent skill", async () => {
    const result = await marketplaceInstallHandler(
      tmpDir,
      "does-not-exist",
      {},
    );

    expect(result.success).toBe(false);
    expect(result.data.action).toBe("install");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain("not found in registry");
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});
