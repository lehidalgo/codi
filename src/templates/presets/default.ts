import { PROJECT_NAME, prefixedName } from "#src/constants.js";
import { CORE_PLATFORM_RULES, CORE_PLATFORM_SKILLS } from "./core-platform.js";
import type { BuiltinPresetDefinition } from "./types.js";

/**
 * Sole canonical preset shipped by codi after ADR-013.
 *
 * Content = capellai parity (40 skills + 25 rules + 2 agents + 5 commands
 * + lifecycle hooks + scripts/hooks/*.sh + extended settings.json + _index.md
 * + CLAUDE.md base). Built up through later Pasos of the codi-default-parity
 * import; this file ships skeleton structure first.
 */
export const preset: BuiltinPresetDefinition = {
  name: prefixedName("default"),
  description: "codi-default — canonical install (capellai parity)",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["default", "canonical"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "codex", "cursor", "windsurf", "cline", "copilot"],
  },
  flags: {
    auto_commit: { mode: "enabled", value: false },
    test_before_commit: { mode: "enabled", value: true },
    security_scan: { mode: "enabled", value: true },
    type_checking: { mode: "enabled", value: "strict" },
    require_tests: { mode: "enabled", value: false },
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
    python_type_checker: { mode: "enabled", value: "auto" },
    js_format_lint: { mode: "enabled", value: "auto" },
    commit_type_check: { mode: "enabled", value: "auto" },
    commit_test_run: { mode: "enabled", value: "auto" },
  },
  rules: [...CORE_PLATFORM_RULES],
  skills: [...CORE_PLATFORM_SKILLS],
  agents: [],
  mcpServers: [],
};
