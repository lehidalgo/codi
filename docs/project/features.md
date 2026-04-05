# Features

Complete inventory of Codi capabilities.

## Configuration Management

### Single Source of Truth
All AI agent configurations originate from a single `.codi/` directory. Rules, skills, agents, flags, and MCP settings are defined once and generated into agent-specific formats.

### 3-Layer Config Resolution
Flags resolve through an ordered precedence chain, where each layer can override the previous. Conditional flags can target specific agents or file patterns.

| Layer | Source | Example |
|:------|:-------|:--------|
| 1. Preset | Built-in or custom preset | `codi-strict` enforces locked flags |
| 2. Repository | `flags.yaml` in `.codi/` | Project-specific settings |
| 3. User | User-level overrides | Personal preferences |

### Drift Detection
Hash-based tracking in `state.json` detects when generated config files diverge from `.codi/` source artifacts. Configurable via the `drift_detection` flag: `off`, `warn` (default), or `error`.

### Backup and Revert
Timestamped backups are created before every generation run. Restore any previous state with `codi revert`, which lists available snapshots and rolls back the selected one.

### Audit Log
Append-only JSONL log records every generation event with timestamp, artifacts included, agent targets, and file hashes. Enables traceability and compliance auditing.

---

## Multi-Agent Support

Five agents supported via an adapter pattern. Each adapter translates the unified `.codi/` artifacts into the agent's native config format.

| Agent | Config File | Rules | Skills | Agents | MCP Config | Skill Files |
|:------|:-----------|:-----:|:------:|:------:|:----------:|:----------:|
| Claude Code | `CLAUDE.md` | Yes | Yes | Yes | `.mcp.json` | Yes |
| Cursor | `.cursorrules` | Yes | Yes | -- | `.cursor/mcp.json` | Yes |
| Codex | `AGENTS.md` | Yes | Yes | Yes | `.codex/config.toml` | Yes |
| Windsurf | `.windsurfrules` | Yes | Yes | -- | -- | Yes |
| Cline | `.clinerules` | Yes | Yes | -- | -- | Yes |

---

## Automatic Config Synchronization

Codi's core value: edit artifacts once in `.codi/`, and all agent config files update automatically. The synchronization lifecycle has four stages: generate, detect drift, watch, and verify.

### Generation Pipeline

`codi generate` reads all `.codi/` artifacts (rules, skills, agents, flags, MCP servers, brands) and produces agent-native config files via the adapter pattern. Each adapter transforms the unified config into the format its agent expects.

| Agent | Instruction File | Separate Artifacts | MCP Config | Settings |
|:------|:----------------|:-------------------|:-----------|:---------|
| Claude Code | `CLAUDE.md` | `.claude/rules/`, `.claude/skills/`, `.claude/agents/` | `.mcp.json` | `.claude/settings.json` |
| Codex | `AGENTS.md` | `.codex/agents/*.toml` | `.codex/config.toml` | -- |
| Cursor | `.cursorrules` | -- | `.cursor/mcp.json` | `.cursor/hooks.json` |
| Windsurf | `.windsurfrules` | `.windsurf/skills/` | -- | -- |
| Cline | `.clinerules` | `.cline/skills/` | -- | -- |

The generated instruction files include: project overview, active rules (inline or referenced), skill routing table, agent definitions, MCP server list, permission restrictions, and a verification section.

### Drift Detection

After generation, Codi records a hash pair for every generated file in `.codi/state.json`: the **source hash** (computed from all `.codi/` artifacts that contributed to the file) and the **generated hash** (the content hash of the output file). On subsequent runs, `codi status` compares these hashes to detect three states:

| State | Meaning | Action |
|:------|:--------|:-------|
| Synced | Generated file matches source artifacts | No action needed |
| Drifted | File was manually edited after generation | Re-run `codi generate` to overwrite, or update `.codi/` source to match |
| Missing | Generated file was deleted | Re-run `codi generate` to recreate |

The `drift_detection` flag controls behavior: `off` (skip checks), `warn` (report in status output, default), or `error` (fail CI).

### Watch Mode

`codi watch` monitors the `.codi/` directory with a debounced file watcher. When any artifact file changes, it triggers an automatic regeneration cycle — providing immediate feedback during rule or skill editing. The watcher ignores `state.json` and `audit.jsonl` to avoid infinite loops. The `auto_generate_on_change` flag must be enabled for watch to trigger regeneration.

### Documentation Sync

`codi docs-update` scans project documentation files (STATUS.md, CONTRIBUTING.md) for artifact count references and validates them against actual counts. When mismatches are found, it auto-fixes the numbers — keeping documentation accurate as artifacts are added or removed.

### Verification Tokens

Each `codi generate` run computes a SHA256-based verification token from the manifest name, agents, rules, skills, MCP servers, and active flags. This token is embedded in every generated instruction file. Running `codi verify` echoes the token back, confirming the agent loaded the correct configuration. The `--check` mode validates an agent's response against the expected token programmatically.

---

## Artifact System

### Artifact Types

| Type | Count | Purpose |
|:-----|------:|:--------|
| Rules | 28 | Instructions agents follow (code style, security, language conventions) |
| Skills | 52 | Reusable workflows agents can invoke (code review, testing, document generation) |
| Agents | 22 | Subagent definitions with specialized tools and models |
| Brands | custom | Visual identity tokens (colors, typography, logos, tone of voice) |

### Rule Templates

| Category | Count | Templates |
|:---------|------:|:----------|
| Universal | 11 | security, testing, architecture, code-style, error-handling, performance, documentation, api-design, production-mindset, simplicity-first, output-discipline |
| Language | 9 | TypeScript, Python, Go, Java, Kotlin, Rust, Swift, C#, React |
| Framework | 3 | Next.js, Django, Spring Boot |
| Workflow | 5 | git-workflow, workflow, improvement-dev, agent-usage, spanish-orthography |

### Skill Templates

| Category | Skills |
|:---------|:-------|
| Brand Identity | codi-bbva-brand, codi-brand-identity, codi-rl3-brand |
| Code Quality | codi-code-review, codi-dev-e2e-testing, codi-guided-qa-testing, codi-project-quality-guard, codi-refactoring, codi-security-scan, codi-session-recovery, codi-test-coverage, codi-webapp-testing |
| Codi Platform | codi-agent-creator, codi-artifact-contributor, codi-compare-preset, codi-dev-docs-manager, codi-dev-operations, codi-preset-creator, codi-refine-rules, codi-rule-creator, codi-rule-feedback, codi-skill-creator, codi-skill-feedback-reporter |
| Content Creation | codi-content-factory |
| Content Refinement | codi-humanizer |
| Creative and Design | codi-algorithmic-art, codi-canvas-design, codi-claude-artifacts-builder, codi-frontend-design, codi-slack-gif-creator, codi-theme-factory |
| Developer Tools | codi-claude-api, codi-codebase-explore, codi-codebase-onboarding, codi-commit, codi-diagnostics, codi-graph-sync, codi-internal-comms, codi-mcp-ops, codi-mobile-development, codi-project-documentation |
| Document Generation | codi-deck-engine, codi-doc-engine |
| File Format Tools | codi-docx, codi-pdf, codi-pptx, codi-xlsx |
| Planning | codi-roadmap |
| Productivity | codi-audio-transcriber |
| Testing | codi-test-run |
| Workflow | codi-daily-log, codi-session-handoff |

### Built-in Eval Cases

Tier 1 skill templates ship with pre-written eval cases in `evals/evals.json`. Each eval set contains 5-7 cases with realistic prompts and objectively verifiable expectations. Cases include positive triggers (skill should activate) and negative cross-cluster cases (skill should NOT activate for a confusable prompt).

Skills with built-in evals: codi-commit, codi-debugging, codi-tdd, codi-code-review, codi-verification, codi-brainstorming, codi-plan-writer, codi-plan-executor, codi-subagent-dev, codi-session-handoff, codi-skill-creator, codi-refactoring, codi-security-scan, codi-test-coverage.

During `codi init`, these evals propagate to `.codi/skills/{name}/evals/evals.json`. The eval runner (`run-eval.ts`) and improvement loop (`run-loop.ts`) in the skill-creator scripts use these cases to test and refine skill descriptions.

### Skill Routing

The routing table maps user intents to recommended skills and appears in all generated agent config files. Each row derives the task type from the skill name and uses the first sentence of the description. Brand-category skills are excluded from the table.

### Platform-Aware Skill Generation

`codi generate` filters SKILL.md frontmatter fields per target platform — each agent receives only the fields its format supports:

| Platform | Supported Fields |
|:---------|:----------------|
| claude-code | name, description, user-invocable, disable-model-invocation, argument-hint, allowed-tools, model, effort, context, agent, paths, shell, license, metadata, hooks |
| cursor | name, description, user-invocable, disable-model-invocation, allowed-tools, model, license, metadata |
| codex | name, description, license, allowed-tools, metadata |
| windsurf | name, description, disable-model-invocation, allowed-tools, license, metadata |
| cline | name, description, disable-model-invocation, allowed-tools, license, metadata |

### Artifact Version Tracking

Each built-in template carries an `artifactVersion` stamp. `codi update` compares installed artifact hashes against the registry baseline and classifies every `.codi/` artifact as:

| State | Meaning |
|:------|:--------|
| original | Matches the template — safe to upgrade |
| modified | User edited the file after install |
| new | Not present in the registry (user-created) |
| removed | Exists in registry but not installed |
| user-managed | `managed_by: user` — never updated automatically |

`codi update` presents per-artifact upgrade choices and skips user-modified files unless explicitly overridden.

### Agent Templates

| Category | Agents |
|:---------|:-------|
| Core (8) | code-reviewer, test-generator, security-analyzer, refactorer, docs-lookup, onboarding-guide, performance-auditor, api-designer |
| Domain (14) | codebase-explorer, ai-engineering-expert, data-analytics-bi-expert, data-engineering-expert, data-intensive-architect, data-science-specialist, legal-compliance-eu, marketing-seo-specialist, mlops-engineer, nextjs-researcher, openai-agents-specialist, payload-cms-auditor, python-expert, scalability-expert |

---

## Preset System

### Built-in Presets

| Preset | Focus | Description |
|:-------|:------|:------------|
| minimal | Starter | Permissive -- security off, no test requirements, all actions allowed |
| balanced | General | Recommended -- security on, type-checking strict, no force-push |
| strict | Enforcement | Enforced -- security locked, tests required, shell/delete restricted, no force-push |
| fullstack | Web/App | Comprehensive web/app development -- broad rules, testing, and security. Language-agnostic |
| development | Internal | Preset for developing the Codi CLI itself |
| power-user | Workflow | Daily workflow -- graph exploration, day tracking, session management, codebase onboarding |

### Preset Operations
Create, list, install, export, validate, remove, and edit presets. Distribution supports GitHub repositories and ZIP files with lockfile tracking (`preset-lock.json`).

---

## CLI Operations

### Commands by Category

| Category | Command | Description |
|:---------|:--------|:------------|
| **Setup** | `init` | Interactive wizard to scaffold `.codi/` directory |
| | `add` | Add rules, skills, agents, or brands |
| | `generate` | Build agent config files from `.codi/` source |
| | `preset` | Install, create, list, export, validate, or remove presets |
| **Monitoring** | `status` | Show drift status and artifact summary |
| | `doctor` | Environment diagnostics and dependency checks |
| | `validate` | Schema validation for manifest and all artifacts |
| | `verify` | Echo verification token to confirm config integrity |
| | `compliance` | Composite check: doctor + status + verification |
| | `ci` | Non-interactive validation with exit codes for CI pipelines |
| | `watch` | Auto-regenerate on `.codi/` file changes |
| | `docs-update` | Regenerate project documentation |
| **Operations** | `update` | Check for and apply Codi updates |
| | `clean` | Remove generated config files |
| | `revert` | Restore from timestamped backup |
| | `skill` | Manage skills (evolve, export, stats) |
| **Onboarding** | `onboard` | AI-guided setup — print catalog and playbook for coding agent |
| **Community** | `contribute` | Share artifacts to any GitHub repo via PR or ZIP export; supports private repos and empty-repo bootstrapping |
| | `docs` | Open documentation |

---

## Interactive Mode

### Command Center
Running `codi` with no arguments launches an interactive menu with grouped actions (Setup, Build, Monitor). Navigate with arrow keys and select to execute any command.

### Init Wizard
Four-step guided setup: select languages, choose agents, pick config mode (preset / custom / ZIP / GitHub), and select individual artifacts. Supports backward navigation with Ctrl+C.

### AI-Guided Onboarding
`codi onboard` prints a self-contained guide to stdout that a coding agent reads and follows. The guide contains: a full artifact catalog (all rules, skills, and agents grouped by category with descriptions), a built-in presets reference (each preset's artifacts and flag configuration), and a 7-step agent playbook.

The playbook instructs the coding agent to: explore the codebase deeply, formulate a preset and artifact recommendation with per-artifact rationale, present the proposal to the user, iterate until approved, execute `codi init` + `codi add` + `codi generate`, and create a timestamped summary document.

---

## Development Workflow Integration

### Watch Mode
`codi watch` monitors the `.codi/` directory for changes and auto-regenerates agent config files on save. Useful during active rule or skill editing.

### Pre-Commit Hooks
Auto-detects and integrates with existing hook frameworks. Generates hook scripts based on enabled flags and detected languages.

| Framework | Detection |
|:----------|:----------|
| Husky | `.husky/` directory |
| pre-commit | `.pre-commit-config.yaml` |
| Lefthook | `.lefthook.yml` or `lefthook.yml` |
| Standalone | Fallback shell script |

### Hook Types

| Hook | Stage | Flag | Purpose |
|:-----|:------|:-----|:--------|
| Doctor | pre-commit | `requiredVersion` in manifest | Check Node.js version and environment health |
| Linting/formatting | pre-commit | language-detected, always on | ESLint, Prettier, ruff, gofmt, etc. — no flag to disable |
| Type checking | pre-commit | `type_checking` | Run tsc, pyright, or equivalent |
| Security analysis | pre-commit | `security_scan` | bandit (Python), gosec (Go), brakeman (Ruby), phpcs-security (PHP) |
| Version bump | pre-commit | codi-dev only | Auto-increment template frontmatter version when content changes, regenerate baseline |
| Test runner | pre-commit | `test_before_commit` | Run test suite before commit |
| Secret detection | pre-commit | `security_scan` | Scan for leaked secrets and API keys (entropy + pattern matching) |
| File size check | pre-commit | always enabled | Block files exceeding line limit |
| Version check | pre-commit | `requiredVersion` in manifest | Verify installed codi version satisfies the project requirement |
| Artifact validate | pre-commit | always enabled | Run `codi validate --ci` when `.codi/` files change |
| Import depth check | pre-commit | always enabled | Block `../../` deep relative imports in TS/JS files |
| Skill YAML validate | pre-commit | always enabled | Validate YAML frontmatter in `SKILL.md` files |
| Skill resource check | pre-commit | always enabled | Verify `[[/path]]` resource references exist on disk |
| Template wiring check | pre-commit | codi-dev only | Ensure all templates are registered in index.ts (only when `src/templates/` exists) |
| Commit message | commit-msg | always enabled | Enforce conventional commit format |
| Doc check | pre-push | `require_documentation` | Block pushes to protected branches without a doc stamp |

### Auto-Restage
Hooks that modify files (formatters, fixers) automatically re-stage the modified files after running, so the commit includes the formatted output.

---

## Quality and Compliance

### Validation
Schema-based validation for `codi.yaml` manifest and all artifact types (rules, skills, agents). Reports specific errors with file paths and line references.

### Doctor
Environment diagnostics: checks Node.js version, git availability, hook framework health, dependency status, and `.codi/` directory structure.

### CI Mode
`codi ci` and `codi doctor --ci` run all checks non-interactively and return non-zero exit codes on failure. Designed for CI/CD pipeline integration.

### Compliance
Composite command that runs doctor, status, and verification in sequence. A single pass/fail gate for deployment pipelines.

### Verification Tokens
Each project gets a unique token embedded in `codi.yaml`. Agents can echo the token back to prove they loaded the correct configuration.

---

## Flag System

16 behavioral flags control agent permissions, code quality gates, and generation behavior.

| Flag | Type | Default | Description |
|:-----|:-----|:--------|:------------|
| `auto_commit` | boolean | `false` | Automatic commits after changes |
| `test_before_commit` | boolean | `true` | Run tests before commit |
| `security_scan` | boolean | `true` | Mandatory security scanning |
| `type_checking` | enum | `strict` | Type checking level (`strict` / `basic` / `off`) |
| `require_tests` | boolean | `false` | Require tests for new code |
| `allow_shell_commands` | boolean | `true` | Allow shell command execution |
| `allow_file_deletion` | boolean | `true` | Allow file deletion |
| `lint_on_save` | boolean | `true` | Lint files on save |
| `allow_force_push` | boolean | `false` | Allow force push to remote |
| `require_pr_review` | boolean | `true` | Require PR review before merge |
| `mcp_allowed_servers` | string[] | `[]` | Allowed MCP server names |
| `require_documentation` | boolean | `false` | Require documentation for new code |
| `allowed_languages` | string[] | `["*"]` | Allowed programming languages |
| `progressive_loading` | enum | `metadata` | Skill inlining for single-file agents — `off`: inline in main file, `metadata`/`full`: catalog table |
| `drift_detection` | enum | `warn` | Drift detection behavior (`off` / `warn` / `error`) |
| `auto_generate_on_change` | boolean | `false` | Auto-generate on config change |

### Enforcement Modes

| Mode | Behavior |
|:-----|:---------|
| `enabled` | Default value, overridable by higher layers |
| `enforced` | Locked value, cannot be overridden |
| `conditional` | Applies only when conditions match (lang, framework, agent) |

---

## MCP Integration

### Server Configuration
Define MCP servers in `codi.mcp.yaml` with server name, type, command, args, and environment variables. Supports `stdio` and `http` server types.

### Built-in Server Templates
33 server templates are available in three categories: `official` (Anthropic-maintained), `vendor` (third-party), and `community`. Add a template with `codi add mcp-server <name>`. New servers added in this release: graph-code, chrome-devtools, openai-developer-docs, neon-cloud, anthropic-docs.

### Per-Agent Generation
MCP configuration is generated into each agent's native format: `.mcp.json` for Claude Code, `.cursor/mcp.json` for Cursor, and `.codex/config.toml` for Codex.

### Environment Variable Documentation
Generated MCP configs include env var setup instructions inline: `_instructions` object in JSON (Claude Code, Cursor) and inline TOML comments (Codex). A `.mcp.env.example` file is also generated alongside config files, listing all required variables.

---

## Community

### Skill Export
Package skills for distribution in four formats.

| Format | Output |
|:-------|:-------|
| `standard` | Agent Skills standard directory |
| `claude-plugin` | Claude Code plugin format |
| `codex-plugin` | Codex plugin format |
| `zip` | Portable ZIP archive |

### Contribution

`codi contribute` shares artifacts with any GitHub repository - public or private. It detects the target repo's default branch automatically and adapts the workflow based on repo state:

- **Repos with commits** - forks the target, creates a `contrib/add-<name>` branch on your fork, opens a PR to the detected default branch
- **Empty repos** - pushes an initial commit directly to the target branch (no fork or PR needed)

For private repos, ensure your GitHub token has the `repo` scope (`gh auth refresh -s repo`) and that you are a collaborator on the target repository. Codi checks access before attempting the clone and surfaces troubleshooting steps if access fails.
