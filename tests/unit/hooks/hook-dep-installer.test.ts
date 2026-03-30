import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logMissingDeps,
  installMissingDeps,
} from "#src/core/hooks/hook-dep-installer.js";
import type { DependencyCheck } from "#src/core/hooks/hook-dependency-checker.js";
import type { Logger } from "#src/core/output/logger.js";

vi.mock("@clack/prompts", () => ({
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: { warning: vi.fn(), info: vi.fn() },
  spinner: vi.fn().mockReturnValue({ start: vi.fn(), stop: vi.fn() }),
}));

vi.mock("#src/utils/exec.js", () => ({
  execFileAsync: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

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

describe("installMissingDeps — interactive mode", () => {
  let log: Logger;

  beforeEach(() => {
    log = createMockLogger();
    vi.clearAllMocks();
  });

  it("installs npm deps when user confirms", async () => {
    const { confirm } = await import("@clack/prompts");
    const { execFileAsync } = await import("#src/utils/exec.js");
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const deps = [createNodeDep("eslint")];
    await installMissingDeps(deps, "/tmp/project", log, true);

    expect(execFileAsync).toHaveBeenCalledWith(
      "npm",
      expect.arrayContaining(["install", "-D", "eslint"]),
      expect.objectContaining({ cwd: "/tmp/project" }),
    );
  });

  it("maps tsc to typescript package name", async () => {
    const { confirm } = await import("@clack/prompts");
    const { execFileAsync } = await import("#src/utils/exec.js");
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const deps = [createNodeDep("tsc")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(execFileAsync).toHaveBeenCalledWith(
      "npm",
      expect.arrayContaining(["typescript"]),
      expect.anything(),
    );
  });

  it("skips installation when user declines", async () => {
    const { confirm } = await import("@clack/prompts");
    const { execFileAsync } = await import("#src/utils/exec.js");
    vi.mocked(confirm).mockResolvedValueOnce(false);

    const deps = [createNodeDep("eslint")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(execFileAsync).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Install before committing"),
    );
  });

  it("handles user cancellation", async () => {
    const { confirm, isCancel } = await import("@clack/prompts");
    vi.mocked(confirm).mockResolvedValueOnce(Symbol.for("cancel") as never);
    vi.mocked(isCancel).mockReturnValueOnce(true);

    const deps = [createNodeDep("eslint")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipped dependency installation"),
    );
  });

  it("handles installation failure gracefully", async () => {
    const { confirm } = await import("@clack/prompts");
    const { execFileAsync } = await import("#src/utils/exec.js");
    vi.mocked(confirm).mockResolvedValueOnce(true);
    vi.mocked(execFileAsync).mockRejectedValueOnce(new Error("EACCES"));

    const deps = [createNodeDep("eslint")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to install"),
    );
  });

  it("warns about system deps that need manual installation", async () => {
    const deps = [createSystemDep("shellcheck")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Missing system tools"),
    );
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("shellcheck"),
    );
  });

  it("handles mixed npm and system deps", async () => {
    const { confirm } = await import("@clack/prompts");
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const deps = [createNodeDep("eslint"), createSystemDep("shellcheck")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Missing system tools"),
    );
  });
});
