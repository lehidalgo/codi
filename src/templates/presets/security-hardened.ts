import { PROJECT_NAME, prefixedName } from "../../constants.js";
import type { BuiltinPresetDefinition } from "./types.js";

export const preset: BuiltinPresetDefinition = {
  name: prefixedName("security-hardened"),
  description:
    "Maximum security enforcement with locked flags, mandatory scans, and restricted operations",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["security", "hardened", "compliance", "enterprise"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "cursor", "windsurf", "codex", "cline"],
  },
  flags: {
    auto_commit: { mode: "enabled", value: false },
    test_before_commit: { mode: "enforced", value: true, locked: true },
    security_scan: { mode: "enforced", value: true, locked: true },
    type_checking: { mode: "enforced", value: "strict", locked: true },
    max_file_lines: { mode: "enabled", value: 500 },
    require_tests: { mode: "enforced", value: true, locked: true },
    allow_shell_commands: { mode: "enforced", value: true, locked: true },
    allow_file_deletion: { mode: "enforced", value: false, locked: true },
    lint_on_save: { mode: "enabled", value: true },
    allow_force_push: { mode: "enforced", value: false, locked: true },
    require_pr_review: { mode: "enforced", value: true, locked: true },
    mcp_allowed_servers: { mode: "enabled", value: [] },
    require_documentation: { mode: "enabled", value: true },
    allowed_languages: { mode: "enabled", value: ["*"] },
    max_context_tokens: { mode: "enabled", value: 50000 },
    progressive_loading: { mode: "enabled", value: "metadata" },
    drift_detection: { mode: "enabled", value: "error" },
    auto_generate_on_change: { mode: "enabled", value: true },
  },
  rules: [
    prefixedName("security"),
    prefixedName("code-style"),
    prefixedName("testing"),
    prefixedName("error-handling"),
    prefixedName("api-design"),
    prefixedName("git-workflow"),
  ],
  skills: [
    prefixedName("security-scan"),
    prefixedName("code-review"),
    prefixedName("commit"),
  ],
  agents: [prefixedName("security-analyzer"), prefixedName("code-reviewer")],
  commands: [
    prefixedName("security-scan"),
    prefixedName("review"),
    prefixedName("commit"),
    prefixedName("test-run"),
  ],
  mcpServers: [],
};
