# Project Context

This file is the canonical glossary of domain terms for Codi. Every workflow reads it. Updates happen inline during workflows, not in batch.

## Language

**Codi**:
The CLI and runtime that unifies AI coding agent configuration (Claude Code, Codex, Cursor) behind a single source of truth in `.codi/`.

**Artifact**:
A user-extensible configuration unit. Three types only: rule, skill, agent. Lives in `.codi/<type>/<name>/`.
_Avoid_: using "artifact" for hooks, runtime modules, or generated per-agent files.

**Skill**:
A markdown-defined capability that an agent can invoke. Source under `src/templates/skills/`, installed under `.codi/skills/<name>/`, generated per agent under `.claude/skills/`, `.codex/skills/`, etc.

**Rule**:
A persistent guidance document attached to all agent prompts. Source under `src/templates/rules/`, installed under `.codi/rules/<name>.md`.

**Agent**:
A specialized sub-agent definition (Explorer, Plan, security-expert, etc.). Source under `src/templates/agents/`, installed under `.codi/agents/<name>/`.

**Hook**:
A side-effect script wired into a coding agent's lifecycle (UserPromptSubmit, PreToolUse, PostToolUse, Stop). Codi ships hooks that capture events into the brain.

**Brain**:
The local SQLite database at `.codi/state/brain.db` that records prompts, turns, tool calls, captures, workflow runs, and proposals.

**Capture**:
A single `|TYPE: "verbatim"|` marker emitted by the agent and persisted to the brain by the Stop hook. Eleven canonical types (RULE, PROHIBITION, PREFERENCE, FEEDBACK, INSIGHT, OBSERVATION, DECISION, QUESTION, PROMPT, CORRECTION, DEFECT).

**Workflow**:
A brain-tracked unit of work with phases and gates. Started by `codi workflow run <type> "<task>"`; type ∈ feature, bug-fix, refactor, migration, project.

**Iron Law**:
A non-negotiable behavioral or procedural rule (1-9). Iron Law 4 = phase gates need `ok`; Iron Law 7 = git mutations need `ok`; Iron Law 9 = capture verbatim markers.

**Pipeline**:
The three-layer source-of-truth flow: `src/templates/` (source) → `.codi/<type>/<name>/` (installed) → `.claude/`, `.codex/`, etc. (generated per agent).

## Relationships

- A Codi project has one Brain.
- A Brain has many Workflows, Sessions, Captures, Tool calls.
- A Workflow has many Phases; each Phase has Gates.
- A Skill / Rule / Agent has source, installed, and generated copies (one each per coding agent).
- A Hook writes Captures into the Brain via the agent's transcript.

## Flagged ambiguities

- "Hook" — Codi ships its own hook scripts and also relies on Claude Code / Codex hook systems. Disambiguate as "codi hook" vs "agent hook" when context is unclear.
- "Generate" — `codi generate` reads from `.codi/` and writes the per-agent directories. Does NOT read from `src/templates/`. See three-layer pipeline.
