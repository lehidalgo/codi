import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { Command } from "commander";
import {
  addGlobalOptions,
  initFromOptions,
  handleOutput,
  regenerateConfigs,
} from "#src/cli/shared.js";
import { createCommandResult } from "#src/core/output/formatter.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { Logger } from "#src/core/output/logger.js";
import { clearAdapters } from "#src/core/generator/adapter-registry.js";
import {
  PROJECT_NAME,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "#src/constants.js";

describe("shared CLI utilities", () => {
  describe("addGlobalOptions", () => {
    it("adds --json, --verbose, --quiet, --no-color options", () => {
      const cmd = new Command();
      addGlobalOptions(cmd);

      cmd.parse(["--json", "--verbose"], { from: "user" });
      const opts = cmd.opts();
      expect(opts["json"]).toBe(true);
      expect(opts["verbose"]).toBe(true);
    });
  });

  describe("initFromOptions", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });
      stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    it("initializes logger with defaults", () => {
      expect(() => initFromOptions({})).not.toThrow();
    });

    it("rejects --verbose and --quiet together", () => {
      expect(() => initFromOptions({ verbose: true, quiet: true })).toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("handleOutput", () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it("outputs JSON when --json is set", () => {
      const result = createCommandResult({
        success: true,
        command: "test",
        data: { hello: "world" },
        exitCode: EXIT_CODES.SUCCESS,
      });

      handleOutput(result, { json: true });
      const output = stdoutSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.hello).toBe("world");
    });

    it("outputs human-readable format by default", () => {
      const result = createCommandResult({
        success: true,
        command: "test",
        data: null,
        exitCode: EXIT_CODES.SUCCESS,
      });

      handleOutput(result, {});
      const output = stdoutSpy.mock.calls[0]![0] as string;
      expect(output).toContain("[OK] test");
    });
  });

  describe("regenerateConfigs", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), `${PROJECT_NAME}-shared-regen-`),
      );
      clearAdapters();
      Logger.init({ level: "error", mode: "human", noColor: true });
    });

    afterEach(async () => {
      await cleanupTmpDir(tmpDir);
      clearAdapters();
    });

    it("returns false when no config exists", async () => {
      const success = await regenerateConfigs(tmpDir);
      expect(success).toBe(false);
    });

    it("returns true with a valid config", async () => {
      const configDir = path.join(tmpDir, PROJECT_DIR);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, MANIFEST_FILENAME),
        'name: test\nversion: "1"\nagents:\n  - claude-code\n',
        "utf-8",
      );
      await fs.writeFile(path.join(configDir, "flags.yaml"), "{}", "utf-8");

      const success = await regenerateConfigs(tmpDir);
      expect(success).toBe(true);
    });
  });
});
