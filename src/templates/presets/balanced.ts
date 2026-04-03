import { PROJECT_NAME, prefixedName, devArtifactName } from "#src/constants.js";
import type { BuiltinPresetDefinition } from "./types.js";

export const preset: BuiltinPresetDefinition = {
  name: prefixedName("balanced"),
  description: "Recommended — security on, type-checking strict, no force-push",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["balanced", "recommended", "general"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "cursor", "windsurf", "codex", "cline"],
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
    allowed_languages: { mode: "enabled", value: ["*"] },
    progressive_loading: { mode: "enabled", value: "metadata" },
    drift_detection: { mode: "enabled", value: "warn" },
    auto_generate_on_change: { mode: "enabled", value: false },
  },
  rules: [
    prefixedName("code-style"),
    prefixedName("error-handling"),
    prefixedName("git-workflow"),
    prefixedName("testing"),
    devArtifactName("improvement"),
  ],
  skills: [
    prefixedName("code-review"),
    prefixedName("security-scan"),
    prefixedName("commit"),
    prefixedName("compare-preset"),
  ],
  agents: [prefixedName("code-reviewer")],
  mcpServers: [],
};
