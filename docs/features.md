# Features

Complete inventory of Codi capabilities.

## Configuration Management

### Single Source of Truth
All AI agent configurations originate from a single `.codi/` directory. Rules, skills, agents, commands, flags, and MCP settings are defined once and generated into agent-specific formats.

### 8-Layer Config Resolution
Flags resolve through an ordered precedence chain, where each layer can override the previous. Conditional flags can target specific languages, frameworks, or agents.

| Layer | Source | Example |
|:------|:-------|:--------|
| 1. Organization | Org-wide defaults | Company security policy |
| 2. Team | Team overrides | Frontend team relaxes file limits |
| 3. Preset | Built-in or custom preset | `codi-strict` enforces locked flags |
| 4. Repository | `flags.yaml` in `.codi/` | Project-specific settings |
| 5. Language | Conditional on `lang` | Python enables `pyright` |
| 6. Framework | Conditional on `framework` | Next.js settings |
| 7. Agent | Conditional on `agent` | Claude-only features |
| 8. User | User-level overrides | Personal preferences |

### Drift Detection
Hash-based tracking in `state.json` detects when generated config files diverge from `.codi/` source artifacts. Configurable via the `drift_detection` flag: `off`, `warn` (default), or `error`.

### Backup and Revert
Timestamped backups are created before every generation run. Restore any previous state with `codi revert`, which lists available snapshots and rolls back the selected one.

### Audit Log
Append-only JSONL log records every generation event with timestamp, artifacts included, agent targets, and file hashes. Enables traceability and compliance auditing.

---

## Multi-Agent Support

Five agents supported via an adapter pattern. Each adapter translates the unified `.codi/` artifacts into the agent's native config format.

| Agent | Config File | Rules | Skills | Agents | Commands | MCP Config | Skill Files |
|:------|:-----------|:-----:|:------:|:------:|:--------:|:----------:|:----------:|
| Claude Code | `CLAUDE.md` | Yes | Yes | Yes | Yes | `.mcp.json` | Yes |
| Cursor | `.cursorrules` | Yes | Yes | -- | -- | `.cursor/mcp.json` | Yes |
| Codex | `AGENTS.md` | Yes | Yes | Yes | -- | `.codex/mcp.toml` | Yes |
| Windsurf | `.windsurfrules` | Yes | Yes | -- | -- | -- | Yes |
| Cline | `.clinerules` | Yes | Yes | -- | -- | -- | Yes |

---

## Automatic Config Synchronization

Codi's core value: edit artifacts once in `.codi/`, and all agent config files update automatically. The synchronization lifecycle has four stages: generate, detect drift, watch, and verify.

### Generation Pipeline

`codi generate` reads all `.codi/` artifacts (rules, skills, agents, commands, flags, MCP servers, brands) and produces agent-native config files via the adapter pattern. Each adapter transforms the unified config into the format its agent expects.

| Agent | Instruction File | Separate Artifacts | MCP Config | Settings |
|:------|:----------------|:-------------------|:-----------|:---------|
| Claude Code | `CLAUDE.md` | `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `.claude/commands/` | `.mcp.json` | `.claude/settings.json` |
| Codex | `AGENTS.md` | `.codex/agents/*.toml` | `.codex/mcp.toml` | -- |
| Cursor | `.cursorrules` | -- | `.cursor/mcp.json` | `.cursor/hooks.json` |
| Windsurf | `.windsurfrules` | `.windsurf/skills/` | -- | -- |
| Cline | `.clinerules` | `.cline/skills/` | -- | -- |

The generated instruction files include: project overview, active rules (inline or referenced), skill routing table, agent definitions, command table, MCP server list, permission restrictions, and a verification section.

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

Each `codi generate` run computes a SHA256-based verification token from the manifest name, agents, rules, skills, commands, MCP servers, and active flags. This token is embedded in every generated instruction file. Running `codi verify` echoes the token back, confirming the agent loaded the correct configuration. The `--check` mode validates an agent's response against the expected token programmatically.

---

## Artifact System

### Artifact Types

| Type | Count | Purpose |
|:-----|------:|:--------|
| Rules | 25+ | Instructions agents follow (code style, security, language conventions) |
| Skills | 40+ | Reusable workflows agents can invoke (code review, testing, document generation) |
| Agents | 20+ | Subagent definitions with specialized tools and models |
| Commands | 15+ | Slash commands users invoke (`/commit`, `/review`, `/test-run`) |
| Brands | custom | Visual identity tokens (colors, typography, logos, tone of voice) |

### Rule Templates

| Category | Count | Templates |
|:---------|------:|:----------|
| Universal | 10 | security, testing, architecture, code-style, error-handling, performance, documentation, api-design, production-mindset, simplicity-first |
| Language | 9 | TypeScript, Python, Go, Java, Kotlin, Rust, Swift, C#, React |
| Framework | 3 | Next.js, Django, Spring Boot |
| Workflow | 1 | git-workflow |

### Skill Templates

| Category | Skills |
|:---------|:-------|
| Code Quality | code-review, security-scan, test-coverage, refactoring, e2e-testing, guided-qa-testing |
| Developer Tools | commit, operations, error-recovery, compare-preset, webapp-testing |
| Platform | codebase-onboarding, mcp, mcp-server-creator, claude-api, mobile-development, agent-creator, skill-creator, command-creator |
| Content Creation | content-factory, internal-comms |
| Creative/Design | frontend-design, canvas-design, algorithmic-art, slack-gif-creator, web-artifacts-builder, theme-factory |
| Document Generation | documentation, docs-manager, doc-engine, deck-engine |
| File Format | pdf, docx, pptx, xlsx, preset-creator |
| Brand | brand-identity, contribute, rule-creator + custom brands (bbva-brand, rl3-brand) |

### Skill Routing

Skills can declare `intentHints` in their frontmatter to power a generated routing table in all agent config files:

```yaml
intentHints:
  taskType: Code Review        # Concise task label (max 50 chars)
  examples:                    # 2-4 example user prompts (max 100 chars each)
    - "Review my PR"
    - "Check code quality"
```

The routing table maps user intents to recommended skills. It appears in all 5 generated agent config files. Skills without `intentHints` fall back to a row derived from their name and description. Brand-category skills are excluded from the table.

### Agent Templates

| Category | Agents |
|:---------|:-------|
| Core (8) | code-reviewer, test-generator, security-analyzer, refactorer, docs-lookup, onboarding-guide, performance-auditor, api-designer |
| Domain (14) | codebase-explorer, ai-engineering-expert, data-analytics-bi-expert, data-engineering-expert, data-intensive-architect, data-science-specialist, legal-compliance-eu, marketing-seo-specialist, mlops-engineer, nextjs-researcher, openai-agents-specialist, payload-cms-auditor, python-expert, scalability-expert |

### Command Templates

| Category | Commands |
|:---------|:---------|
| Core (9) | commit, review, test-run, test-coverage, security-scan, refactor, onboard, docs-lookup, session-handoff |
| Workflow (7) | open-day, close-day, roadmap, check, codebase-explore, index-graph, update-graph |

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
Create, list, install, export, validate, remove, and edit presets. Distribution supports GitHub repositories, ZIP files, and a preset registry with lockfile tracking (`presets.lock.json`).

---

## CLI Operations

### Commands by Category

| Category | Command | Description |
|:---------|:--------|:------------|
| **Setup** | `init` | Interactive wizard to scaffold `.codi/` directory |
| | `add` | Add rules, skills, agents, commands, or brands |
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
| **Community** | `marketplace` | Search and install community skills |
| | `contribute` | Share artifacts via GitHub PR or ZIP export |
| | `docs` | Open documentation |

---

## Interactive Mode

### Command Center
Running `codi` with no arguments launches an interactive menu with grouped actions (Setup, Build, Monitor). Navigate with arrow keys and select to execute any command.

### Init Wizard
Four-step guided setup: select languages, choose agents, pick config mode (preset / custom / ZIP / GitHub), and select individual artifacts. Supports backward navigation with Ctrl+C.

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

| Hook | Flag | Purpose |
|:-----|:-----|:--------|
| Test runner | `test_before_commit` | Run test suite before commit |
| Secret detection | `security_scan` | Scan for leaked secrets and API keys |
| Type checking | `type_checking` | Run tsc, pyright, or equivalent |
| File size check | always enabled | Block files exceeding line limit |
| Linting/formatting | per-language | ESLint, Prettier, ruff, gofmt, etc. |

### Auto-Restage
Hooks that modify files (formatters, fixers) automatically re-stage the modified files after running, so the commit includes the formatted output.

---

## Quality and Compliance

### Validation
Schema-based validation for `codi.yaml` manifest and all artifact types (rules, skills, agents, commands). Reports specific errors with file paths and line references.

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

18 behavioral flags control agent permissions, code quality gates, and generation behavior.

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
| `max_context_tokens` | number | `50000` | Maximum context token window |
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

### Per-Agent Generation
MCP configuration is generated into each agent's native format: `.mcp.json` for Claude Code, `.cursor/mcp.json` for Cursor, and `.codex/mcp.toml` for Codex.

---

## Community and Marketplace

### Skill Export
Package skills for distribution in four formats.

| Format | Output |
|:-------|:-------|
| `standard` | Agent Skills standard directory |
| `claude-plugin` | Claude Code plugin format |
| `codex-plugin` | Codex plugin format |
| `zip` | Portable ZIP archive |

### Marketplace
Search and install community skills from a registry. Filter by name, description, or tags. Installed skills are tracked in the preset lockfile.

### Contribution
Share artifacts back to the community via GitHub PR workflow or ZIP export. The `codi contribute` command guides through the process.
