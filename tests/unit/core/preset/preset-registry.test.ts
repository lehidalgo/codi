import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as yamlStringify } from "yaml";

// Mock child_process before importing the module under test
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";

import {
  getRegistryConfig,
  filterEntries,
  readLockFile,
  writeLockFile,
  cloneRegistry,
  readRegistryIndex,
  getPresetVersionFromDir,
  copyDir,
} from "../../../../src/core/preset/preset-registry.js";
import type {
  RegistryEntry,
  PresetLock,
  RegistryConfig,
} from "../../../../src/core/preset/preset-registry.js";
import type { ProjectManifest } from "../../../../src/types/config.js";
import {
  PROJECT_NAME,
  PRESET_LOCK_FILENAME,
  REGISTRY_INDEX_FILENAME,
} from "../../../../src/constants.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-reg-test-`));
}

const sampleEntries: RegistryEntry[] = [
  {
    name: "team-backend",
    description: "Backend API preset",
    version: "1.0.0",
    tags: ["backend", "api"],
  },
  {
    name: "org-frontend",
    description: "Frontend web preset",
    version: "2.0.0",
    tags: ["frontend", "react"],
  },
  {
    name: "my-custom-config",
    description: "Custom project configuration",
    version: "1.2.0",
    tags: ["custom"],
  },
];

// ---------------------------------------------------------------------------
// getRegistryConfig
// ---------------------------------------------------------------------------

describe("getRegistryConfig", () => {
  it("returns default config when manifest is null", () => {
    const config = getRegistryConfig(null);

    expect(config).toEqual({
      url: `${PROJECT_NAME}-registry/presets`,
      branch: "main",
    });
  });

  it("returns default config when manifest has no presetRegistry", () => {
    const manifest = { agents: {} } as unknown as ProjectManifest;

    const config = getRegistryConfig(manifest);

    expect(config).toEqual({
      url: `${PROJECT_NAME}-registry/presets`,
      branch: "main",
    });
  });

  it("uses manifest config when presetRegistry is provided", () => {
    const manifest = {
      presetRegistry: {
        url: "https://github.com/my-org/presets",
        branch: "develop",
      },
    } as unknown as ProjectManifest;

    const config = getRegistryConfig(manifest);

    expect(config).toEqual({
      url: "https://github.com/my-org/presets",
      branch: "develop",
    });
  });

  it("defaults branch to main when not specified in manifest", () => {
    const manifest = {
      presetRegistry: { url: "https://github.com/my-org/presets" },
    } as unknown as ProjectManifest;

    const config = getRegistryConfig(manifest);

    expect(config.branch).toBe("main");
    expect(config.url).toBe("https://github.com/my-org/presets");
  });
});

// ---------------------------------------------------------------------------
// filterEntries
// ---------------------------------------------------------------------------

describe("filterEntries", () => {
  it("filters by name match", () => {
    const result = filterEntries(sampleEntries, "backend");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("team-backend");
  });

  it("filters by description match", () => {
    const result = filterEntries(sampleEntries, "frontend");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("org-frontend");
  });

  it("filters by tag match", () => {
    const result = filterEntries(sampleEntries, "react");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("org-frontend");
  });

  it("returns empty array for no matches", () => {
    const result = filterEntries(sampleEntries, "nonexistent-query");

    expect(result).toEqual([]);
  });

  it("is case-insensitive", () => {
    const result = filterEntries(sampleEntries, "BACKEND");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("team-backend");
  });

  it("returns multiple matches when query is broad", () => {
    const result = filterEntries(sampleEntries, "e");

    expect(result.length).toBeGreaterThan(1);
  });

  it("returns empty array when entries list is empty", () => {
    const result = filterEntries([], "anything");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// readLockFile
// ---------------------------------------------------------------------------

describe("readLockFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty lock when file does not exist", async () => {
    const lock = await readLockFile(tmpDir);

    expect(lock).toEqual({ presets: {} });
  });

  it("parses existing lock file", async () => {
    const lockData: PresetLock = {
      presets: {
        "my-preset": {
          version: "1.0.0",
          source: "github:org/repo",
          sourceType: "github",
          commit: "abc123",
          installedAt: "2026-01-01T00:00:00Z",
        },
      },
    };
    await fs.writeFile(
      path.join(tmpDir, PRESET_LOCK_FILENAME),
      JSON.stringify(lockData, null, 2),
      "utf-8",
    );

    const lock = await readLockFile(tmpDir);

    expect(lock.presets["my-preset"]).toBeDefined();
    expect(lock.presets["my-preset"]!.version).toBe("1.0.0");
    expect(lock.presets["my-preset"]!.sourceType).toBe("github");
    expect(lock.presets["my-preset"]!.commit).toBe("abc123");
  });

  it("returns empty lock when file contains invalid JSON", async () => {
    await fs.writeFile(
      path.join(tmpDir, PRESET_LOCK_FILENAME),
      "not valid json {{",
      "utf-8",
    );

    const lock = await readLockFile(tmpDir);

    expect(lock).toEqual({ presets: {} });
  });
});

// ---------------------------------------------------------------------------
// writeLockFile
// ---------------------------------------------------------------------------

describe("writeLockFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes valid JSON lock file", async () => {
    const lock: PresetLock = {
      presets: {
        demo: {
          version: "2.0.0",
          source: "local",
          sourceType: "local",
          installedAt: "2026-03-01T00:00:00Z",
        },
      },
    };

    await writeLockFile(tmpDir, lock);

    const raw = await fs.readFile(
      path.join(tmpDir, PRESET_LOCK_FILENAME),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as PresetLock;
    expect(parsed.presets["demo"]!.version).toBe("2.0.0");
  });

  it("overwrites existing lock file", async () => {
    const lock1: PresetLock = {
      presets: {
        a: {
          version: "1.0.0",
          source: "x",
          sourceType: "local",
          installedAt: "",
        },
      },
    };
    const lock2: PresetLock = {
      presets: {
        b: {
          version: "2.0.0",
          source: "y",
          sourceType: "builtin",
          installedAt: "",
        },
      },
    };

    await writeLockFile(tmpDir, lock1);
    await writeLockFile(tmpDir, lock2);

    const raw = await fs.readFile(
      path.join(tmpDir, PRESET_LOCK_FILENAME),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as PresetLock;
    expect(parsed.presets["a"]).toBeUndefined();
    expect(parsed.presets["b"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// readRegistryIndex
// ---------------------------------------------------------------------------

describe("readRegistryIndex", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when index file does not exist", async () => {
    const entries = await readRegistryIndex(tmpDir);

    expect(entries).toEqual([]);
  });

  it("parses existing index file", async () => {
    await fs.writeFile(
      path.join(tmpDir, REGISTRY_INDEX_FILENAME),
      JSON.stringify(sampleEntries),
      "utf-8",
    );

    const entries = await readRegistryIndex(tmpDir);

    expect(entries).toHaveLength(3);
    expect(entries[0]!.name).toBe("team-backend");
  });
});

// ---------------------------------------------------------------------------
// getPresetVersionFromDir
// ---------------------------------------------------------------------------

describe("getPresetVersionFromDir", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reads version from preset.yaml", async () => {
    const manifest = { name: "test-preset", version: "3.1.4" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const version = await getPresetVersionFromDir(tmpDir);

    expect(version).toBe("3.1.4");
  });

  it("returns 0.0.0 when preset.yaml is missing", async () => {
    const version = await getPresetVersionFromDir(tmpDir);

    expect(version).toBe("0.0.0");
  });

  it("returns 0.0.0 when version field is missing in preset.yaml", async () => {
    const manifest = { name: "no-version-preset" };
    await fs.writeFile(
      path.join(tmpDir, "preset.yaml"),
      yamlStringify(manifest),
      "utf-8",
    );

    const version = await getPresetVersionFromDir(tmpDir);

    expect(version).toBe("0.0.0");
  });
});

// ---------------------------------------------------------------------------
// copyDir
// ---------------------------------------------------------------------------

describe("copyDir", () => {
  let srcDir: string;
  let destDir: string;

  beforeEach(async () => {
    srcDir = await makeTmpDir();
    destDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(srcDir, { recursive: true, force: true });
    await fs.rm(destDir, { recursive: true, force: true });
  });

  it("copies files recursively", async () => {
    await fs.writeFile(path.join(srcDir, "file.txt"), "hello", "utf-8");
    await fs.mkdir(path.join(srcDir, "sub"), { recursive: true });
    await fs.writeFile(
      path.join(srcDir, "sub", "nested.txt"),
      "world",
      "utf-8",
    );

    await copyDir(srcDir, destDir);

    const topFile = await fs.readFile(path.join(destDir, "file.txt"), "utf-8");
    const nestedFile = await fs.readFile(
      path.join(destDir, "sub", "nested.txt"),
      "utf-8",
    );
    expect(topFile).toBe("hello");
    expect(nestedFile).toBe("world");
  });

  it("skips .git directory", async () => {
    await fs.mkdir(path.join(srcDir, ".git"), { recursive: true });
    await fs.writeFile(
      path.join(srcDir, ".git", "config"),
      "git-data",
      "utf-8",
    );
    await fs.writeFile(path.join(srcDir, "readme.md"), "content", "utf-8");

    await copyDir(srcDir, destDir);

    const readmeExists = await fs
      .stat(path.join(destDir, "readme.md"))
      .then(() => true)
      .catch(() => false);
    const gitExists = await fs
      .stat(path.join(destDir, ".git"))
      .then(() => true)
      .catch(() => false);
    expect(readmeExists).toBe(true);
    expect(gitExists).toBe(false);
  });

  it("handles empty directories", async () => {
    await fs.mkdir(path.join(srcDir, "empty-sub"), { recursive: true });

    await copyDir(srcDir, destDir);

    const stat = await fs.stat(path.join(destDir, "empty-sub"));
    expect(stat.isDirectory()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cloneRegistry (mocked execFile)
// ---------------------------------------------------------------------------

describe("cloneRegistry", () => {
  beforeEach(() => {
    vi.mocked(execFile).mockReset();
  });

  it("calls git clone with correct arguments", async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      if (typeof callback === "function") {
        (
          callback as (
            err: Error | null,
            stdout: string,
            stderr: string,
          ) => void
        )(null, "", "");
      }
      return undefined as never;
    });

    const config: RegistryConfig = {
      url: "https://github.com/org/presets",
      branch: "main",
    };
    const resultDir = await cloneRegistry(config);

    expect(execFile).toHaveBeenCalledOnce();
    const call = vi.mocked(execFile).mock.calls[0]!;
    expect(call[0]).toBe("git");
    const args = call[1] as string[];
    expect(args[0]).toBe("clone");
    expect(args).toContain("--depth");
    expect(args).toContain("1");
    expect(args).toContain("--branch");
    expect(args).toContain("main");
    expect(args).toContain("https://github.com/org/presets");
    expect(typeof resultDir).toBe("string");
    expect(resultDir).toContain(`${PROJECT_NAME}-registry-`);
  });

  it("propagates git errors", async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      if (typeof callback === "function") {
        (callback as (err: Error | null) => void)(
          new Error("git clone failed"),
        );
      }
      return undefined as never;
    });

    const config: RegistryConfig = {
      url: "https://bad-url.com/repo",
      branch: "main",
    };
    await expect(cloneRegistry(config)).rejects.toThrow("git clone failed");
  });

  it("uses the provided branch in args", async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      if (typeof callback === "function") {
        (
          callback as (
            err: Error | null,
            stdout: string,
            stderr: string,
          ) => void
        )(null, "", "");
      }
      return undefined as never;
    });

    const config: RegistryConfig = {
      url: "https://github.com/org/presets",
      branch: "develop",
    };
    await cloneRegistry(config);

    const args = vi.mocked(execFile).mock.calls[0]![1] as string[];
    expect(args).toContain("develop");
  });
});
