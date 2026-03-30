import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Codebase onboarding workflow. Systematically analyzes a project to produce a concise onboarding guide covering setup, architecture, conventions, and key files. Designed for new team members or AI agents.
category: Developer Tools
compatibility: [claude-code, cursor, codex]
managed_by: ${PROJECT_NAME}
---

# {{name}}

## When to Use

Use when asked to understand a new codebase, onboard to a project, or create a project overview.

## When to Activate

- User opens a new or unfamiliar project and asks for an overview
- User asks to create an onboarding guide for new team members
- User wants to understand the architecture, conventions, or key files of a codebase
- User asks what the project does, how it is structured, or how to get started
- A new AI agent needs context about the project before starting work

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

## Anti-Patterns to Avoid

- Do not read every file — sample representative files from each directory
- Do not list every dependency — focus on the 5-10 most important ones
- Do not duplicate the README — add insights the README does not cover
- Flag unknowns honestly — say "unclear" rather than guessing
- Do not generate architecture diagrams unless specifically requested

## Available Agents

For specialized analysis, delegate to these agents (see \\\`agents/\\\` directory):
- **codi-onboarding-guide** — Autonomous codebase analysis and guide generation

## Related Skills

- **codi-documentation** — Create and maintain project documentation
`;
