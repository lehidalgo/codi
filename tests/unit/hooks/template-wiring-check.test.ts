import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { PROJECT_NAME } from "#src/constants.js";
import { TEMPLATE_WIRING_CHECK_TEMPLATE } from "#src/core/hooks/hook-templates.js";
import { buildTemplateWiringScript } from "#src/core/hooks/hook-installer.js";

let tmpDir: string;
let scriptPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-wiring-check-`));
  scriptPath = path.join(tmpDir, "wiring-check.mjs");
  await fs.writeFile(scriptPath, TEMPLATE_WIRING_CHECK_TEMPLATE, {
    mode: 0o755,
  });
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

/** Run the wiring check script from a given working directory. */
function runScript(cwd: string): { ok: boolean; stderr: string } {
  try {
    execFileSync("node", [scriptPath], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, stderr: "" };
  } catch (e) {
    const err = e as { stderr?: string; status?: number };
    return { ok: false, stderr: err.stderr ?? "" };
  }
}

/** Create a minimal aligned artifact structure (rules-style: flat .ts files). */
async function createAlignedRulesFixture(root: string): Promise<void> {
  const templateDir = path.join(root, "src/templates/rules");
  const loaderDir = path.join(root, "src/core/scaffolder");
  await fs.mkdir(templateDir, { recursive: true });
  await fs.mkdir(loaderDir, { recursive: true });

  // Template file
  await fs.writeFile(path.join(templateDir, "security.ts"), 'export const template = "rule";');

  // Index file with export
  await fs.writeFile(
    path.join(templateDir, "index.ts"),
    'export { template as security } from "./security.js";',
  );

  // Loader with TEMPLATE_MAP entry
  await fs.writeFile(
    path.join(loaderDir, "template-loader.ts"),
    `import { prefixedName } from "#src/constants.js";
const TEMPLATE_MAP = {
  [prefixedName("security")]: ruleTemplates.security,
};`,
  );
}

/** Create a minimal aligned skills-style fixture (directory-based). */
async function createAlignedSkillsFixture(root: string): Promise<void> {
  const templateDir = path.join(root, "src/templates/skills");
  const loaderDir = path.join(root, "src/core/scaffolder");
  await fs.mkdir(path.join(templateDir, "mcp-ops"), { recursive: true });
  await fs.mkdir(loaderDir, { recursive: true });

  // Skill directory with index
  await fs.writeFile(
    path.join(templateDir, "mcp-ops/index.ts"),
    'export const template = "skill";',
  );

  // Utility files that should be excluded
  await fs.writeFile(path.join(templateDir, "types.ts"), "export type T = {};");
  await fs.writeFile(path.join(templateDir, "resolve-static-dir.ts"), "export function f() {}");

  // Index file
  await fs.writeFile(
    path.join(templateDir, "index.ts"),
    'export { template as mcpOps } from "./mcp-ops/index.js";',
  );

  // Loader
  await fs.writeFile(
    path.join(loaderDir, "skill-template-loader.ts"),
    `import { prefixedName } from "#src/constants.js";
const TEMPLATE_MAP = {
  [prefixedName("mcp-ops")]: skillTemplates.mcpOps,
};`,
  );
}

describe("template wiring check script", () => {
  it("buildTemplateWiringScript returns the template content", () => {
    const result = buildTemplateWiringScript();
    expect(result).toBe(TEMPLATE_WIRING_CHECK_TEMPLATE);
  });

  it("passes when all artifacts are properly wired", async () => {
    const root = path.join(tmpDir, "aligned");
    await createAlignedRulesFixture(root);
    // Create empty dirs for other artifact types so the script doesn't fail
    for (const dir of [
      "src/templates/skills",
      "src/templates/agents",
      "src/templates/commands",
      "src/core/scaffolder",
    ]) {
      await fs.mkdir(path.join(root, dir), { recursive: true });
    }
    // Create minimal index and loader files for skills, agents, commands
    for (const [indexPath, loaderPath] of [
      ["src/templates/skills/index.ts", "src/core/scaffolder/skill-template-loader.ts"],
      ["src/templates/agents/index.ts", "src/core/scaffolder/agent-template-loader.ts"],
      ["src/templates/commands/index.ts", "src/core/scaffolder/command-template-loader.ts"],
    ]) {
      // Only write if not already present
      try {
        await fs.access(path.join(root, indexPath));
      } catch {
        await fs.writeFile(path.join(root, indexPath), "");
      }
      try {
        await fs.access(path.join(root, loaderPath));
      } catch {
        await fs.writeFile(path.join(root, loaderPath), "");
      }
    }

    const result = runScript(root);
    expect(result.ok).toBe(true);
  });

  it("detects file on disk but missing from index.ts", async () => {
    const root = path.join(tmpDir, "missing-index");
    await createAlignedRulesFixture(root);

    // Add an unwired rule file
    await fs.writeFile(
      path.join(root, "src/templates/rules/testing.ts"),
      'export const template = "rule";',
    );

    // Create empty stubs for other types
    for (const [indexPath, loaderPath] of [
      ["src/templates/skills/index.ts", "src/core/scaffolder/skill-template-loader.ts"],
      ["src/templates/agents/index.ts", "src/core/scaffolder/agent-template-loader.ts"],
      ["src/templates/commands/index.ts", "src/core/scaffolder/command-template-loader.ts"],
    ]) {
      await fs.mkdir(path.join(root, path.dirname(indexPath)), {
        recursive: true,
      });
      await fs.mkdir(path.join(root, path.dirname(loaderPath)), {
        recursive: true,
      });
      try {
        await fs.access(path.join(root, indexPath));
      } catch {
        await fs.writeFile(path.join(root, indexPath), "");
      }
      try {
        await fs.access(path.join(root, loaderPath));
      } catch {
        await fs.writeFile(path.join(root, loaderPath), "");
      }
    }

    const result = runScript(root);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("testing");
    expect(result.stderr).toContain("NOT exported");
  });

  it("detects export in index.ts but missing from loader TEMPLATE_MAP", async () => {
    const root = path.join(tmpDir, "missing-loader");
    const templateDir = path.join(root, "src/templates/rules");
    const loaderDir = path.join(root, "src/core/scaffolder");
    await fs.mkdir(templateDir, { recursive: true });
    await fs.mkdir(loaderDir, { recursive: true });

    // File on disk
    await fs.writeFile(path.join(templateDir, "security.ts"), 'export const template = "rule";');
    // Exported in index
    await fs.writeFile(
      path.join(templateDir, "index.ts"),
      'export { template as security } from "./security.js";',
    );
    // Empty loader — no TEMPLATE_MAP entry
    await fs.writeFile(path.join(loaderDir, "template-loader.ts"), "");

    // Empty stubs for other types
    for (const [indexPath, loaderPath] of [
      ["src/templates/skills/index.ts", "src/core/scaffolder/skill-template-loader.ts"],
      ["src/templates/agents/index.ts", "src/core/scaffolder/agent-template-loader.ts"],
      ["src/templates/commands/index.ts", "src/core/scaffolder/command-template-loader.ts"],
    ]) {
      await fs.mkdir(path.join(root, path.dirname(indexPath)), {
        recursive: true,
      });
      await fs.mkdir(path.join(root, path.dirname(loaderPath)), {
        recursive: true,
      });
      try {
        await fs.access(path.join(root, indexPath));
      } catch {
        await fs.writeFile(path.join(root, indexPath), "");
      }
      try {
        await fs.access(path.join(root, loaderPath));
      } catch {
        await fs.writeFile(path.join(root, loaderPath), "");
      }
    }

    const result = runScript(root);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("security");
    expect(result.stderr).toContain("NOT in");
    expect(result.stderr).toContain("TEMPLATE_MAP");
  });

  it("allows deprecated directories without errors", async () => {
    const root = path.join(tmpDir, "deprecated");

    // Set up skills with a deprecated dir
    const templateDir = path.join(root, "src/templates/skills");
    const loaderDir = path.join(root, "src/core/scaffolder");
    await fs.mkdir(path.join(templateDir, "presentation"), { recursive: true });
    await fs.mkdir(loaderDir, { recursive: true });

    await fs.writeFile(
      path.join(templateDir, "presentation/index.ts"),
      'export const template = "deprecated";',
    );
    // Index does NOT export presentation (commented out)
    await fs.writeFile(
      path.join(templateDir, "index.ts"),
      "// deprecated\n// export from presentation",
    );
    // Loader does NOT have presentation
    await fs.writeFile(path.join(loaderDir, "skill-template-loader.ts"), "");

    // Empty stubs for other types
    for (const [indexPath, loaderPath] of [
      ["src/templates/rules/index.ts", "src/core/scaffolder/template-loader.ts"],
      ["src/templates/agents/index.ts", "src/core/scaffolder/agent-template-loader.ts"],
      ["src/templates/commands/index.ts", "src/core/scaffolder/command-template-loader.ts"],
    ]) {
      await fs.mkdir(path.join(root, path.dirname(indexPath)), {
        recursive: true,
      });
      await fs.mkdir(path.join(root, path.dirname(loaderPath)), {
        recursive: true,
      });
      try {
        await fs.access(path.join(root, indexPath));
      } catch {
        await fs.writeFile(path.join(root, indexPath), "");
      }
      try {
        await fs.access(path.join(root, loaderPath));
      } catch {
        await fs.writeFile(path.join(root, loaderPath), "");
      }
    }

    const result = runScript(root);
    expect(result.ok).toBe(true);
  });

  it("excludes utility files (types.ts, resolve-static-dir.ts) from skills check", async () => {
    const root = path.join(tmpDir, "exclude-utils");
    await createAlignedSkillsFixture(root);

    // Create empty stubs for other types
    for (const [indexPath, loaderPath] of [
      ["src/templates/rules/index.ts", "src/core/scaffolder/template-loader.ts"],
      ["src/templates/agents/index.ts", "src/core/scaffolder/agent-template-loader.ts"],
      ["src/templates/commands/index.ts", "src/core/scaffolder/command-template-loader.ts"],
    ]) {
      await fs.mkdir(path.join(root, path.dirname(indexPath)), {
        recursive: true,
      });
      await fs.mkdir(path.join(root, path.dirname(loaderPath)), {
        recursive: true,
      });
      try {
        await fs.access(path.join(root, indexPath));
      } catch {
        await fs.writeFile(path.join(root, indexPath), "");
      }
      try {
        await fs.access(path.join(root, loaderPath));
      } catch {
        await fs.writeFile(path.join(root, loaderPath), "");
      }
    }

    const result = runScript(root);
    expect(result.ok).toBe(true);
  });

  it("passes against the real codebase", () => {
    const projectRoot = path.resolve(import.meta.dirname, "..", "..", "..");
    const result = runScript(projectRoot);
    expect(result.ok).toBe(true);
  });
});
