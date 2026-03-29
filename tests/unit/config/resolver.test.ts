import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveConfig } from "#src/core/config/resolver.js";

const FIXTURES = path.resolve(__dirname, "../../fixtures/inheritance");

describe("resolveConfig", () => {
  it("resolves basic-merge fixture with layer composition", async () => {
    const projectRoot = path.join(FIXTURES, "basic-merge/input");
    const result = await resolveConfig(projectRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.manifest.name).toBe("test-project");
    expect(result.data.manifest.agents).toEqual(["claude-code", "cursor"]);

    expect(result.data.rules).toHaveLength(1);
    expect(result.data.rules[0]!.name).toBe("security");

    // Lang layer overrides repo flag
    expect(result.data.flags["max_file_lines"]!.value).toBe(500);
    // Lang layer adds new flag
    expect(result.data.flags["type_checking"]!.value).toBe("strict");
    expect(result.data.flags["type_checking"]!.mode).toBe("enforced");
    // Repo flag preserved
    expect(result.data.flags["security_scan"]!.value).toBe(true);
  });

  it("returns error for locked-override fixture", async () => {
    const projectRoot = path.join(FIXTURES, "locked-override/input");
    const result = await resolveConfig(projectRoot);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const lockedError = result.errors.find((e) => e.code === "E_FLAG_LOCKED");
    expect(lockedError).toBeDefined();
  });

  it("returns error for nonexistent project", async () => {
    const result = await resolveConfig("/nonexistent/project");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.code).toBe("E_CONFIG_NOT_FOUND");
  });
});

describe("resolveConfig — dynamic projects", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-resolver-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("resolves minimal project with only manifest", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      'name: minimal\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.manifest.name).toBe("minimal");
    expect(result.data.rules).toEqual([]);
    expect(result.data.skills).toEqual([]);
    expect(result.data.flags).toEqual({});
  });

  it("resolves project with rules and flags", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      'name: with-rules\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    // Add flags
    await fs.writeFile(
      path.join(codiDir, "flags.yaml"),
      "security_scan:\n  mode: enabled\n  value: true\n",
      "utf-8",
    );

    // Add rule
    const rulesDir = path.join(codiDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "security.md"),
      "---\nname: security\ndescription: Security rules\npriority: high\nmanaged_by: codi\n---\nSecurity content.",
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rules.length).toBe(1);
    expect(result.data.rules[0]!.name).toBe("security");
    expect(result.data.flags["security_scan"]).toBeDefined();
    expect(result.data.flags["security_scan"]!.value).toBe(true);
  });

  it("resolves project with MCP servers", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      'name: mcp-proj\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    const mcpDir = path.join(codiDir, "mcp-servers");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "test-server.yaml"),
      "name: test-server\ncommand: npx\nargs:\n  - test-mcp\n",
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mcp.servers["test-server"]).toBeDefined();
  });

  it("resolves project with lang layer override", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      'name: lang-test\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    // Add base flags
    await fs.writeFile(
      path.join(codiDir, "flags.yaml"),
      "max_file_lines:\n  mode: enabled\n  value: 700\n",
      "utf-8",
    );

    // Add lang layer that overrides
    const langDir = path.join(codiDir, "lang");
    await fs.mkdir(langDir, { recursive: true });
    await fs.writeFile(
      path.join(langDir, "typescript.yaml"),
      "flags:\n  max_file_lines:\n    mode: enabled\n    value: 500\n",
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Lang layer overrides repo layer
    expect(result.data.flags["max_file_lines"]!.value).toBe(500);
  });

  it("resolves project with agents and commands", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      'name: full-proj\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    // Add agent
    const agentArtifactsDir = path.join(codiDir, "agents");
    await fs.mkdir(agentArtifactsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentArtifactsDir, "reviewer.md"),
      "---\nname: reviewer\ndescription: Code reviewer\ntools:\n  - Read\n  - Grep\nmanaged_by: codi\n---\nReview code.",
      "utf-8",
    );

    // Add command
    const commandsDir = path.join(codiDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(
      path.join(commandsDir, "commit.md"),
      "---\nname: commit\ndescription: Commit changes\n---\nCommit content.",
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.agents.length).toBe(1);
    expect(result.data.agents[0]!.name).toBe("reviewer");
    expect(result.data.commands.length).toBe(1);
    expect(result.data.commands[0]!.name).toBe("commit");
  });

  it("returns error for invalid manifest schema", async () => {
    const codiDir = path.join(tmpDir, ".codi");
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, "codi.yaml"),
      "invalid_field: true\n",
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(false);
  });
});
