import { PROJECT_NAME, prefixedName } from "#src/constants.js";
import { CORE_PLATFORM_RULES, CORE_PLATFORM_SKILLS } from "./core-platform.js";
import type { BuiltinPresetDefinition } from "./types.js";

export const preset: BuiltinPresetDefinition = {
  name: prefixedName("strict"),
  description: "Enforced — security locked, tests required, delete restricted, no force-push",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["strict", "enforced", "security", "enterprise", "compliance"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "cursor", "windsurf", "codex", "cline", "copilot"],
  },
  flags: {
    auto_commit: { mode: "enabled", value: false },
    test_before_commit: { mode: "enforced", value: true, locked: true },
    security_scan: { mode: "enforced", value: true, locked: true },
    type_checking: { mode: "enforced", value: "strict", locked: true },
    require_tests: { mode: "enforced", value: true, locked: true },
    allow_shell_commands: { mode: "enforced", value: true, locked: true },
    allow_file_deletion: { mode: "enforced", value: false, locked: true },
    lint_on_save: { mode: "enabled", value: true },
    allow_force_push: { mode: "enforced", value: false, locked: true },
    require_pr_review: { mode: "enforced", value: true, locked: true },
    mcp_allowed_servers: { mode: "enabled", value: [] },
    require_documentation: { mode: "enabled", value: true },
    doc_protected_branches: { mode: "enabled", value: ["main", "develop", "release/*"] },
    allowed_languages: { mode: "enabled", value: ["*"] },
    progressive_loading: { mode: "enabled", value: "metadata" },
    drift_detection: { mode: "enabled", value: "error" },
    auto_generate_on_change: { mode: "enabled", value: true },
  },
  rules: [
    ...CORE_PLATFORM_RULES,
    prefixedName("code-style"),
    prefixedName("testing"),
    prefixedName("error-handling"),
    prefixedName("security"),
    prefixedName("git-workflow"),
    prefixedName("api-design"),
    prefixedName("documentation"),
    prefixedName("output-discipline"),
  ],
  skills: [
    ...CORE_PLATFORM_SKILLS,
    prefixedName("code-review"),
    prefixedName("security-scan"),
    prefixedName("commit"),
    prefixedName("test-suite"),
    prefixedName("project-documentation"),
  ],
  agents: [
    prefixedName("code-reviewer"),
    prefixedName("security-analyzer"),
    prefixedName("test-generator"),
  ],
  mcpServers: [],
};
