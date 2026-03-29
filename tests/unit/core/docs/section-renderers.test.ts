import { describe, it, expect } from "vitest";
import type { FlagSpec } from "../../../../src/types/flags.js";
import type { BuiltinPresetDefinition } from "../../../../src/templates/presets/types.js";
import type { AgentAdapter } from "../../../../src/types/agent.js";
import type { HubAction } from "../../../../src/cli/hub.js";
import type { McpServerTemplate } from "../../../../src/templates/mcp-servers/index.js";
import {
  renderFlagsTable,
  renderFlagModes,
  renderTemplateCounts,
  renderTemplateCountsCompact,
  renderPresetTable,
  renderPresetFlagComparison,
  renderAdapterTable,
  renderErrorCatalog,
  renderHubActions,
  renderMcpServers,
  renderCliReference,
} from "../../../../src/core/docs/section-renderers.js";

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const MOCK_FLAGS: Record<string, FlagSpec> = {
  auto_commit: {
    type: "boolean",
    default: false,
    description: "Auto-commit changes",
  },
  max_file_lines: {
    type: "number",
    default: 700,
    description: "Max lines per file",
    hook: "file-size-check",
  },
};

const MOCK_PRESETS: Record<string, BuiltinPresetDefinition> = {
  minimal: {
    description: "Permissive",
    tags: ["minimal"],
    flags: {
      auto_commit: { mode: "enabled", value: false },
    },
  },
  balanced: {
    description: "Recommended",
    tags: ["balanced"],
    flags: {
      auto_commit: { mode: "enabled", value: false },
    },
  },
  strict: {
    description: "Enforced",
    tags: ["strict"],
    flags: {
      auto_commit: { mode: "enforced", value: false, locked: true },
    },
  },
};

const MOCK_ADAPTERS: AgentAdapter[] = [
  {
    id: "test-agent",
    name: "Test Agent",
    paths: {
      configRoot: ".",
      rules: ".test/rules",
      skills: null,
      commands: null,
      agents: null,
      instructionFile: "TEST.md",
      mcpConfig: null,
    },
    capabilities: {
      rules: true,
      skills: true,
      agents: false,
      commands: false,
      mcp: true,
      frontmatter: true,
    },
    detect: () => false,
    generate: () => Promise.resolve([]),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("section-renderers", () => {
  describe("renderFlagsTable", () => {
    it("produces a valid Markdown table with header and rows", () => {
      const result = renderFlagsTable(MOCK_FLAGS);
      const lines = result.split("\n");

      expect(lines[0]).toContain("| Flag |");
      expect(lines[1]).toMatch(/^\|[-|]+\|$/);
      expect(lines).toHaveLength(4); // header + separator + 2 rows
    });

    it("includes flag names, types, and defaults", () => {
      const result = renderFlagsTable(MOCK_FLAGS);

      expect(result).toContain("`auto_commit`");
      expect(result).toContain("boolean");
      expect(result).toContain("`false`");
      expect(result).toContain("`700`");
    });

    it("shows hook when present, dash when absent", () => {
      const result = renderFlagsTable(MOCK_FLAGS);

      expect(result).toContain("file-size-check");
      expect(result).toContain("—");
    });
  });

  describe("renderFlagModes", () => {
    it("lists all 6 modes", () => {
      const result = renderFlagModes();

      expect(result).toContain("`enforced`");
      expect(result).toContain("`enabled`");
      expect(result).toContain("`disabled`");
      expect(result).toContain("`inherited`");
      expect(result).toContain("`delegated_to_agent_default`");
      expect(result).toContain("`conditional`");
    });

    it("produces a valid table", () => {
      const lines = renderFlagModes().split("\n");

      expect(lines[0]).toContain("| Mode |");
      expect(lines[1]).toMatch(/^\|[-|]+\|$/);
      expect(lines).toHaveLength(8); // header + separator + 6 rows
    });
  });

  describe("renderTemplateCounts", () => {
    const counts = {
      rules: 3,
      ruleNames: ["a", "b", "c"],
      skills: 2,
      skillNames: ["x", "y"],
      agents: 1,
      agentNames: ["z"],
      commands: 0,
      commandNames: [],
    };

    it("shows correct counts", () => {
      const result = renderTemplateCounts(counts);

      expect(result).toContain("| **Rules** | 3 |");
      expect(result).toContain("| **Skills** | 2 |");
      expect(result).toContain("| **Agents** | 1 |");
      expect(result).toContain("| **Commands** | 0 |");
    });

    it("includes template names", () => {
      const result = renderTemplateCounts(counts);

      expect(result).toContain("a, b, c");
      expect(result).toContain("x, y");
    });
  });

  describe("renderTemplateCountsCompact", () => {
    it("omits names column", () => {
      const counts = {
        rules: 5,
        ruleNames: [],
        skills: 3,
        skillNames: [],
        agents: 2,
        agentNames: [],
        commands: 1,
        commandNames: [],
      };
      const result = renderTemplateCountsCompact(counts);
      const lines = result.split("\n");

      expect(lines[0]).not.toContain("Names");
      expect(result).toContain("| **Rules** | 5 |");
    });
  });

  describe("renderPresetTable", () => {
    it("includes all presets", () => {
      const result = renderPresetTable(MOCK_PRESETS);

      expect(result).toContain("`minimal`");
      expect(result).toContain("`balanced`");
      expect(result).toContain("`strict`");
    });

    it("shows focus tag and description", () => {
      const result = renderPresetTable(MOCK_PRESETS);

      expect(result).toContain("| minimal | Permissive |");
      expect(result).toContain("| balanced | Recommended |");
    });
  });

  describe("renderPresetFlagComparison", () => {
    it("compares minimal, balanced, strict columns", () => {
      const result = renderPresetFlagComparison(MOCK_PRESETS, MOCK_FLAGS);

      expect(result).toContain("Minimal");
      expect(result).toContain("Balanced");
      expect(result).toContain("Strict");
    });

    it("marks enforced+locked flags", () => {
      const result = renderPresetFlagComparison(MOCK_PRESETS, MOCK_FLAGS);

      expect(result).toContain("(enforced, locked)");
    });

    it("returns empty string when no core presets exist", () => {
      const noCore: Record<string, BuiltinPresetDefinition> = {
        custom: MOCK_PRESETS.minimal,
      };
      const result = renderPresetFlagComparison(noCore, MOCK_FLAGS);

      expect(result).toBe("");
    });
  });

  describe("renderAdapterTable", () => {
    it("shows adapter capabilities correctly", () => {
      const result = renderAdapterTable(MOCK_ADAPTERS);

      expect(result).toContain("**Test Agent**");
      expect(result).toContain("`TEST.md`");
      expect(result).toContain("| Yes | Yes | — | Yes |");
    });
  });

  describe("renderErrorCatalog", () => {
    it("renders error codes with severity and exit code", () => {
      const catalog = {
        E_CONFIG_INVALID: {
          exitCode: 1,
          severity: "error",
          hintTemplate: "Check {file} for errors",
        },
      };
      const result = renderErrorCatalog(catalog);

      expect(result).toContain("`E_CONFIG_INVALID`");
      expect(result).toContain("error");
      expect(result).toContain("1");
    });

    it("truncates long hints and replaces placeholders", () => {
      const catalog = {
        E_LONG: {
          exitCode: 2,
          severity: "warning",
          hintTemplate:
            "This is a {very} long hint with {placeholders} " +
            "that should be truncated after eighty characters to keep the table readable",
        },
      };
      const result = renderErrorCatalog(catalog);

      expect(result).toContain("...");
      expect(result).not.toContain("{very}");
    });
  });

  describe("renderHubActions", () => {
    it("renders action rows", () => {
      const actions: HubAction[] = [
        {
          label: "Generate",
          hint: "Build configs",
          group: "build",
          value: "generate",
        },
      ];
      const result = renderHubActions(actions);

      expect(result).toContain("| Generate | Build configs | `build` |");
    });
  });

  describe("renderMcpServers", () => {
    it("renders stdio servers with command", () => {
      const servers: Record<string, McpServerTemplate> = {
        github: {
          description: "GitHub MCP",
          type: "stdio",
          command: "npx",
          args: ["-y", "@anthropic-ai/mcp-server-github"],
        },
      };
      const result = renderMcpServers(servers);

      expect(result).toContain("`github`");
      expect(result).toContain("GitHub MCP");
      expect(result).toContain("`npx -y @anthropic-ai/mcp-server-github`");
    });
  });

  describe("renderCliReference", () => {
    it("renders command table", () => {
      const cmds = [
        { name: "init", description: "Initialize config", options: "--force" },
        { name: "generate", description: "Generate files" },
      ];
      const result = renderCliReference(cmds);

      expect(result).toContain("`codi init`");
      expect(result).toContain("--force");
      expect(result).toContain("`codi generate`");
    });
  });

  describe("all renderers produce valid Markdown tables", () => {
    it("every row has consistent pipe count", () => {
      const tables = [
        renderFlagsTable(MOCK_FLAGS),
        renderFlagModes(),
        renderAdapterTable(MOCK_ADAPTERS),
      ];

      for (const table of tables) {
        const lines = table.split("\n");
        const headerPipes = (lines[0].match(/\|/g) ?? []).length;
        for (const line of lines) {
          expect((line.match(/\|/g) ?? []).length).toBe(headerPipes);
        }
      }
    });
  });
});
