import { PROJECT_NAME, prefixedName } from "../../constants.js";
import type { BuiltinPresetDefinition } from "./types.js";

export const preset: BuiltinPresetDefinition = {
  name: prefixedName("minimal"),
  description:
    "Permissive — security off, no test requirements, all actions allowed",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["minimal", "permissive", "starter"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "cursor", "windsurf", "codex", "cline"],
  },
  flags: {
    auto_commit: { mode: "enabled", value: false },
    test_before_commit: { mode: "enabled", value: false },
    security_scan: { mode: "enabled", value: false },
    type_checking: { mode: "enabled", value: "off" },
    max_file_lines: { mode: "enabled", value: 1000 },
    require_tests: { mode: "enabled", value: false },
    allow_shell_commands: { mode: "enabled", value: true },
    allow_file_deletion: { mode: "enabled", value: true },
    lint_on_save: { mode: "enabled", value: false },
    allow_force_push: { mode: "enabled", value: true },
    require_pr_review: { mode: "enabled", value: false },
    mcp_allowed_servers: { mode: "enabled", value: [] },
    require_documentation: { mode: "enabled", value: false },
    allowed_languages: { mode: "enabled", value: ["*"] },
    max_context_tokens: { mode: "enabled", value: 100000 },
    progressive_loading: { mode: "enabled", value: "off" },
    drift_detection: { mode: "enabled", value: "off" },
    auto_generate_on_change: { mode: "enabled", value: false },
  },
  rules: [],
  skills: [],
  agents: [],
  commands: [],
  mcpServers: [],
};
