import type { NormalizedConfig } from "../../../src/types/config.js";

export function createMockConfig(
  overrides?: Partial<NormalizedConfig>,
): NormalizedConfig {
  return {
    manifest: {
      name: "test-project",
      version: "1",
      agents: ["claude-code", "cursor"],
    },
    rules: [
      {
        name: "Code Style",
        description: "Enforce consistent code style",
        content: "Use 2-space indentation and single quotes.",
        priority: "high",
        alwaysApply: true,
        managedBy: "codi",
      },
      {
        name: "Testing",
        description: "Testing requirements",
        content: "Write unit tests for all functions.",
        priority: "medium",
        scope: ["**/*.test.ts"],
        alwaysApply: false,
        managedBy: "codi",
      },
    ],
    skills: [],
    commands: [],
    agents: [],
    brands: [],
    context: [],
    flags: {
      allow_shell_commands: {
        value: false,
        mode: "enforced",
        source: "codi.yaml",
        locked: false,
      },
      allow_file_deletion: {
        value: false,
        mode: "enforced",
        source: "codi.yaml",
        locked: false,
      },
      max_file_lines: {
        value: 500,
        mode: "enforced",
        source: "codi.yaml",
        locked: false,
      },
      require_tests: {
        value: true,
        mode: "enforced",
        source: "codi.yaml",
        locked: false,
      },
    },
    mcp: { servers: {} },
    ...overrides,
  };
}
