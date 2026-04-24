import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { connectLocalDirectory } from "#src/core/external-source/connectors.js";

const FIXTURE_ROOT = path.resolve(__dirname, "../../../fixtures/external-presets/sample-a");

describe("external-source connectors", () => {
  describe("connectLocalDirectory", () => {
    it("connects to a real directory with id, rootPath, cleanup", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      expect(source.id).toBe(`local:${FIXTURE_ROOT}`);
      expect(source.rootPath).toBe(FIXTURE_ROOT);
      expect(typeof source.cleanup).toBe("function");
      // cleanup is a no-op for local dirs — must not throw
      await expect(source.cleanup()).resolves.toBeUndefined();
    });

    it("rejects a non-existent path", async () => {
      await expect(connectLocalDirectory("/this/path/does/not/exist/anywhere")).rejects.toThrow(
        /Not a readable directory/,
      );
    });

    it("rejects a file (not directory)", async () => {
      const filePath = path.join(FIXTURE_ROOT, "rules", "sample-rule.md");
      await expect(connectLocalDirectory(filePath)).rejects.toThrow(/Not a readable directory/);
    });

    it("preserves the directory after cleanup (we did not own it)", async () => {
      const source = await connectLocalDirectory(FIXTURE_ROOT);
      await source.cleanup();
      const stat = await fs.stat(FIXTURE_ROOT);
      expect(stat.isDirectory()).toBe(true);
    });
  });
});
