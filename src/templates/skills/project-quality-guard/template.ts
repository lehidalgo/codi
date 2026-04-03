import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Use when setting up a new project, auditing project quality infrastructure, or checking for missing CI/CD, pre-commit hooks, linting, testing, security scanning, Docker, or environment config.
category: Code Quality
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Project Quality Audit
  examples:
    - "Audit this project's quality infrastructure"
    - "Set up CI/CD and pre-commit hooks"
    - "Check what's missing in our project config"
version: 1
---

## When to Activate

- User sets up a new project from scratch
- User asks "Do we have CI/CD?" or "Is our project configured correctly?"
- User adds pre-commit hooks, linting, testing, or security scanning
- User checks for missing \\\`.gitignore\\\`, \\\`.gitattributes\\\`, \\\`.editorconfig\\\`
- User prepares for first deploy or reviews tooling after major changes
- User clones a repo and wants to verify local setup
- Pipeline passes locally but fails in CI (or vice versa)

## When NOT to Use

- Writing application code (use domain-specific skills)
- Debugging runtime errors (use systematic-debugging)
- Single-file formatting questions (just run the formatter)

# Project Quality Guard

Audits and enforces complete project quality infrastructure across 9 categories. Runs checks, warns about missing components, and adds fixes on user approval.

**Core principle:** A project is not set up until ALL quality layers are verified — local hooks, CI pipeline, and deployment config must form a continuous, gap-free chain.

**Deterministic validation:** ALL checks (linting, testing, YAML/JSON validation, coverage, security scanning) MUST be automated and run programmatically — via pre-commit hooks, CI pipelines, or scripts. The agent's role is to **audit** which automated checks exist, **read** their results, and **add** missing automation. The agent NEVER validates files manually; it ensures the tooling is in place to do it deterministically.

---

## Audit Process

\\\`\\\`\\\`dot
digraph audit {
    rankdir=TB;
    "Start" [shape=doublecircle];
    "Run audit script" [shape=box];
    "Review results" [shape=box];
    "All pass?" [shape=diamond];
    "Report success" [shape=box, style=filled, fillcolor="#90EE90"];
    "List missing items with warnings" [shape=box];
    "Ask user: fix?" [shape=diamond];
    "Read reference file for category" [shape=box];
    "Add fix" [shape=box];
    "Verify fix works" [shape=box];
    "More missing?" [shape=diamond];
    "Done" [shape=doublecircle];

    "Start" -> "Run audit script";
    "Run audit script" -> "Review results";
    "Review results" -> "All pass?";
    "All pass?" -> "Report success" [label="yes"];
    "All pass?" -> "List missing items with warnings" [label="no"];
    "List missing items with warnings" -> "Ask user: fix?";
    "Ask user: fix?" -> "Read reference file for category" [label="yes"];
    "Ask user: fix?" -> "Done" [label="skip"];
    "Read reference file for category" -> "Add fix";
    "Add fix" -> "Verify fix works";
    "Verify fix works" -> "More missing?";
    "More missing?" -> "Ask user: fix?" [label="yes"];
    "More missing?" -> "Done" [label="no"];
    "Report success" -> "Done";
}
\\\`\\\`\\\`

### Step 1: Run Audit Script

**RUN** (do NOT read) the audit script. It checks for config files and reports status:

\\\`\\\`\\\`bash
bash \${CLAUDE_SKILL_DIR}/scripts/audit-project.sh "/path/to/project"
\\\`\\\`\\\`

### Step 2: Review and Warn

For each **MISSING** item, display a clear warning with impact:

\\\`\\\`\\\`
WARNING: .gitattributes missing — Line endings not normalized. Cross-OS diffs will have phantom changes.
WARNING: Pre-commit hooks not configured — No automated quality gate before commits.
OK: .gitignore exists
OK: .editorconfig exists
\\\`\\\`\\\`

### Step 3: Offer to Fix

For each missing item, ask: "Want me to set up [item]?" When approved, **read** the corresponding reference file for detailed config templates.

---

## Quality Checklist

| # | Category | Files to Check | Reference |
|---|----------|---------------|-----------|
| 1 | **Git Config** | .gitignore, .gitattributes, .editorconfig | \\\`references/git-config.md\\\` |
| 2 | **Security Scanning** | .gitleaks.toml, .bandit.yaml, secrets rules | \\\`references/security-scanning.md\\\` |
| 3 | **Pre-commit Hooks** | .pre-commit-config.yaml, hook installation | \\\`references/pre-commit-hooks.md\\\` |
| 4 | **Python Tooling** | pyproject.toml (ruff, mypy), Makefile | \\\`references/python-tooling.md\\\` |
| 5 | **TypeScript Tooling** | eslint.config.js, .prettierrc, tsconfig.json | \\\`references/typescript-tooling.md\\\` |
| 6 | **Testing Strategy** | test dirs, fixtures, coverage config, markers | \\\`references/testing-strategy.md\\\` |
| 7 | **CI/CD Pipelines** | .github/workflows/ci.yml, deploy.yml | \\\`references/cicd-pipelines.md\\\` |
| 8 | **Docker & Deploy** | Dockerfile, docker-compose.yml, railway.toml | \\\`references/docker-deploy.md\\\` |
| 9 | **Env Management** | .env.example, .env.local.example, config.py | \\\`references/env-management.md\\\` |

---

## Non-Negotiable Checks

These MUST exist. Always warn if missing — do not silently skip:

1. **\\\`.gitignore\\\`** — Must exclude: node_modules, __pycache__, .env, .venv, IDE files, OS files
2. **\\\`.gitattributes\\\`** — Must enforce LF: \\\`* text=auto eol=lf\\\` + per-extension rules
3. **\\\`.editorconfig\\\`** — Must set indent style/size per language, charset utf-8, LF endings
4. **Pre-commit hooks** — Minimum: line endings, trailing whitespace, secrets detection, linting
5. **CI pipeline** — Minimum: lint + type-check + test on push/PR to main
6. **\\\`.env.example\\\`** — Document all required env vars with placeholders (NEVER real secrets)
7. **Testing (80% min coverage)** — Every project must have: fixture tests with synthetic data, unit tests, smoke tests, and integration tests when possible. See \\\`references/testing-strategy.md\\\`.

---

## Testing Rules

| Rule | Enforcement |
|------|-------------|
| **Minimum 80% coverage** | \\\`fail_under = 80\\\` in coverage config. Warn if missing. |
| **Fixture tests with synthetic data** | \\\`conftest.py\\\` must define reusable fixtures with factory functions. Never use production data in tests. |
| **Unit tests** | Required for ALL domain logic, utils, and pure functions. No DB, no network. |
| **Smoke tests** | Required for deployed services. Hit real endpoints, verify 200 OK + basic response shape. |
| **Integration tests** | Required when project has a database or external APIs. Test real queries and endpoint flows. |
| **Config/artifact validation** | ALL non-code files must be validated: YAML (yamllint), JSON (check-json), Dockerfiles (hadolint), Terraform (validate+tflint), Helm (lint), K8s (kubeval), shell (shellcheck). |
| **Universal coverage** | If the project has code in ANY language (Go, Rust, Ruby, etc.) or framework (Airflow, Ansible, Pulumi), that code MUST have tests. No ecosystem is exempt. |

**Test type decision:**

\\\`\\\`\\\`dot
digraph tests {
    rankdir=LR;
    "New code" [shape=doublecircle];
    "Pure logic?" [shape=diamond];
    "Unit test" [shape=box];
    "Touches DB/API?" [shape=diamond];
    "Integration test" [shape=box];
    "Has endpoints?" [shape=diamond];
    "Smoke test" [shape=box];
    "All need fixtures" [shape=box, style=filled, fillcolor="#FFFFCC"];

    "New code" -> "Pure logic?";
    "Pure logic?" -> "Unit test" [label="yes"];
    "Pure logic?" -> "Touches DB/API?" [label="no"];
    "Touches DB/API?" -> "Integration test" [label="yes"];
    "Touches DB/API?" -> "Has endpoints?" [label="no"];
    "Has endpoints?" -> "Smoke test" [label="yes"];
    "Unit test" -> "All need fixtures";
    "Integration test" -> "All need fixtures";
    "Smoke test" -> "All need fixtures";
}
\\\`\\\`\\\`

When auditing or adding tests, **read** \\\`references/testing-strategy.md\\\` for full patterns, fixtures, and config templates.

---

## Pipeline Continuity Check

The 3-layer pipeline must be gap-free:

\\\`\\\`\\\`
Layer 1: Local (pre-commit)     Layer 2: CI (GitHub Actions)     Layer 3: Deploy
-------------------------------  --------------------------------  ------------------
Must have:                      Must have:                       Must have:
 - Line ending normalization     - Same linters as local          - Health check endpoint
 - Secrets scanning              - Same type checkers             - Env vars configured
 - Linting (ruff/eslint)         - Migration verification         - Auto or manual deploy
 - Type checking (mypy/tsc)      - Unit + integration tests       - Rollback strategy
 - Unit tests                    - Build verification
 - Format checking               - Same tool versions as local
\\\`\\\`\\\`

**CRITICAL:** If CI does not run the same checks as pre-commit, there is a pipeline gap. The rule: **if it passes locally, it MUST pass in CI.** Discrepancies indicate environment issues.

To verify continuity, compare:
- Pre-commit hook list vs CI job steps
- Tool versions in pre-commit config vs CI config
- Python/Node versions locally vs in CI

---

## Stack Detection

Before adding fixes, detect the project stack:

\\\`\\\`\\\`dot
digraph detect {
    "pyproject.toml exists?" [shape=diamond];
    "package.json exists?" [shape=diamond];
    "Python project" [shape=box];
    "Node project" [shape=box];
    "Full-stack project" [shape=box];
    "Unknown — ask user" [shape=box];

    "pyproject.toml exists?" -> "package.json exists?" [label="yes"];
    "pyproject.toml exists?" -> "package.json exists?" [label="no"];
    "package.json exists?" -> "Full-stack project" [label="both yes"];
    "package.json exists?" -> "Python project" [label="only pyproject"];
    "package.json exists?" -> "Node project" [label="only package.json"];
    "package.json exists?" -> "Unknown — ask user" [label="neither"];
}
\\\`\\\`\\\`

Adapt all configs to the detected stack. Do not install Python tooling in a Node-only project.

---

## Adding a Fix

When the user approves fixing a missing item:

1. **Read** the corresponding reference file from \\\`references/\\\`
2. **Adapt** the template to the project's actual stack (detect Python/Node/both)
3. **Create** the config file(s) with project-appropriate settings
4. **Verify** the fix works by running the tool/hook
5. **Move** to the next missing item

---

## Common Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| CI uses different lint rules than local | "Works on my machine" syndrome | Same config files, same versions |
| Pre-commit not installed after clone | Hooks never run, quality degrades | Add to README Quick Start section |
| .gitattributes missing | CRLF/LF diff noise across OS | Add \\\`* text=auto eol=lf\\\` |
| Real secrets in .env.example | Credential leak on public repos | Only placeholders: \\\`API_KEY=xxx\\\` |
| No .editorconfig | Inconsistent indentation per editor | Add with per-language indent rules |
| Lockfiles not committed | Non-deterministic installs | Always commit uv.lock, package-lock.json |
`;
