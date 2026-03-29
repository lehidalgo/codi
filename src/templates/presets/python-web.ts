import { PROJECT_NAME, prefixedName } from "../../constants.js";
import type { BuiltinPresetDefinition } from "./types.js";

export const preset: BuiltinPresetDefinition = {
  name: prefixedName("python-web"),
  description:
    "Python web development with Django/FastAPI conventions, security, and testing",
  version: "1.0.0",
  author: PROJECT_NAME,
  tags: ["python", "web", "django", "fastapi", "api"],
  compatibility: {
    engine: ">=0.3.0",
    agents: ["claude-code", "cursor", "windsurf", "codex", "cline"],
  },
  flags: {
    auto_commit: { mode: "enabled", value: false },
    test_before_commit: { mode: "enabled", value: true },
    security_scan: { mode: "enforced", value: true },
    type_checking: { mode: "enforced", value: "strict" },
    max_file_lines: { mode: "enabled", value: 500 },
    require_tests: { mode: "enabled", value: true },
    allow_shell_commands: { mode: "enabled", value: true },
    allow_file_deletion: { mode: "enabled", value: true },
    lint_on_save: { mode: "enabled", value: true },
    allow_force_push: { mode: "enabled", value: false },
    require_pr_review: { mode: "enabled", value: true },
    mcp_allowed_servers: { mode: "enabled", value: [] },
    require_documentation: { mode: "enabled", value: false },
    allowed_languages: { mode: "enabled", value: ["*"] },
    max_context_tokens: { mode: "enabled", value: 50000 },
    progressive_loading: { mode: "enabled", value: "metadata" },
    drift_detection: { mode: "enabled", value: "warn" },
    auto_generate_on_change: { mode: "enabled", value: false },
  },
  rules: [
    prefixedName("python"),
    prefixedName("django"),
    prefixedName("security"),
    prefixedName("api-design"),
    prefixedName("testing"),
    prefixedName("error-handling"),
  ],
  skills: [
    prefixedName("code-review"),
    prefixedName("security-scan"),
    prefixedName("e2e-testing"),
    prefixedName("commit"),
  ],
  agents: [
    prefixedName("code-reviewer"),
    prefixedName("security-analyzer"),
    prefixedName("test-generator"),
    prefixedName("python-expert"),
  ],
  commands: [
    prefixedName("check"),
    prefixedName("commit"),
    prefixedName("review"),
    prefixedName("test-run"),
    prefixedName("security-scan"),
  ],
  mcpServers: [],
};
