import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { PROJECT_DIR } from "#src/constants.js";
import {
  runCli,
  createTempProject,
  fileExists,
  readFile,
} from "./helpers/cli-harness.js";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let projectDir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const project = await createTempProject();
  projectDir = project.projectDir;
  cleanup = project.cleanup;

  // Init project
  await runCli(projectDir, ["init", "--agents", "claude-code"]);
});

afterEach(async () => {
  await cleanup();
});

describe("E2E: preset operations", () => {
  it("creates a custom preset", async () => {
    const result = await runCli(projectDir, ["preset", "create", "my-preset"]);
    expect(result.exitCode).toBe(0);

    const presetDir = path.join(
      projectDir,
      PROJECT_DIR,
      "presets",
      "my-preset",
    );
    expect(await fileExists(presetDir)).toBe(true);
    expect(await fileExists(path.join(presetDir, "preset.yaml"))).toBe(true);

    const content = await readFile(path.join(presetDir, "preset.yaml"));
    const manifest = parseYaml(content) as Record<string, unknown>;
    expect(manifest["name"]).toBe("my-preset");
    expect(manifest["version"]).toBe("1.0.0");
  });

  it("lists presets with --builtin", async () => {
    const result = await runCli(projectDir, ["preset", "list", "--builtin"]);
    expect(result.exitCode).toBe(0);

    // JSON output should contain presets array
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    const data = output["data"] as Record<string, unknown>;
    const presets = data["presets"] as Array<{ name: string }>;
    expect(presets.length).toBeGreaterThan(0);
  });

  it("validates a custom preset", async () => {
    // Create preset first
    await runCli(projectDir, ["preset", "create", "valid-preset"]);

    const result = await runCli(projectDir, [
      "preset",
      "validate",
      "valid-preset",
    ]);
    expect(result.exitCode).toBe(0);
  });

  it("removes a custom preset", async () => {
    await runCli(projectDir, ["preset", "create", "removable"]);

    const presetDir = path.join(
      projectDir,
      PROJECT_DIR,
      "presets",
      "removable",
    );
    expect(await fileExists(presetDir)).toBe(true);

    const result = await runCli(projectDir, ["preset", "remove", "removable"]);
    expect(result.exitCode).toBe(0);
    expect(await fileExists(presetDir)).toBe(false);
  });

  it("remove fails for nonexistent preset", async () => {
    const result = await runCli(projectDir, ["preset", "remove", "ghost"]);
    expect(result.exitCode).not.toBe(0);
  });
});

describe("E2E: update with preset flags", () => {
  it("update --preset strict changes flags", async () => {
    const result = await runCli(projectDir, ["update", "--preset", "strict"]);
    expect(result.exitCode).toBe(0);

    const flagsContent = await readFile(
      path.join(projectDir, PROJECT_DIR, "flags.yaml"),
    );
    const flags = parseYaml(flagsContent) as Record<
      string,
      Record<string, unknown>
    >;
    expect(flags["security_scan"]?.["mode"]).toBe("enforced");
    expect(flags["security_scan"]?.["locked"]).toBe(true);
  });

  it("update --preset invalid fails", async () => {
    const result = await runCli(projectDir, [
      "update",
      "--preset",
      "nonexistent",
    ]);
    expect(result.exitCode).not.toBe(0);
  });

  it("update --dry-run does not change files", async () => {
    const flagsBefore = await readFile(
      path.join(projectDir, PROJECT_DIR, "flags.yaml"),
    );

    await runCli(projectDir, ["update", "--preset", "strict", "--dry-run"]);

    const flagsAfter = await readFile(
      path.join(projectDir, PROJECT_DIR, "flags.yaml"),
    );
    expect(flagsAfter).toBe(flagsBefore);
  });
});
