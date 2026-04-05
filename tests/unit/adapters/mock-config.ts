import type { NormalizedConfig } from "#src/types/config.js";
import { PROJECT_NAME, MANIFEST_FILENAME } from "#src/constants.js";

export function createMockConfig(overrides?: Partial<NormalizedConfig>): NormalizedConfig {
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
        managedBy: PROJECT_NAME,
      },
      {
        name: "Testing",
        description: "Testing requirements",
        content: "Write unit tests for all functions.",
        priority: "medium",
        scope: ["**/*.test.ts"],
        alwaysApply: false,
        managedBy: PROJECT_NAME,
      },
    ],
    skills: [],
    agents: [],
    context: [],
    flags: {
      allow_shell_commands: {
        value: false,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
      allow_file_deletion: {
        value: false,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
      require_tests: {
        value: true,
        mode: "enforced",
        source: MANIFEST_FILENAME,
        locked: false,
      },
    },
    mcp: { servers: {} },
    ...overrides,
  };
}
