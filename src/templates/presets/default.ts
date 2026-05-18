import { PROJECT_NAME, SUPPORTED_PLATFORMS, prefixedName } from "#src/constants.js";
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
    agents: [...SUPPORTED_PLATFORMS],
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
  // Capellai-parity rules (24 + 1 from CORE_PLATFORM = 25 total).
  // Language-specific extras present in src/templates/rules/ but excluded
  // from the canonical default: csharp, django, golang, java, kotlin, rust,
  // spring-boot, swift. Project-specific rule `v1-sprint-gates` from capellai
  // is intentionally dropped (ADR-013).
  rules: [
    ...CORE_PLATFORM_RULES,
    prefixedName("agent-capability-discovery"),
    prefixedName("agent-usage"),
    prefixedName("api-design"),
    prefixedName("architecture"),
    prefixedName("capture-everything"),
    prefixedName("code-style"),
    prefixedName("contribution-discipline"),
    prefixedName("documentation"),
    prefixedName("error-handling"),
    prefixedName("git-workflow"),
    prefixedName("nextjs"),
    prefixedName("output-discipline"),
    prefixedName("output-tone-policy"),
    prefixedName("performance"),
    prefixedName("production-mindset"),
    prefixedName("python"),
    prefixedName("react"),
    prefixedName("security"),
    prefixedName("simplicity-first"),
    prefixedName("spanish-orthography"),
    prefixedName("testing"),
    prefixedName("typescript"),
    prefixedName("vault-discipline"),
    prefixedName("workflow"),
  ],
  // Capellai parity skills. Group A: 11 skills already in src/templates/skills/
  // (caveman, diagnose, tdd, zoom-out + 7 dev-* meta-skills). The dev-X
  // family renders as codi-dev-X — capellai installed these without the
  // `dev-` infix, the divergence is intentional (codi convention preserves
  // the meta-skill marker in source).
  // Group B (7 Obsidian/wiki skills) and Group C (19 capellai-only skills)
  // remain to be ported into src/templates/skills/ in follow-up commits.
  skills: [
    ...CORE_PLATFORM_SKILLS,
    prefixedName("caveman"),
    prefixedName("diagnose"),
    prefixedName("tdd"),
    prefixedName("zoom-out"),
    prefixedName("dev-agent-creator"),
    prefixedName("dev-artifact-contributor"),
    prefixedName("dev-docs-manager"),
    prefixedName("dev-operations"),
    prefixedName("dev-preset-creator"),
    prefixedName("dev-rule-creator"),
    prefixedName("dev-skill-creator"),
    // Group C — capellai-only ports (4 smallest first, the rest in follow-up commits)
    prefixedName("handoff"),
    prefixedName("edit-article"),
    prefixedName("grill-me"),
    prefixedName("prototype"),
    prefixedName("improve-codebase-architecture"),
    prefixedName("to-prd"),
    prefixedName("to-issues"),
    prefixedName("defuddle"),
    prefixedName("save"),
    prefixedName("wiki-query"),
    prefixedName("triage"),
    prefixedName("setup-pre-commit"),
    prefixedName("wiki"),
    prefixedName("autoresearch"),
    prefixedName("grill-with-docs"),
    prefixedName("git-guardrails-claude-code"),
    prefixedName("migrate-to-shoehorn"),
    prefixedName("scaffold-exercises"),
    prefixedName("wiki-fold"),
  ],
  // Capellai parity: 2 vault-management agents. Other built-in agents
  // (code-reviewer, data experts, etc.) remain available as templates but
  // are NOT registered in the default preset.
  agents: [prefixedName("wiki-ingest"), prefixedName("wiki-lint")],
  mcpServers: [],
};
