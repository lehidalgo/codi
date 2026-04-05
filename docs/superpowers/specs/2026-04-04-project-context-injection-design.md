# Project Context Injection via Codebase Onboarding

**Date**: 2026-04-04
**Status**: Draft
**Category**: PLAN

## Problem

After `codi init`, generated instruction files (CLAUDE.md, .cursorrules, .windsurfrules) contain only codi-managed sections: rules, skills, agents routing, workflow guidelines. They have zero project-specific context (tech stack, architecture, key files, conventions). Agents start every session without knowing what the project does or how it is structured.

This is a common gap. Industry practice is to put project context at the top of these files so agents get immediate orientation before any rules or skills.

## Solution

Extend the existing `codi-codebase-onboarding` skill with a Phase 5 that writes a `## Project Context` section into the generated instruction files. After `codi init` completes, print a message prompting the user to run the skill inside their coding agent.

## Design

### Part 1: Skill Extension (Phase 5 in codi-codebase-onboarding)

Add Phase 5 to the existing onboarding skill template (`src/templates/skills/codebase-onboarding/template.ts`).

**Phase 5 - Persist Project Context**: Take the analysis from phases 1-3 and write a `## Project Context` section into each detected instruction file. The section contains:

1. **What this project does** - 2-3 sentence description
2. **Tech stack** - Language, framework, database, key libraries
3. **Architecture** - Pattern (monolith/microservices/monorepo), key directories and purpose
4. **Key files** - 5-10 most important files a newcomer should read first
5. **Conventions** - Naming patterns, import style, error handling approach
6. **Common commands** - Install, run, test, build

The section is wrapped with HTML comment markers so `codi generate` can identify it:

```markdown
<!-- codi:project-context:start -->
## Project Context

### What This Project Does
Brief description...

### Tech Stack
- **Language**: TypeScript
- **Framework**: Next.js 15
...

### Architecture
...

### Key Files
...

### Conventions
...

### Common Commands
...
<!-- codi:project-context:end -->
```

**Placement**: The skill inserts the section at the very top of the instruction file, before the first `##` section (e.g., before `## Project Overview`). If the file has an H1 heading, the block goes right after it.

**Detection of instruction files**: The skill checks for the following files in the project root and `.codi/` directory:
- `CLAUDE.md` (Claude Code)
- `.cursorrules` (Cursor)
- `.windsurfrules` (Windsurf)
- `AGENTS.md` (OpenAI Codex / multi-agent)
- `.claude/CLAUDE.md` (project-level Claude Code)

The skill reads each file, checks if a `<!-- codi:project-context:start -->` block already exists. If it does, the skill replaces the content between the markers. If not, it inserts the block after the first H1 heading.

**Target length**: Under 50 lines total for the project context section. Concise and scannable.

**Anti-patterns for Phase 5**:
- Do not duplicate the README content
- Do not list every dependency - focus on 5-10 most important
- Do not include sensitive information (API keys, internal URLs)
- Do not include information that changes frequently (version numbers, deploy dates)

### Part 2: Generator Merge Protection

The generator (`src/core/generator/generator.ts`) already has a conflict resolution system that triggers when the incoming generated content differs from the existing file. This system supports:
- Accept incoming (overwrite)
- Keep current (skip)
- Interactive merge (hunk-by-hunk)
- Editor merge (opens $EDITOR with conflict markers)
- Auto merge (apply non-overlapping changes)

**What needs to change**: The generator must detect the `<!-- codi:project-context:start/end -->` markers in the existing instruction file and preserve that section in the newly generated content before conflict comparison.

Implementation approach:
1. In `generator.ts`, after the adapter generates the instruction file content but before conflict detection, read the existing file
2. If the existing file contains `<!-- codi:project-context:start -->...<!-- codi:project-context:end -->`, extract that block
3. Inject the extracted block into the newly generated content at the same position (before the first `##` section)
4. Now when the conflict resolver compares old vs new, the project context section is identical on both sides - no conflict on that section
5. If the user has also edited other parts of the generated file, those changes still trigger the conflict resolver as normal

**Key files to modify**:
- `src/core/generator/generator.ts` - Add project-context preservation logic before conflict detection
- `src/utils/project-context-preserv.ts` (new) - Extract/inject functions for the marker-based sections

**Marker constants** (add to `src/constants.ts`):
```typescript
export const PROJECT_CONTEXT_START = "<!-- codi:project-context:start -->";
export const PROJECT_CONTEXT_END = "<!-- codi:project-context:end -->";
```

### Part 3: Post-Init Prompt

After `codi init` completes successfully, print a next-steps message.

**File to modify**: `src/cli/init.ts` - Add a log message after the success return path, or modify the `formatHuman` output for the init command.

**Message**:
```
Next step: run /codi-codebase-onboarding inside your coding agent
to add project-specific context to your configuration files.
```

This message prints only when:
- Init completed successfully
- The output format is human (not JSON)
- At least one instruction file was generated

### Part 4: Documentation

Update the following files:

1. **README.md** - Add a "Project Context" section under the Getting Started / Post-Installation area explaining the onboarding step
2. **Codi documentation** (if applicable) - Document the project context markers, the preservation mechanism, and how to manually edit the section

## Files to Create or Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/templates/skills/codebase-onboarding/template.ts` | Modify | Add Phase 5 |
| `src/core/generator/generator.ts` | Modify | Add project-context preservation before conflict detection |
| `src/utils/project-context-preserv.ts` | Create | Extract/inject functions for marker-based sections |
| `src/constants.ts` | Modify | Add marker constants |
| `src/cli/init.ts` | Modify | Add post-init prompt message |
| `tests/unit/utils/project-context-preserv.test.ts` | Create | Unit tests for extract/inject |
| `tests/unit/core/generator/generator-context.test.ts` | Create | Integration test for preservation during generate |

## Verification

1. Run `codi init` on a test project - confirm post-init message prints
2. Run `/codi-codebase-onboarding` inside Claude Code - confirm it writes `## Project Context` section into CLAUDE.md with correct markers
3. Run `codi generate` after project context exists - confirm the section is preserved (no conflict triggered for that section)
4. Run `codi generate` after manually editing a rule - confirm the conflict resolver triggers for the edited rule but not for the project context section
5. Run `/codi-codebase-onboarding` again - confirm it replaces the existing project context (update scenario)
6. Run existing onboarding tests - confirm phases 1-4 still work as before
