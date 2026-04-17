import {
  PROJECT_CLI,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
  SKILL_CATEGORY,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Codebase onboarding workflow. Use when exploring an unfamiliar project,
  creating an onboarding guide, setting up project context for future agent
  sessions, or persisting a Project Context block into CLAUDE.md / AGENTS.md /
  .cursorrules. Also activate for phrases like "new to this codebase", "first
  time in this repo", "orient me", "onboard me", "what does this project do",
  "project overview", "get started with this codebase", "set up project
  context", "set up CLAUDE.md". Analyzes architecture, conventions, and key
  files to produce a concise guide for new team members or AI agents. Do NOT
  activate for fixing bugs, writing new code, single-file reviews, or
  dependency tracing — those have dedicated skills.
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 22
---

# {{name}} — Codebase Onboarding

## When to Activate

- User opens a new or unfamiliar project and asks for an overview
- User asks to create an onboarding guide for new team members
- User wants to understand the architecture, conventions, or key files of a codebase
- User asks what the project does, how it is structured, or how to get started
- A new AI agent needs context about the project before starting work
- User wants a persistent Project Context block in CLAUDE.md / AGENTS.md
- After running \\\`${PROJECT_CLI} init\\\` to add project-specific context to the generated configuration files

## Skip When

- User wants a specific bug fixed — use ${PROJECT_NAME}-debugging
- User wants a single-file or PR review — use ${PROJECT_NAME}-code-review
- User wants to trace callers or a dependency graph — use ${PROJECT_NAME}-codebase-explore
- User wants new code written — use ${PROJECT_NAME}-plan-writer
- User wants to run tests or check coverage — use ${PROJECT_NAME}-test-suite

## Onboarding Process

### Phase 1: Reconnaissance

**[CODING AGENT]** Gather project fundamentals:

1. Read the package manifest to identify the project:
   - \\\`package.json\\\`, \\\`pyproject.toml\\\`, \\\`go.mod\\\`, \\\`Cargo.toml\\\`, \\\`pom.xml\\\`
   - Extract: name, version, description, main dependencies
2. Detect the primary language and framework
3. Find entry points:
   - \\\`main\\\` or \\\`bin\\\` fields in manifest
   - \\\`src/index.*\\\`, \\\`src/main.*\\\`, \\\`app.*\\\`
   - CLI entry points, server startup files
4. Map the top-level directory structure (2 levels deep max)
5. Check for existing documentation: README, CONTRIBUTING, docs/

### Phase 2: Architecture Analysis

**[CODING AGENT]** Identify the system architecture:

1. **Tech stack**: language, framework, database, message queue, cache
2. **Architecture pattern**: identify which applies:
   - Monolith (single deployable unit)
   - Microservices (multiple services with separate deployments)
   - Monorepo (multiple packages in one repository)
   - Library/SDK (consumed by other projects)
   - CLI tool (command-line interface)
3. **Key directories**: what each top-level directory contains
4. **Data flow**: trace a typical request from entry to response
   - HTTP request → router → controller → service → repository → database
   - CLI command → parser → handler → output
5. **Configuration**: how the app is configured (env vars, config files, flags)

### Phase 3: Convention Detection

**[CODING AGENT]** Detect project conventions from existing code:

1. **Naming**: file naming (kebab-case, camelCase), variable naming, class naming
2. **Code patterns**: check 3-5 representative files for:
   - Import ordering and grouping
   - Error handling approach (exceptions, Result types, error codes)
   - Logging style and levels used
   - Test file location (co-located vs separate directory)
3. **Git workflow**: examine recent commits for:
   - Commit message format (conventional commits, free-form)
   - Branch naming convention
   - PR/merge strategy (squash, merge, rebase)
4. **Tooling**: linter config, formatter config, CI/CD pipeline

### Phase 4: Produce Onboarding Guide

**[CODING AGENT]** Write a concise onboarding guide (under 100 lines) with these sections:

1. **Overview** (3-5 lines): What this project does and who uses it
2. **Quick Setup**: Commands to install, configure, and run locally
3. **Architecture**: Tech stack, key directories, data flow (use a brief list)
4. **Conventions**: Naming, patterns, commit style (bullet points)
5. **Key Files**: The 5-10 most important files a newcomer should read first
6. **Common Tasks**: How to add a feature, fix a bug, run tests

### Phase 5: Persist Project Context

**[CODING AGENT]** Write the analysis from phases 1-3 into each detected coding agent instruction file so future sessions have immediate project context.

1. Detect instruction files in the project root:
   - \\\`CLAUDE.md\\\` (Claude Code)
   - \\\`.cursorrules\\\` (Cursor)
   - \\\`.windsurfrules\\\` (Windsurf)
   - \\\`AGENTS.md\\\` (OpenAI Codex / multi-agent)
2. For each file found:
   a. Read the current content
   b. Build the Project Context block (see structure below)
   c. If the file already contains \\\`<!-- codi:project-context:start -->\\\`, replace the content between the markers with the new block
   d. If not, insert the block before the first \\\`##\\\` heading (or prepend if none)
   e. Write the updated content back to disk
3. Report which files were updated

**Project Context block structure** (keep under 50 lines total):

\\\`\\\`\\\`markdown
<!-- codi:project-context:start -->
## Project Context

### What This Project Does
2-3 sentence description from Phase 1 analysis.

### Tech Stack
- **Language**: ...
- **Framework**: ...
- **Database**: ... (omit if not applicable)
- **Key libraries**: list top 5-10

### Architecture
- **Pattern**: monolith / microservices / monorepo / library / CLI
- \\\`src/\\\` — ...describe key directories

### Key Files
- \\\`path/to/file\\\` — why it matters
- (5-10 entries maximum)

### Conventions
- File naming: kebab-case / camelCase / ...
- Imports: ...
- Error handling: ...
- Commit format: ...

### Common Commands
\\\`\\\`\\\`bash
# install / run / test / build
\\\`\\\`\\\`
<!-- codi:project-context:end -->
\\\`\\\`\\\`

**Anti-patterns for Phase 5**:
- Do not duplicate the README — add insights the README does not cover
- Do not list every dependency — top 5-10 most important only
- Do not include secrets, internal URLs, or frequently-changing values (version numbers, dates)
- Keep the block under 50 lines — it is loaded on every agent session

### Phase 6: Create Project Commands Rule

**[CODING AGENT]** Create a dedicated ${PROJECT_NAME_DISPLAY} rule file so every future agent session loads the project's common commands without searching through scripts or manifests.

1. Collect commands discovered in Phase 1:
   - \\\`package.json\\\` → \\\`scripts\\\` field: extract dev, start, test, build, lint, format, typecheck, clean
   - \\\`Makefile\\\` → parse targets (top 10)
   - \\\`pyproject.toml\\\` → \\\`[tool.taskipy.tasks]\\\` or \\\`[tool.poe.tasks]\\\`
   - \\\`Taskfile.yml\\\` → \\\`tasks\\\` keys
   - \\\`justfile\\\` → recipe names
   - Omit any command that requires manual input or exposes credentials

2. Write \\\`.codi/rules/project-commands.md\\\` with this structure:

\\\`\\\`\\\`markdown
---
name: project-commands
description: Common commands for this project — install, dev, test, build, lint
priority: medium
alwaysApply: true
managed_by: user
---

# Project Commands

## Install
\\\`\\\`\\\`bash
# e.g. pnpm install / uv sync / go mod download
\\\`\\\`\\\`

## Development
\\\`\\\`\\\`bash
# e.g. pnpm dev / python manage.py runserver
\\\`\\\`\\\`

## Testing
\\\`\\\`\\\`bash
# e.g. pnpm test / pytest / go test ./...
\\\`\\\`\\\`

## Build
\\\`\\\`\\\`bash
# e.g. pnpm build / python -m build
\\\`\\\`\\\`

## Lint & Format
\\\`\\\`\\\`bash
# e.g. pnpm lint / ruff check .
\\\`\\\`\\\`
\\\`\\\`\\\`

   - Omit sections for which no command was found
   - Max 3 commands per section
   - If a file already exists at \\\`.codi/rules/project-commands.md\\\`, replace it

3. Run \\\`codi generate\\\` (or \\\`node dist/cli.js generate\\\` for local builds) to propagate the new rule to all configured agent directories (\\\`.claude/rules/\\\`, etc.)

4. Report: "Created \\\`.codi/rules/project-commands.md\\\` and propagated via \\\`codi generate\\\`."

## Anti-Patterns to Avoid

- Do not read every file — sample representative files from each directory
- Do not list every dependency — focus on the 5-10 most important ones
- Do not duplicate the README — add insights the README does not cover
- Flag unknowns honestly — say "unclear" rather than guessing
- Do not generate architecture diagrams unless specifically requested

## Related Skills

- **${PROJECT_NAME}-documentation** — Create and maintain project documentation
`;
