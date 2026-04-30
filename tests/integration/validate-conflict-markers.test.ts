import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { validateHandler } from "#src/cli/validate.js";
import { Logger } from "#src/core/output/logger.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

describe("codi validate — conflict markers", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-validate-cm-`));
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmp);
  });

  async function writeMinimalProject(skillContent: string): Promise<void> {
    const cfg = path.join(tmp, PROJECT_DIR);
    await fs.mkdir(cfg, { recursive: true });
    await fs.writeFile(
      path.join(cfg, MANIFEST_FILENAME),
      `name: test\nversion: "1"\nagents: [claude-code]\n`,
    );
    const skillDir = path.join(cfg, "skills", "demo");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: demo\ndescription: test skill\n---\n${skillContent}\n`,
    );
  }

  it("fails with CONFIG_INVALID when a skill SKILL.md contains merge markers", async () => {
    await writeMinimalProject("<<<<<<< HEAD\nold\n=======\nnew\n>>>>>>> branch\n");

    const result = await validateHandler(tmp);

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
    expect(result.data.errors.some((e) => e.code === "E_CONFLICT_MARKERS")).toBe(true);
  });

  it("does not flag E_CONFLICT_MARKERS when artifacts are clean", async () => {
    await writeMinimalProject("# Demo skill\n\nClean body content.\n");

    const result = await validateHandler(tmp);

    expect(result.data.errors.find((e) => e.code === "E_CONFLICT_MARKERS")).toBeUndefined();
  });

  it("does not flag markers inside fenced code blocks (regression for codi-dev-operations)", async () => {
    // The codi-dev-operations skill teaches manual conflict resolution by
    // showing what unresolved markers look like inside a markdown code
    // fence. The validator must treat that documentation as illustrative,
    // not as a real unresolved conflict.
    await writeMinimalProject(
      [
        "# Demo skill",
        "",
        "Write the file with git-style conflict markers:",
        "```",
        "<<<<<<< current (your version)",
        "[currentContent]",
        "=======",
        "[incomingContent]",
        ">>>>>>> incoming (new template)",
        "```",
        "",
        "End of example.",
      ].join("\n"),
    );

    const result = await validateHandler(tmp);

    expect(result.data.errors.find((e) => e.code === "E_CONFLICT_MARKERS")).toBeUndefined();
  });

  it("does not flag markers inside <example> tag regions", async () => {
    await writeMinimalProject(
      [
        "# Demo skill",
        "",
        "<example>",
        "<<<<<<< HEAD",
        "demo content showing what an unresolved conflict looks like",
        ">>>>>>> branch-x",
        "</example>",
      ].join("\n"),
    );

    const result = await validateHandler(tmp);

    expect(result.data.errors.find((e) => e.code === "E_CONFLICT_MARKERS")).toBeUndefined();
  });

  it("still fails when a real marker appears outside fences and example tags", async () => {
    await writeMinimalProject(
      [
        "# Demo skill",
        "",
        "<<<<<<< HEAD",
        "this is a real unresolved conflict in the body",
        ">>>>>>> branch",
        "",
        "And here is a fenced documentation example that should be ignored:",
        "```",
        "<<<<<<< example marker shown to the agent",
        "```",
      ].join("\n"),
    );

    const result = await validateHandler(tmp);

    expect(result.success).toBe(false);
    expect(result.data.errors.some((e) => e.code === "E_CONFLICT_MARKERS")).toBe(true);
  });
});
