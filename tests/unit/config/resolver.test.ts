import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../helpers/fs.js";
import { resolveConfig } from "#src/core/config/resolver.js";
import { PROJECT_NAME, PROJECT_DIR, MANIFEST_FILENAME } from "#src/constants.js";

const FIXTURES = path.resolve(__dirname, "../../fixtures/inheritance");

describe("resolveConfig", () => {
  it("resolves basic-merge fixture from .codi/ as single source", async () => {
    const projectRoot = path.join(FIXTURES, "basic-merge/input");
    const result = await resolveConfig(projectRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.manifest.name).toBe("test-project");
    expect(result.data.manifest.agents).toEqual(["claude-code", "cursor"]);

    expect(result.data.rules).toHaveLength(1);
    expect(result.data.rules[0]!.name).toBe("security");

    // Flags come directly from flags.yaml (no layer merging)
    expect(result.data.flags["require_tests"]!.value).toBe(false);
    expect(result.data.flags["security_scan"]!.value).toBe(true);
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
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-resolver-`));
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("resolves minimal project with only manifest", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
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
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: with-rules\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    // Add flags
    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      "security_scan:\n  mode: enabled\n  value: true\n",
      "utf-8",
    );

    // Add rule
    const rulesDir = path.join(configDir, "rules");
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, "security.md"),
      `---\nname: security\ndescription: Security rules\npriority: high\nmanaged_by: ${PROJECT_NAME}\n---\nSecurity content.`,
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
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: mcp-proj\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    const mcpDir = path.join(configDir, "mcp-servers");
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

  it("reads flags directly from flags.yaml without layer overrides", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, MANIFEST_FILENAME),
      'name: flag-test\nversion: "1"\nagents:\n  - claude-code\n',
      "utf-8",
    );

    await fs.writeFile(
      path.join(configDir, "flags.yaml"),
      "type_checking:\n  mode: enabled\n  value: basic\n",
      "utf-8",
    );

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.flags["type_checking"]!.value).toBe("basic");
  });

  it("returns error for invalid manifest schema", async () => {
    const configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), "invalid_field: true\n", "utf-8");

    const result = await resolveConfig(tmpDir);
    expect(result.ok).toBe(false);
  });
});
