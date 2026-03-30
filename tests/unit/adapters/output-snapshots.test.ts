import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeCodeAdapter } from "#src/adapters/claude-code.js";
import { cursorAdapter } from "#src/adapters/cursor.js";
import { codexAdapter } from "#src/adapters/codex.js";
import { windsurfAdapter } from "#src/adapters/windsurf.js";
import { clineAdapter } from "#src/adapters/cline.js";
import { createMockConfig } from "./mock-config.js";
import { PROJECT_NAME, MANIFEST_FILENAME } from "#src/constants.js";
import type { AgentAdapter } from "#src/types/agent.js";

const adapters: AgentAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  codexAdapter,
  windsurfAdapter,
  clineAdapter,
];

describe("generated output snapshots", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      `${PROJECT_NAME}-snap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  const config = createMockConfig({
    rules: [
      {
        name: "Code Style",
        description: "Enforce consistent code style",
        content: "Use 2-space indentation and single quotes.",
        priority: "high",
        alwaysApply: true,
        managedBy: PROJECT_NAME,
      },
    ],
    skills: [
      {
        name: "review",
        description: "Code review skill",
        content: "Review all code changes for quality.",
        priority: "high",
        alwaysApply: true,
        managedBy: PROJECT_NAME,
      },
    ],
    flags: {
      allow_force_push: {
        value: false,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
      allow_shell_commands: {
        value: true,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
      max_file_lines: {
        value: 500,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
    },
  });

  for (const adapter of adapters) {
    it(`${adapter.id} output matches snapshot`, async () => {
      const files = await adapter.generate(config, { projectRoot: tmpDir });
      expect(files.length).toBeGreaterThan(0);

      // Find the main instruction file
      const mainFile = files.find(
        (f) => f.path === adapter.paths.instructionFile,
      );
      expect(mainFile).toBeDefined();
      expect(mainFile!.content).toMatchSnapshot();
    });
  }
});
