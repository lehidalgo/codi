# Skill Generation Evaluation: Codi vs Claude Code Guidelines
**Date**: 2026-03-28 12:30
**Document**: 20260328_1230_AUDIT_skill-generation-evaluation.md
**Category**: AUDIT

## 1. Introduction

This document evaluates how CODI generates skills and validates alignment with Claude Code's official skill architecture. The analysis covers the expected directory structure, how each of the five supported agents handles skills, the current CODI implementation at each stage (scaffolding, generation, export), and gaps or deviations from best practices.

## 2. Claude Code Skill Architecture Overview

According to [Claude Code official documentation](https://code.claude.com/docs/en/slash-commands), skills are the recommended format for custom agent behaviors, superseding the legacy `.claude/commands/` approach.

Key principles from the official docs:
- **Skills are directory-based**: Named by their containing directory, defined in `SKILL.md`
- **Skills bundle supporting files**: Scripts, references, and assets live alongside SKILL.md
- **Skills are dual-invocable**: Both user-triggered (`/name`) and agent-auto-discovered
- **Frontmatter controls behavior**: YAML frontmatter determines triggering, permissions, and execution mode
- **Skills replace commands**: `.claude/commands/review.md` and `.claude/skills/review/SKILL.md` both create `/review`

## 3. Expected Skill Structure (Directories and Files)

### 3.1 Official Directory Layout

```
.claude/skills/{skill-name}/
├── SKILL.md              # Required — skill definition with frontmatter + instructions
├── scripts/              # Optional — helper scripts referenced by SKILL.md
├── references/           # Optional — reference materials for the agent
├── assets/               # Optional — images, diagrams, supporting media
└── LICENSE.txt           # Optional — license for shared skills
```

### 3.2 SKILL.md Frontmatter Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Skill name (kebab-case). Becomes the `/slash-command` |
| `description` | Yes | string | Trigger description — Claude uses this to decide when to auto-load |
| `disable-model-invocation` | No | boolean | `true` = only user can invoke via `/name` |
| `user-invocable` | No | boolean | `false` = hidden from `/` menu, background knowledge only |
| `allowed-tools` | No | string[] | Tools Claude can use without permission when skill is active |
| `argument-hint` | No | string | Autocomplete hint (e.g., `[issue-number]`) |
| `model` | No | string | Override model for this skill |
| `effort` | No | string | Reasoning effort: `low`, `medium`, `high`, `max` |
| `context` | No | string | `fork` = run in isolated subagent |
| `agent` | No | string | Subagent type when `context: fork` (`Explore`, `Plan`, or custom) |
| `paths` | No | string[] | Glob patterns limiting when skill auto-activates |
| `shell` | No | string | `bash` or `powershell` for inline shell commands |

### 3.3 Advanced Features

- **`$ARGUMENTS` substitution**: Skills accept arguments via `$ARGUMENTS`, `$0`, `$1`, etc.
- **`${CLAUDE_SKILL_DIR}`**: Resolves to the directory containing SKILL.md
- **Dynamic context injection**: `` !`command` `` runs shell commands before content reaches the agent
- **Subagent execution**: `context: fork` runs the skill in an isolated subagent

## 4. Agent Requirements for Skills

### 4.1 Capability Matrix

| Feature | Claude Code | Cursor | Codex | Cline | Windsurf |
|---------|-------------|--------|-------|-------|----------|
| Skills capability | Yes | Yes | Yes | Yes | Yes |
| Progressive loading | Yes | Yes | No | No | No |
| Skill file path | `.claude/skills/` | `.cursor/skills/` | `.agents/skills/` | `.cline/skills/` | `.windsurf/skills/` |
| Skills inlined in instruction file | No | No | No | Yes | Yes |
| Separate SKILL.md files | Yes | Yes | Yes | Yes | Yes |
| Supporting files copied | Yes | Yes | Yes | Yes | Yes |
| Context tokens | 200k | 32k | 200k | 200k | 32k |
| YAML frontmatter | Full | Full | Full | Full | Full |

### 4.2 Agent-Specific Behaviors

**Claude Code** — Full skill architecture. Reads `.claude/skills/{name}/SKILL.md` with complete frontmatter. Supports `$ARGUMENTS`, `context: fork`, `allowed-tools`, and all advanced features. Progressive loading controls whether full or metadata-only content is written.

**Cursor** — Separate skill files at `.cursor/skills/`. Progressive loading is critical due to 32k token budget. Does NOT support commands or agents, making skills the primary behavior customization mechanism.

**Codex** — Skills at `.agents/skills/`. Progressive loading capability is `false` but the flag is still read and passed to `generateSkillFiles()`. Rules are inlined into `AGENTS.md`, but skills remain as separate files.

**Cline** — Dual-writes skills: inlined into `.clinerules` for immediate context AND as separate `.cline/skills/{name}/SKILL.md` files. Progressive loading switches between full inline and catalog-only table.

**Windsurf** — Same dual-write pattern as Cline. Only 32k token budget makes inlining risky with many skills. Progressive loading `metadata` mode critical for larger projects.

## 5. Current Codi Skill Implementation

### 5.1 Stage 1: Scaffolding (`codi add skill`)

**File**: `src/core/scaffolder/skill-scaffolder.ts`

When a user runs `codi add skill <name>`, `createSkill()` (line 27) creates:

```
.codi/skills/{name}/
├── SKILL.md              # From template or default content
├── evals/
│   └── evals.json        # Empty eval scaffold { skill_name, evals: [] }
├── scripts/
│   └── .gitkeep
├── references/
│   └── .gitkeep
└── assets/
    └── .gitkeep
```

**Assessment**: The scaffolder creates the **complete skeleton** including all four subdirectories. This aligns with the official structure and the user's memory note "Skill skeleton always complete — all skill dirs must always be created, even empty."

### 5.2 Stage 2: Generation (`codi generate`)

**File**: `src/adapters/skill-generator.ts`

When `codi generate` runs, `generateSkillFiles()` (line 82) produces for each agent:

```
.{agent}/skills/{name}/
├── SKILL.md              # Generated from template (full or metadata-only)
├── scripts/
│   └── .gitkeep
├── references/
│   └── .gitkeep
└── assets/
    └── .gitkeep
```

Plus any supporting files from `.codi/skills/{name}/` (scripts, references, assets) are copied, excluding evals/ and .gitkeep files.

**SKILL.md Generation** (`buildSkillMd()`, line 13):
- Emits all official frontmatter fields: name, description, disable-model-invocation, user-invocable, argument-hint, allowed-tools, model, effort, context, agent, paths, shell, license
- Correctly strips Codi-internal fields: `managed_by`, `compatibility`, `metadata-*`
- Appends skill content after frontmatter

**Metadata-Only Mode** (`buildSkillMetadataOnly()`, line 57):
- Emits only name and description
- Adds pointer: "Full skill content available at: .codi/skills/{name}/SKILL.md"

**Assessment**: The generator correctly produces the full directory skeleton with .gitkeep files and copies supporting files. Frontmatter generation is comprehensive and aligned with Claude Code's specification.

### 5.3 Stage 3: Export (`codi contribute`)

**File**: `src/cli/contribute.ts`

For ZIP export, `buildPresetPackage()` copies the entire skill directory recursively. For PR export, `artifactToTemplate()` reads SKILL.md and wraps it as a TypeScript template string.

**Assessment**: Export preserves the complete directory structure for ZIP. PR export converts to TypeScript template (single file), which is appropriate for the template registry.

## 6. Gap and Root Cause Analysis

### 6.1 No Gaps in Directory Structure

| Expected (Claude Code) | Codi Scaffolder | Codi Generator | Status |
|------------------------|-----------------|----------------|--------|
| `SKILL.md` | Yes | Yes | OK |
| `scripts/` | Yes (.gitkeep) | Yes (.gitkeep) | OK |
| `references/` | Yes (.gitkeep) | Yes (.gitkeep) | OK |
| `assets/` | Yes (.gitkeep) | Yes (.gitkeep) | OK |
| `evals/` | Yes (evals.json) | Excluded (correct) | OK |

The directory structure is **fully aligned**. The scaffolder creates the complete skeleton including evals/. The generator creates the agent-facing skeleton without evals/ (correctly, as evals are a build-time concern, not an agent concern).

### 6.2 Frontmatter Field Coverage

| Claude Code Field | Codi Support | Notes |
|-------------------|-------------|-------|
| `name` | Yes | Always emitted |
| `description` | Yes | Always emitted |
| `disable-model-invocation` | Yes | Conditional emission |
| `user-invocable` | Yes | Conditional emission |
| `allowed-tools` | Yes | Conditional emission |
| `argument-hint` | Yes | Conditional emission |
| `model` | Yes | Conditional emission |
| `effort` | Yes | Conditional emission |
| `context` | Yes | Conditional emission |
| `agent` | Yes | Conditional emission |
| `paths` | Yes | Conditional emission |
| `shell` | Yes | Conditional emission |
| `license` | Yes | Conditional emission |

All 13 official frontmatter fields are supported. Codi-internal fields (`managed_by`, `compatibility`) are correctly stripped from agent output (line 50-51 in skill-generator.ts).

### 6.3 Identified Gaps

#### Gap 1: Default Template Missing Advanced Frontmatter Guidance

**Issue**: When `codi add skill <name>` is run WITHOUT a template, the `DEFAULT_CONTENT` (skill-scaffolder.ts, line 9) produces:

```yaml
---
name: {{name}}
description: Custom skill
compatibility: []
tools: []
managed_by: user
---
```

This includes `compatibility` and `tools` (non-standard fields) but omits guidance about official fields like `disable-model-invocation`, `allowed-tools`, `context`, or `effort`.

**Root Cause**: The default was written before Claude Code's full frontmatter spec stabilized.

**Impact**: Low — users typically use `--template` or the skill-creator skill, which has comprehensive guidance.

#### Gap 2: Skill-Creator Template Incomplete Scaffold Description

**Issue**: The skill-creator skill (line 43-48) describes the scaffold as:

```
.codi/skills/<name>/
├── SKILL.md
├── evals.json
└── scripts/
```

This omits `references/` and `assets/` directories that ARE actually created by the scaffolder.

**Root Cause**: The skill-creator template documentation was written before the scaffolder was extended with all four subdirectories.

**Impact**: Medium — users following the skill-creator's guide may not realize references/ and assets/ exist and are available.

#### Gap 3: No `$ARGUMENTS` or Dynamic Context in Default Template

**Issue**: The default SKILL.md template doesn't include `$ARGUMENTS` placeholder usage or `!`command`` dynamic context injection syntax.

**Root Cause**: These are advanced features that would clutter a minimal default template.

**Impact**: Low — the skill-creator skill covers these features in detail (lines 84-141).

#### Gap 4: Progressive Loading Not Documented in Skill-Creator

**Issue**: The skill-creator skill doesn't mention progressive loading modes or how skill size affects context budget across different agents.

**Root Cause**: Progressive loading is a generation concern, not a creation concern. The skill-creator focuses on SKILL.md authoring.

**Impact**: Low — users creating skills for Cursor or Windsurf (32k budget) may write oversized skills without realizing the context impact.

#### Gap 5: Binary File Handling in Supporting Files

**Issue**: `collectSupportingFiles()` in skill-generator.ts (line 182) reads all files as UTF-8 text. Binary files (images in assets/) will be corrupted.

**Root Cause**: The function was designed for text-based supporting files (scripts, markdown references). Image/binary asset support was not considered.

**Impact**: Medium — users placing images in `assets/` for documentation purposes will find them corrupted in the generated agent directory.

## 7. Evaluation of Codi Preset Artifacts

### 7.1 Skill Creator (`src/templates/skills/skill-creator.ts`)

**Strengths**:
- Comprehensive 8-step lifecycle (Capture Intent → Scaffold → Write → Evals → Run → Grade → Optimize → Register)
- Complete frontmatter field reference (12 of 13 fields documented with explanations)
- Detailed description writing guide with BAD/GOOD examples
- Eval system with concrete format, writing rules, and grading criteria
- Script bundling guidance with the "3 or more times" extraction rule

**Weaknesses**:
- Scaffold description incomplete (missing references/ and assets/)
- No mention of progressive loading impact
- No mention of binary file limitations in assets/
- Eval runner is manual ("walk through each case step by step") — no automated eval tool exists

**Overall Assessment**: The skill-creator is the strongest artifact in the codi preset. Its 8-step lifecycle with integrated eval-driven development is more rigorous than what most skill authoring guides provide. The description optimization step (20-query trigger testing) is particularly valuable.

### 7.2 Codi Operations (`src/templates/skills/codi-operations.ts`)

References skills through the artifact lifecycle table and `codi add skill` command. Correctly points users to the skill-creator for detailed workflow. No gaps.

### 7.3 Codi Improvement (`src/templates/rules/codi-improvement.ts`)

References skills as improvable artifacts. Correctly distinguishes `managed_by: codi` vs `managed_by: user` for skill modification policy. No gaps.

## 8. Recommendations

### 8.1 Fix Skill-Creator Scaffold Description (Priority: High)

Update the scaffold description in `src/templates/skills/skill-creator.ts` (lines 43-48) to reflect the full directory structure:

```
.codi/skills/<name>/
├── SKILL.md        # The skill instructions (what the agent reads)
├── evals/
│   └── evals.json  # Test cases to verify the skill works
├── scripts/        # Optional helper scripts
├── references/     # Optional reference materials
└── assets/         # Optional images, diagrams, supporting media
```

### 8.2 Update Default Template Frontmatter (Priority: Medium)

Update `DEFAULT_CONTENT` in `src/core/scaffolder/skill-scaffolder.ts` to use standard fields:

```yaml
---
name: {{name}}
description: Describe when this skill should activate
managed_by: user
---
```

Remove the non-standard `compatibility: []` and `tools: []` fields. The `description` placeholder should prompt the user to write a proper trigger description.

### 8.3 Add Context Budget Note to Skill-Creator (Priority: Low)

Add a brief note in the Size Guidelines section about agent context budgets:

```markdown
#### Context Budget Awareness

- Claude Code and Codex have 200k token budgets — full skill content is fine
- Cursor and Windsurf have 32k budgets — keep skills concise or enable progressive_loading
- With progressive_loading: metadata, only name + description are loaded initially
```

### 8.4 Handle Binary Files in Supporting File Copy (Priority: Medium)

Update `collectSupportingFiles()` in `src/adapters/skill-generator.ts` to detect and skip binary files, or read them as Buffer instead of UTF-8 string. A simple heuristic: skip files with extensions `.png`, `.jpg`, `.gif`, `.ico`, `.woff`, `.woff2`, `.ttf`.

### 8.5 Add Automated Eval Runner (Priority: Low — Future)

The skill-creator references running evals manually. A future `codi eval` command that programmatically runs skill evals would close this gap and enable CI-driven skill quality assurance.

## 9. Conclusion

### Alignment Score

| Category | Score | Notes |
|----------|-------|-------|
| Directory structure | 10/10 | Full skeleton with all 4 subdirs + evals |
| Frontmatter fields | 10/10 | All 13 official fields supported |
| Agent compatibility | 9/10 | All 5 agents handled; binary file issue |
| Progressive loading | 9/10 | Properly implemented for Claude Code and Cursor |
| Skill-creator quality | 8/10 | Excellent lifecycle; minor doc gaps |
| Default template | 7/10 | Non-standard fields; weak description prompt |
| Export/contribution | 10/10 | Full directory preserved in ZIP; TS template for PR |

**Overall: 9/10** — CODI's skill generation is well-aligned with Claude Code's official architecture. The scaffolder creates the complete directory skeleton. The generator produces valid SKILL.md files with all official frontmatter fields and correctly strips internal metadata. Supporting files are propagated from `.codi/skills/` to agent-specific directories.

The identified gaps are minor documentation and edge-case issues, not architectural misalignments. The most impactful fix is updating the skill-creator's scaffold description to match what the scaffolder actually creates.

## Sources

- [Claude Code Slash Commands Documentation](https://code.claude.com/docs/en/slash-commands)
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [How to Build Custom Claude Code Skills](https://dev.to/alanwest/how-to-build-custom-claude-code-skills-that-actually-work-2e1f)
