import type { FlagDefinition } from "#src/types/flags.js";
import type { BuiltinPresetDefinition } from "./types.js";
import { prefixedName, PROJECT_NAME } from "#src/constants.js";
import { CORE_PLATFORM_RULES, CORE_PLATFORM_SKILLS } from "./core-platform.js";

export const preset: BuiltinPresetDefinition = {
  name: prefixedName("fullstack"),
  description:
    "Comprehensive web/app development — broad rules, testing, and security. Language-agnostic.",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["fullstack", "web", "app", "api"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "cursor", "windsurf", "codex", "cline"],
  },
  flags: {
    auto_commit: { mode: "enabled", value: false },
    test_before_commit: { mode: "enabled", value: true },
    security_scan: { mode: "enforced", value: true },
    type_checking: { mode: "enforced", value: "strict" },
    require_tests: { mode: "enabled", value: true },
    allow_shell_commands: { mode: "enabled", value: true },
    allow_file_deletion: { mode: "enabled", value: true },
    lint_on_save: { mode: "enabled", value: true },
    allow_force_push: { mode: "enabled", value: false },
    require_pr_review: { mode: "enabled", value: true },
    mcp_allowed_servers: { mode: "enabled", value: [] },
    require_documentation: { mode: "enabled", value: false },
    doc_protected_branches: { mode: "enabled", value: ["main", "develop", "release/*"] },
    allowed_languages: { mode: "enabled", value: ["*"] },
    progressive_loading: { mode: "enabled", value: "metadata" },
    drift_detection: { mode: "enabled", value: "warn" },
    auto_generate_on_change: { mode: "enabled", value: false },
  } satisfies Record<string, FlagDefinition>,
  rules: [
    ...CORE_PLATFORM_RULES,
    prefixedName("code-style"),
    prefixedName("testing"),
    prefixedName("architecture"),
    prefixedName("error-handling"),
    prefixedName("api-design"),
    prefixedName("security"),
    prefixedName("performance"),
    prefixedName("git-workflow"),
    prefixedName("output-discipline"),
  ],
  skills: [
    ...CORE_PLATFORM_SKILLS,
    prefixedName("code-review"),
    prefixedName("dev-e2e-testing"),
    prefixedName("refactoring"),
    prefixedName("security-scan"),
    prefixedName("test-suite"),
    prefixedName("commit"),
    prefixedName("debugging"),
  ],
  agents: [
    prefixedName("code-reviewer"),
    prefixedName("test-generator"),
    prefixedName("security-analyzer"),
  ],
  mcpServers: [],
};
