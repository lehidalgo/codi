import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml } from "yaml";
import { createMcpServer } from "#src/core/scaffolder/mcp-scaffolder.js";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";

describe("mcp scaffolder", () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-mcp-`));
    configDir = path.join(tmpDir, PROJECT_DIR);
    await fs.mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a server yaml when no template", async () => {
    const result = await createMcpServer({ name: "my-api", configDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join("mcp-servers", "my-api.yaml"));
    const content = await fs.readFile(result.data, "utf-8");
    const parsed = parseYaml(content) as Record<string, unknown>;
    expect(parsed["name"]).toBe("my-api");
    expect(parsed["managed_by"]).toBe("user");
    expect(parsed["command"]).toBe("");
  });

  it("creates a server yaml from template", async () => {
    const result = await createMcpServer({
      name: "github",
      configDir,
      template: "github",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join("mcp-servers", "github.yaml"));
    const content = await fs.readFile(result.data, "utf-8");
    const parsed = parseYaml(content) as Record<string, unknown>;
    expect(parsed["name"]).toBe("github");
    expect(parsed["managed_by"]).toBe(PROJECT_NAME);
    expect(parsed["command"]).toBe("npx");
    expect(parsed["args"]).toContain("@modelcontextprotocol/server-github");
    expect(parsed["env"]).toHaveProperty("GITHUB_TOKEN");
  });

  it("rejects duplicate server names", async () => {
    await createMcpServer({ name: "test-server", configDir });
    const result = await createMcpServer({ name: "test-server", configDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toContain("already exists");
  });

  it("rejects invalid server names", async () => {
    const result = await createMcpServer({ name: "Invalid_Name", configDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toContain("Invalid MCP server name");
  });

  it("rejects unknown template names", async () => {
    const result = await createMcpServer({
      name: "test",
      configDir,
      template: "nonexistent-template",
    });

    expect(result.ok).toBe(false);
  });

  it("creates server with env vars from template", async () => {
    const result = await createMcpServer({
      name: "postgres",
      configDir,
      template: "postgres",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    const parsed = parseYaml(content) as Record<string, unknown>;
    expect(parsed["env"]).toHaveProperty("POSTGRES_CONNECTION_STRING");
  });
});
