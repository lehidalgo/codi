import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { cleanHandler } from "#src/cli/clean.js";
import { Logger } from "#src/core/output/logger.js";
import {
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  PROJECT_DIR,
  MANIFEST_FILENAME,
} from "#src/constants.js";

describe("clean command handler", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-clean-`));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  async function setupProject(): Promise<void> {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: test\nversion: "1"\n',
      "utf-8",
    );
    await fs.writeFile(
      path.join(configDir, "state.json"),
      JSON.stringify({
        version: "1",
        lastGenerated: new Date().toISOString(),
        agents: {
          "claude-code": [
            {
              path: "CLAUDE.md",
              sourceHash: "a",
              generatedHash: "b",
              sources: [],
              timestamp: "",
            },
          ],
          cursor: [
            {
              path: ".cursorrules",
              sourceHash: "a",
              generatedHash: "b",
              sources: [],
              timestamp: "",
            },
          ],
        },
      }),
      "utf-8",
    );

    await fs.writeFile(path.join(tmpDir, "CLAUDE.md"), "# Generated", "utf-8");
    await fs.writeFile(
      path.join(tmpDir, ".cursorrules"),
      "# Generated",
      "utf-8",
    );
    await fs.mkdir(path.join(tmpDir, ".claude", "rules"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, ".claude", "rules", "test.md"),
      "rule",
      "utf-8",
    );
  }

  it("removes generated files from state", async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.filesDeleted).toContain("CLAUDE.md");
    expect(result.data.filesDeleted).toContain(".cursorrules");

    await expect(fs.access(path.join(tmpDir, "CLAUDE.md"))).rejects.toThrow();
    await expect(
      fs.access(path.join(tmpDir, ".cursorrules")),
    ).rejects.toThrow();
  });

  it("removes agent rule directories", async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.data.dirsDeleted).toContain(".claude/rules");
    await expect(
      fs.access(path.join(tmpDir, ".claude", "rules")),
    ).rejects.toThrow();
  });

  it(`--all removes ${PROJECT_DIR}/ directory`, async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.success).toBe(true);
    expect(result.data.configDirRemoved).toBe(true);
    await expect(fs.access(path.join(tmpDir, PROJECT_DIR))).rejects.toThrow();
  });

  it(`without --all keeps ${PROJECT_DIR}/`, async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.data.configDirRemoved).toBe(false);
    const stat = await fs.stat(path.join(tmpDir, PROJECT_DIR));
    expect(stat.isDirectory()).toBe(true);
  });

  it("dry-run does not delete files", async () => {
    await setupProject();

    const result = await cleanHandler(tmpDir, { json: true, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.filesDeleted.length).toBeGreaterThan(0);

    const stat = await fs.stat(path.join(tmpDir, "CLAUDE.md"));
    expect(stat.isFile()).toBe(true);
  });

  it("handles missing state gracefully", async () => {
    await fs.writeFile(path.join(tmpDir, "CLAUDE.md"), "# Generated", "utf-8");

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.filesDeleted).toContain("CLAUDE.md");
  });
});

describe("clean hook files", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-clean-hooks-`),
    );
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  async function setupWithHooks(
    stateHooks: Array<{ path: string }>,
  ): Promise<void> {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: test\nversion: "1"\n',
      "utf-8",
    );
    await fs.writeFile(
      path.join(configDir, "state.json"),
      JSON.stringify({
        version: "1",
        lastGenerated: new Date().toISOString(),
        agents: {},
        hooks: stateHooks.map((h) => ({
          path: h.path,
          sourceHash: "",
          generatedHash: "",
          sources: ["hooks"],
          timestamp: "",
        })),
      }),
      "utf-8",
    );
  }

  it("preserves hook files on default clean (no --all)", async () => {
    const hookDir = path.join(tmpDir, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(
      path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`),
      "#!/usr/bin/env node",
      "utf-8",
    );

    await setupWithHooks([
      { path: `.git/hooks/${PROJECT_NAME}-secret-scan.mjs` },
    ]);

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.hooksDeleted).toEqual([]);

    // Hook file still exists
    const stat = await fs.stat(
      path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`),
    );
    expect(stat.isFile()).toBe(true);
  });

  it("preserves managed hook section on default clean", async () => {
    const huskyDir = path.join(tmpDir, ".husky");
    await fs.mkdir(huskyDir, { recursive: true });
    await fs.writeFile(
      path.join(huskyDir, "pre-commit"),
      `npm run lint\n# ${PROJECT_NAME_DISPLAY} hooks\nnode .git/hooks/${PROJECT_NAME}-secret-scan.mjs\n\nnpm run other`,
      "utf-8",
    );
    await setupWithHooks([]);

    const result = await cleanHandler(tmpDir, { json: true });
    expect(result.data.hooksDeleted).toEqual([]);

    const content = await fs.readFile(
      path.join(huskyDir, "pre-commit"),
      "utf-8",
    );
    expect(content).toContain(`${PROJECT_NAME_DISPLAY} hooks`);
  });

  it("removes state-tracked hook files with --all", async () => {
    const hookDir = path.join(tmpDir, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(
      path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`),
      "#!/usr/bin/env node",
      "utf-8",
    );

    await setupWithHooks([
      { path: `.git/hooks/${PROJECT_NAME}-secret-scan.mjs` },
    ]);

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.success).toBe(true);
    expect(result.data.hooksDeleted).toContain(
      `.git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
    );
    await expect(
      fs.access(path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`)),
    ).rejects.toThrow();
  });

  it("removes known managed hook scripts as fallback with --all", async () => {
    const hookDir = path.join(tmpDir, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(
      path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`),
      "#!/usr/bin/env node",
      "utf-8",
    );
    await fs.writeFile(
      path.join(hookDir, `${PROJECT_NAME}-file-size-check.mjs`),
      "#!/usr/bin/env node",
      "utf-8",
    );

    await setupWithHooks([]);

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.data.hooksDeleted).toContain(
      `.git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
    );
    expect(result.data.hooksDeleted).toContain(
      `.git/hooks/${PROJECT_NAME}-file-size-check.mjs`,
    );
  });

  it("removes managed section from husky pre-commit with --all", async () => {
    const huskyDir = path.join(tmpDir, ".husky");
    await fs.mkdir(huskyDir, { recursive: true });
    await fs.writeFile(
      path.join(huskyDir, "pre-commit"),
      `npm run lint\n# ${PROJECT_NAME_DISPLAY} hooks\nnode .git/hooks/${PROJECT_NAME}-secret-scan.mjs\n\nnpm run other`,
      "utf-8",
    );
    await setupWithHooks([]);

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.data.hooksDeleted).toContain(".husky/pre-commit");

    const content = await fs.readFile(
      path.join(huskyDir, "pre-commit"),
      "utf-8",
    );
    expect(content).toContain("npm run lint");
    expect(content).toContain("npm run other");
    expect(content).not.toContain(`${PROJECT_NAME_DISPLAY} hooks`);
  });

  it("deletes husky file when only managed content remains with --all", async () => {
    const huskyDir = path.join(tmpDir, ".husky");
    await fs.mkdir(huskyDir, { recursive: true });
    await fs.writeFile(
      path.join(huskyDir, "commit-msg"),
      `# ${PROJECT_NAME_DISPLAY} hooks\nnpx --no -- commitlint --edit \${1}\n`,
      "utf-8",
    );
    await setupWithHooks([]);

    await cleanHandler(tmpDir, { json: true, all: true });
    await expect(
      fs.access(path.join(huskyDir, "commit-msg")),
    ).rejects.toThrow();
  });

  it("removes standalone .git/hooks/pre-commit with managed marker on --all", async () => {
    const hookDir = path.join(tmpDir, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(
      path.join(hookDir, "pre-commit"),
      `#!/bin/sh\n# ${PROJECT_NAME_DISPLAY} hooks\necho test`,
      "utf-8",
    );
    await setupWithHooks([]);

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.data.hooksDeleted).toContain(".git/hooks/pre-commit");
  });

  it("preserves .git/hooks/pre-commit without managed marker even with --all", async () => {
    const hookDir = path.join(tmpDir, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(
      path.join(hookDir, "pre-commit"),
      "#!/bin/sh\necho user hook",
      "utf-8",
    );
    await setupWithHooks([]);

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.data.hooksDeleted).not.toContain(".git/hooks/pre-commit");

    const content = await fs.readFile(
      path.join(hookDir, "pre-commit"),
      "utf-8",
    );
    expect(content).toContain("echo user hook");
  });

  it("respects dry-run flag for hook files with --all", async () => {
    const hookDir = path.join(tmpDir, ".git", "hooks");
    await fs.mkdir(hookDir, { recursive: true });
    await fs.writeFile(
      path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`),
      "#!/usr/bin/env node",
      "utf-8",
    );
    await setupWithHooks([]);

    const result = await cleanHandler(tmpDir, {
      json: true,
      dryRun: true,
      all: true,
    });
    expect(result.data.hooksDeleted).toContain(
      `.git/hooks/${PROJECT_NAME}-secret-scan.mjs`,
    );

    const stat = await fs.stat(
      path.join(hookDir, `${PROJECT_NAME}-secret-scan.mjs`),
    );
    expect(stat.isFile()).toBe(true);
  });

  it("handles missing hook files gracefully with --all", async () => {
    await setupWithHooks([{ path: ".git/hooks/nonexistent.mjs" }]);

    const result = await cleanHandler(tmpDir, { json: true, all: true });
    expect(result.success).toBe(true);
    expect(result.data.hooksDeleted).not.toContain(
      ".git/hooks/nonexistent.mjs",
    );
  });
});
