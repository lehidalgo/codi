---
title: Developing on Codi
description: Contributor guide — skill template structure, dual-runtime scripts, rule scoping, auto-generated doc sections, catalog regeneration, and doc naming enforcement
sidebar:
  order: 11
---

This guide is for contributors working on the Codi source templates, the docs site, or the CLI itself. It documents the mechanisms a consumer does not see: how templates are structured on disk, how scripts work across runtimes, how rules filter by language/scope, and how the docs site stays in sync with source.

For the engine overview (three-layer pipeline, version baseline, adapters), see [How Codi Works](../../reference/architecture/).

---

## Skill template structure

Every skill under `src/templates/skills/<name>/` follows the same seven-directory layout. Most directories are optional — only `template.ts` and `index.ts` are required.

```
src/templates/skills/<name>/
├── template.ts        # REQUIRED. Exports the SKILL.md content as a template literal.
├── index.ts           # REQUIRED. Re-exports template + resolves staticDir.
├── evals/
│   └── evals.json     # Test cases with prompts and expectations
├── scripts/           # Helper scripts (see Dual-runtime scripts below)
│   ├── ts/            # TypeScript helpers (preferred in Claude Code)
│   └── python/        # Python helpers (required for Claude.ai compatibility)
├── references/        # Longer reference material loaded on demand
├── assets/            # Images, HTML viewers, binary assets
├── agents/            # Subagent prompt markdown files
├── tests/             # Integration / unit tests for application skills
└── README.md          # Setup instructions (for complex skills only)
```

### `template.ts` shape

```typescript
import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  (description following the frontmatter rules)
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
---

# {{name}} — Skill Title

## When to Activate
...

## Skip When
...
`;
```

Placeholders:

- `{{name}}` — replaced at install time with the user's chosen install slug (e.g. `codi-debugging`). Never hardcode.
- `${PROJECT_NAME}` — resolves to `"codi"` at template-compile time.
- `${PROJECT_NAME_DISPLAY}` — resolves to `"Codi"`.
- `${PROJECT_DIR}` — resolves to `".codi"`.
- `${PROJECT_CLI}` — resolves to `"codi"` (the CLI binary name).
- `${CLAUDE_SKILL_DIR}` — runtime path to the skill's install directory, used in `[[/references/...]]` link markers.

### `index.ts` shape

```typescript
import { resolveStaticDir } from "../resolve-static-dir.js";

export { template } from "./template.js";

export const staticDir = resolveStaticDir("<name>", import.meta.url);
```

`resolveStaticDir` returns the path to the skill's assets folder at runtime, or `null` if the skill has no static assets.

---

## Dual-runtime scripts

Skills run in two environments. Scripts that depend on Node.js break in one of them:

| Environment | Python | Bash / sh | TypeScript (`npx tsx`) |
|-------------|--------|-----------|------------------------|
| Claude Code (CLI / IDE) | Yes | Yes | Yes |
| Claude.ai (web / app) | Yes | Yes | **No** — Node.js unavailable |

### Rule

Any skill with executable scripts MUST ship **both** a Python and a TypeScript version. Python-only works everywhere but misses type safety. TypeScript-only breaks in Claude.ai.

### Directory layout

```
scripts/
├── ts/          # TypeScript — used in Claude Code when npx is available
└── python/      # Python — used everywhere
```

### Runtime detection pattern

Include this dispatcher in SKILL.md so the agent picks the right interpreter:

```bash
if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
  npx tsx scripts/ts/generate_xxx.ts --content content.json --output out.xxx
else
  python3 scripts/python/generate_xxx.py --content content.json --output out.xxx
fi
```

Claude Code prefers TypeScript for type safety. Claude.ai falls back to Python.

---

## Rule scoping

Rules live in `src/templates/rules/<name>.ts` and use three frontmatter fields to control when they load:

```yaml
---
name: typescript
version: 1
priority: high
alwaysApply: true          # If true, rule loads for every request
language: typescript       # Optional — load only when the language matches
scope: [src/api/**]        # Optional — load only when the file path matches
---
```

### Filter precedence

The scaffolder evaluates these fields in order:

1. If `alwaysApply: true` — load unconditionally.
2. Otherwise, if `language:` is set and matches the current request context — load.
3. Otherwise, if `scope:` globs match the current file path — load.
4. Otherwise — skip.

### Per-adapter translation

Each adapter translates these fields into its native config:

| Adapter | `language: typescript` becomes |
|---------|--------------------------------|
| Claude Code | `paths:` glob on skill frontmatter (`**/*.{ts,tsx}`) |
| Cursor | Rule file in `.cursor/rules/language/typescript.md` |
| Codex | Inlined into `AGENTS.md` with language-tagged section |

---

## Auto-generated doc sections

Several project docs in `docs/project/` contain sections that are generated from source. They are bounded by HTML comment markers:

```markdown
### Built-in Skill Templates

<!-- GENERATED:START:skill_templates -->
| Category | Skills |
|----------|--------|
| **Brand Identity** | codi-brand-creator, codi-codi-brand |
| **Code Quality** | codi-code-review, codi-dev-e2e-testing, codi-guided-qa-testing, codi-pr-review, codi-project-quality-guard, codi-refactoring, codi-security-scan, codi-session-recovery, codi-webapp-testing |
| **Codi Platform** | codi-agent-creator, codi-artifact-contributor, codi-compare-preset, codi-dev-docs-manager, codi-dev-operations, codi-preset-creator, codi-refine-rules, codi-rule-creator, codi-rule-feedback, codi-skill-creator |
| **Content Creation** | codi-content-factory |
| **Content Refinement** | codi-humanizer |
| **Creative and Design** | codi-algorithmic-art, codi-canvas-design, codi-claude-artifacts-builder, codi-frontend-design, codi-slack-gif-creator, codi-theme-factory |
| **Developer Tools** | codi-box-validator, codi-claude-api, codi-codebase-explore, codi-codebase-onboarding, codi-commit, codi-graph-sync, codi-html-live-inspect, codi-internal-comms, codi-mcp-ops, codi-mobile-development, codi-project-documentation |
| **Developer Workflow** | codi-audit-fix, codi-brainstorming, codi-branch-finish, codi-debugging, codi-evidence-gathering, codi-guided-execution, codi-plan-execution, codi-plan-writer, codi-step-documenter, codi-tdd, codi-verification, codi-worktrees |
| **File Format Tools** | codi-docx, codi-pdf, codi-pptx, codi-xlsx |
| **Planning** | codi-roadmap |
| **Productivity** | codi-audio-transcriber, codi-notebooklm |
| **Testing** | codi-test-suite |
| **Workflow** | codi-session-log |
<!-- GENERATED:END:skill_templates -->
```

### The two commands

- `codi docs --generate` — rewrites every `GENERATED:*` block from current source. Runs during CI or release prep.
- `codi docs --validate` — checks the blocks match current source and exits non-zero if stale. Safe to run in CI as a gate.

### Section inventory

| Doc | Generated sections |
|-----|--------------------|
| `docs/project/artifacts.md` | `rule_fields`, `skill_fields`, `agent_fields`, `rule_templates`, `skill_templates`, `agent_templates` |
| `docs/project/configuration.md` | `flag_catalog`, `mcp_server_templates` |
| `docs/project/architecture.md` | `adapter_list` |
| `docs/project/presets.md` | `preset_list` |
| `README.md` | `artifact_counts` |

### Writing a new generated section

1. Add an entry in `src/core/docs/sections/` describing how to compute the block body.
2. Register it in the section dispatcher.
3. Wrap the insertion point in `<!-- GENERATED:START:<id> -->` / `<!-- GENERATED:END:<id> -->` markers in the target doc.
4. Run `codi docs --generate` to populate.

Sections between markers are **overwritten entirely** on every run — never hand-edit between them.

---

## Catalog regeneration on build

The Astro docs site at `https://lehidalgo.github.io/codi/docs/` is generated from source by `codi docs --catalog`. The command:

1. Calls `resetCatalogDirs()` — wipes `docs/src/content/docs/catalog/` entirely.
2. Recreates empty subdirectories: `skills/`, `rules/`, `agents/`, `presets/`.
3. Iterates every entry in `AVAILABLE_SKILL_TEMPLATES` / `AVAILABLE_TEMPLATES` / `AVAILABLE_AGENT_TEMPLATES` / preset registry.
4. For each entry, builds a markdown file with frontmatter (for Astro content collections) and writes it.
5. Produces `catalog-meta.json` aggregating counts + categories.

### Why the reset matters

Stale catalog pages (for deleted artifacts) would otherwise linger on disk and get deployed. `resetCatalogDirs` is the cleanup mechanism — equivalent to orphan detection for the site.

### The docs build pipeline

```bash
pnpm docs:build
# Runs:
#   node dist/cli.js docs --catalog    # Regenerate catalog markdown
#   typedoc                            # API reference from TypeScript source
#   astro build                        # Compile to static site in site/docs/
#   pagefind --site site/docs ...      # Build search index
```

The GitHub Actions workflow `.github/workflows/pages.yml` runs this on every push to `main` and deploys to GitHub Pages.

---

## Docs naming validation

Every user-facing documentation file in `docs/` must match the naming convention:

```
YYYYMMDD_HHMMSS_[CATEGORY]_filename.md
```

- `YYYYMMDD_HHMMSS` — creation timestamp (no colons or spaces)
- `[CATEGORY]` — closed set: `ARCHITECTURE`, `AUDIT`, `GUIDE`, `REPORT`, `ROADMAP`, `RESEARCH`, `SECURITY`, `TESTING`, `BUSINESS`, `TECH`, `PLAN`
- `filename` — lowercase, hyphen-separated, no adjectives

The validator is `scripts/validate-docs.py`. Run it manually or via the `/validate-docs` slash command.

### Exceptions

Files inside these paths are exempt (they are generated or follow platform conventions):

- `docs/src/` — Astro content collections with their own frontmatter
- `docs/project/` — auto-generated project docs
- `docs/_site/` — build output
- `docs/superpowers/` — historical superpowers plan archive
- `docs/executions/` — step-documenter output

### Why the convention exists

Flat-directory docs with timestamp prefixes provide chronological ordering without subdirectory nesting, and the `[CATEGORY]` tag lets contributors filter with `ls docs/ | grep '\[AUDIT\]'` or similar one-liners.

---

## Running the test suite

```bash
pnpm build       # Always build first — e2e tests run against dist/cli.js
pnpm test        # Full Vitest suite (unit + integration + e2e + release)
```

Key test categories:

| Path | Purpose |
|------|---------|
| `tests/unit/` | Pure function tests. Runs against source via Vitest + TSX. |
| `tests/integration/` | Tests that exercise multiple modules. Also source-based. |
| `tests/e2e/` | Shells out to `dist/cli.js` in a temp project dir — requires a fresh build. |
| `tests/release/` | Gate checks including artifact-version-baseline drift. |

If you edit a template, the `artifact-version-baseline.test.ts` will fail unless you bump the template's `version:` field. This is the release-readiness gate described in [How Codi Works](../../reference/architecture/).

---

## Related reference

- [How Codi Works](../../reference/architecture/) — engine overview
- [Configuration](../../reference/configuration/) — directory layout, flags, manifest
- [CLI Reference](../../reference/cli-reference/) — command surface
