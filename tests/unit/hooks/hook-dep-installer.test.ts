import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logMissingDeps,
  installMissingDeps,
} from "#src/core/hooks/hook-dep-installer.js";
import type { DependencyCheck } from "#src/core/hooks/hook-dependency-checker.js";
import type { Logger } from "#src/core/output/logger.js";

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  } as unknown as Logger;
}

function createNodeDep(name: string): DependencyCheck {
  return {
    name,
    installed: false,
    isNodePackage: true,
    installHint: `npm install -D ${name}`,
  };
}

function createSystemDep(name: string): DependencyCheck {
  return {
    name,
    installed: false,
    isNodePackage: false,
    installHint: `brew install ${name}`,
  };
}

describe("logMissingDeps", () => {
  let log: Logger;

  beforeEach(() => {
    log = createMockLogger();
  });

  it("does nothing when deps array is empty", () => {
    logMissingDeps([], log);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("logs warning for single missing npm dependency", () => {
    const deps = [createNodeDep("eslint")];
    logMissingDeps(deps, log);

    expect(log.warn).toHaveBeenCalledWith(
      "Missing hook dependencies — install before committing:",
    );
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("eslint"));
  });

  it("logs warning for multiple missing dependencies", () => {
    const deps = [
      createNodeDep("eslint"),
      createNodeDep("prettier"),
      createSystemDep("shellcheck"),
    ];
    logMissingDeps(deps, log);

    // Header + 3 dependency lines = 4 calls
    expect(log.warn).toHaveBeenCalledTimes(4);
  });

  it("logs system dependency install hints", () => {
    const deps = [createSystemDep("shellcheck")];
    logMissingDeps(deps, log);

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("brew install shellcheck"),
    );
  });
});

describe("installMissingDeps — non-interactive mode", () => {
  let log: Logger;

  beforeEach(() => {
    log = createMockLogger();
  });

  it("does nothing when deps array is empty", async () => {
    await installMissingDeps([], "/tmp", log, false);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("logs missing npm deps without prompting", async () => {
    const deps = [createNodeDep("eslint")];
    await installMissingDeps(deps, "/tmp", log, false);

    expect(log.warn).toHaveBeenCalledWith(
      "Missing hook dependencies — install before committing:",
    );
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("eslint"));
  });

  it("logs missing system deps without prompting", async () => {
    const deps = [createSystemDep("shellcheck")];
    await installMissingDeps(deps, "/tmp", log, false);

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("shellcheck"),
    );
  });

  it("logs all dependencies in non-interactive mode", async () => {
    const deps = [
      createNodeDep("eslint"),
      createNodeDep("prettier"),
      createSystemDep("shellcheck"),
    ];
    await installMissingDeps(deps, "/tmp", log, false);

    // Header + 3 deps = 4 calls
    expect(log.warn).toHaveBeenCalledTimes(4);
  });
});
