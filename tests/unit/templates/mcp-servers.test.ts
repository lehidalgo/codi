import { describe, it, expect } from "vitest";
import {
  BUILTIN_MCP_SERVERS,
  AVAILABLE_MCP_SERVER_TEMPLATES,
  MCP_SERVER_GROUPS,
} from "#src/templates/mcp-servers/index.js";

describe("MCP server templates", () => {
  it("AVAILABLE_MCP_SERVER_TEMPLATES matches BUILTIN_MCP_SERVERS keys", () => {
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toEqual(Object.keys(BUILTIN_MCP_SERVERS));
  });

  it("all templates have required name field matching their key", () => {
    for (const [key, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      expect(tmpl.name).toBe(key);
    }
  });

  it("all templates have a description", () => {
    for (const [, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.description.length).toBeGreaterThan(5);
    }
  });

  it("all templates have either command or url", () => {
    for (const [key, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      const hasCommand = !!tmpl.command;
      const hasUrl = !!tmpl.url;
      expect(hasCommand || hasUrl, `Template "${key}" must have command or url`).toBe(true);
    }
  });

  it("stdio templates have args array", () => {
    for (const [key, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      if (tmpl.command) {
        expect(Array.isArray(tmpl.args), `Template "${key}" with command should have args`).toBe(
          true,
        );
      }
    }
  });

  it("http templates have url and no command", () => {
    for (const [key, tmpl] of Object.entries(BUILTIN_MCP_SERVERS)) {
      if (tmpl.type === "http") {
        expect(tmpl.url, `HTTP template "${key}" must have url`).toBeTruthy();
        expect(tmpl.command, `HTTP template "${key}" must not have command`).toBeUndefined();
      }
    }
  });

  it("has expected official servers", () => {
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("github");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("memory");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("sequential-thinking");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("filesystem");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("postgres");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("slack");
  });

  it("has expected vendor servers", () => {
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("playwright");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("stripe");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("neon");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("neon-cloud");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("openai-developer-docs");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("anthropic-docs");
  });

  it("has expected community servers", () => {
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("graph-code");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("chrome-devtools");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("firecrawl");
    expect(AVAILABLE_MCP_SERVER_TEMPLATES).toContain("figma");
  });

  it("neon-cloud uses http transport with Authorization header", () => {
    const tmpl = BUILTIN_MCP_SERVERS["neon-cloud"];
    expect(tmpl?.type).toBe("http");
    expect(tmpl?.url).toBe("https://mcp.neon.tech/mcp");
    expect(tmpl?.headers?.["Authorization"]).toContain("${NEON_API_KEY}");
  });

  it("openai-developer-docs uses http transport", () => {
    const tmpl = BUILTIN_MCP_SERVERS["openai-developer-docs"];
    expect(tmpl?.type).toBe("http");
    expect(tmpl?.url).toBe("https://developers.openai.com/mcp");
  });

  it("graph-code uses uv command with GRAPH_CODE_DIR arg", () => {
    const tmpl = BUILTIN_MCP_SERVERS["graph-code"];
    expect(tmpl?.command).toBe("uv");
    expect(tmpl?.args).toContain("${GRAPH_CODE_DIR}");
    expect(tmpl?.env).toHaveProperty("CYPHER_API_KEY");
  });

  it("all servers appear in exactly one group", () => {
    const allGrouped = Object.values(MCP_SERVER_GROUPS).flat();
    const uniqueGrouped = new Set(allGrouped);
    expect(allGrouped.length).toBe(uniqueGrouped.size);
    for (const name of AVAILABLE_MCP_SERVER_TEMPLATES) {
      expect(uniqueGrouped.has(name), `"${name}" must appear in a group`).toBe(true);
    }
  });

  it("MCP_SERVER_GROUPS covers all builtin servers", () => {
    const allGrouped = new Set(Object.values(MCP_SERVER_GROUPS).flat());
    for (const name of AVAILABLE_MCP_SERVER_TEMPLATES) {
      expect(allGrouped.has(name), `"${name}" is missing from MCP_SERVER_GROUPS`).toBe(true);
    }
  });
});
