import { describe, it, expect, vi, beforeEach } from "vitest";
import { logMissingDeps, installMissingDeps } from "#src/core/hooks/hook-dep-installer.js";
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

    expect(log.warn).toHaveBeenCalledWith("Missing hook dependencies — install before committing:");
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

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("brew install shellcheck"));
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

    expect(log.warn).toHaveBeenCalledWith("Missing hook dependencies — install before committing:");
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("eslint"));
  });

  it("logs missing system deps without prompting", async () => {
    const deps = [createSystemDep("shellcheck")];
    await installMissingDeps(deps, "/tmp", log, false);

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("shellcheck"));
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
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Install before committing"));
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

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Failed to install"));
  });

  it("warns about system deps that need manual installation", async () => {
    const deps = [createSystemDep("shellcheck")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Missing system tools"));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("shellcheck"));
  });

  it("handles mixed npm and system deps", async () => {
    const { confirm } = await import("@clack/prompts");
    vi.mocked(confirm).mockResolvedValueOnce(true);

    const deps = [createNodeDep("eslint"), createSystemDep("shellcheck")];
    await installMissingDeps(deps, "/tmp", log, true);

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Missing system tools"));
  });
});

describe("inferPackageManager", () => {
  it("recognizes pip / pip3", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("pip install ruff")).toBe("pip");
    expect(inferPackageManager("pip3 install ruff")).toBe("pip");
  });
  it("recognizes brew", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("brew install gitleaks")).toBe("brew");
  });
  it("recognizes gem", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("gem install rubocop")).toBe("gem");
  });
  it("recognizes go install", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("go install github.com/x/y@latest")).toBe("go");
  });
  it("recognizes cargo install", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("cargo install x")).toBe("cargo");
  });
  it("recognizes rustup component add as a separate manager", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("rustup component add clippy")).toBe("rustup");
  });
  it("returns manual for unknown hints", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("Install .NET SDK from https://dot.net")).toBe("manual");
    expect(inferPackageManager("")).toBe("manual");
  });
  it("ignores leading whitespace", async () => {
    const { inferPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(inferPackageManager("  pip install x")).toBe("pip");
  });
});

describe("extractPackagesFromHint", () => {
  it("returns empty array for manual", async () => {
    const { extractPackagesFromHint } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(extractPackagesFromHint("Install .NET SDK from https://dot.net", "manual")).toEqual([]);
  });
  it("extracts a single pip package", async () => {
    const { extractPackagesFromHint } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(extractPackagesFromHint("pip install ruff", "pip")).toEqual(["ruff"]);
  });
  it("extracts multiple brew packages", async () => {
    const { extractPackagesFromHint } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(extractPackagesFromHint("brew install gitleaks clang-format", "brew")).toEqual([
      "gitleaks",
      "clang-format",
    ]);
  });
  it("extracts a go package", async () => {
    const { extractPackagesFromHint } = await import("#src/core/hooks/hook-dep-installer.js");
    expect(extractPackagesFromHint("go install github.com/x/y@latest", "go")).toEqual([
      "github.com/x/y@latest",
    ]);
  });
});

describe("groupByPackageManager — non-npm batching", () => {
  const dep = (name: string, hint: string): DependencyCheck => ({
    name,
    available: false,
    installHint: hint,
    isNodePackage: false,
  });

  it("batches multiple brew tools into one group", async () => {
    const { groupByPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    const groups = groupByPackageManager([
      dep("gitleaks", "brew install gitleaks"),
      dep("clang-format", "brew install clang-format"),
    ]);
    const brew = groups.find((g) => g.label.startsWith("brew install"));
    expect(brew).toBeDefined();
    expect(brew!.deps.length).toBe(2);
    expect(brew!.label).toBe("brew install gitleaks clang-format");
  });

  it("keeps unknown hints as separate manual entries", async () => {
    const { groupByPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    const groups = groupByPackageManager([dep("dotnet", "Install .NET SDK from https://dot.net")]);
    const manual = groups.filter((g) => g.deps[0]?.name === "dotnet");
    expect(manual.length).toBe(1);
  });

  it("emits separate groups per package manager", async () => {
    const { groupByPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    const groups = groupByPackageManager([
      dep("ruff", "pip install ruff"),
      dep("gitleaks", "brew install gitleaks"),
      dep("rubocop", "gem install rubocop"),
    ]);
    expect(groups.find((g) => g.label === "pip install ruff")).toBeDefined();
    expect(groups.find((g) => g.label === "brew install gitleaks")).toBeDefined();
    expect(groups.find((g) => g.label === "gem install rubocop")).toBeDefined();
  });

  it("keeps cargo install and rustup component add in separate groups", async () => {
    const { groupByPackageManager } = await import("#src/core/hooks/hook-dep-installer.js");
    const groups = groupByPackageManager([
      dep("foo", "cargo install foo"),
      dep("clippy", "rustup component add clippy"),
    ]);
    const cargo = groups.find((g) => g.label.startsWith("cargo install"));
    const rustup = groups.find((g) => g.label.startsWith("rustup component add"));
    expect(cargo).toBeDefined();
    expect(rustup).toBeDefined();
    expect(cargo!.label).toBe("cargo install foo");
    expect(rustup!.label).toBe("rustup component add clippy");
  });
});
