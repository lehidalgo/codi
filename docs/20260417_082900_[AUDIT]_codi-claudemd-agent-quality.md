# Codi CLAUDE.md and Agent .md Quality Audit
- **Date**: 2026-04-17 08:29 UTC
- **Document**: 20260417_082900_[AUDIT]_codi-claudemd-agent-quality.md
- **Category**: AUDIT
- **Scope**: how codi generates `CLAUDE.md` and `.claude/agents/*.md`, measured against published Anthropic guidance (https://code.claude.com/docs/en/memory, https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/best-practices) and OpenAI Agents SDK / AGENTS.md conventions (https://openai.github.io/openai-agents-python/agents/, https://agents.md/).

---

## Executive Summary

Codi generates correct, schema-valid artifacts, but the **CLAUDE.md it ships is ~2.5x the size Anthropic recommends and contains two large tables (Available Agents, Skill Routing) that duplicate information Claude already discovers automatically**. That duplication is not neutral — per Anthropic's own docs, bloat actively degrades rule adherence. The agent `.md` templates themselves are well-formed and within best-practice ranges; the problem is concentrated in `CLAUDE.md`.

**Severity at a glance**

| # | Finding | Severity | Fix cost |
|---|---------|----------|----------|
| 1 | CLAUDE.md is 246 lines / ~5.7k tokens; Anthropic targets <200 lines | HIGH | Low |
| 2 | `## Skill Routing` (66 rows, ~2.7k tokens) duplicates the skill discovery mechanism | HIGH | Low |
| 3 | `## Available Agents` (22 rows, ~1.1k tokens) duplicates the subagent discovery mechanism | HIGH | Low |
| 4 | `## Codi Verification` re-lists 28 rules + 65 skills + 22 agents by name (~0.8k tokens); the integrity hash doesn't need the names in the file | MEDIUM | Low |
| 5 | Regenerated timestamp on every `codi generate` causes noise in diffs / commit history | MEDIUM | Low |
| 6 | No AGENTS.md bridge — OpenAI/Codex/Cursor users get nothing; Anthropic explicitly says to import AGENTS.md when both coexist | MEDIUM | Medium |
| 7 | Skill Routing extractor splits on `\.\s` so newlines inside skill descriptions create mid-table row breaks | LOW | Low |
| 8 | Agent template bodies range 40–127 lines; Anthropic's official examples are 20–30. Acceptable but room to tighten the longer ones | LOW | Medium |
| 9 | Non-standard frontmatter keys (`managed_by`, `version`) in `.codi/` copies — correctly stripped in `.claude/` output | INFO | — |

Everything below is evidence-backed from code paths in the repo and verbatim quotes from the vendor docs.

---

## 1. What Anthropic actually says CLAUDE.md is for

Direct quotes, all from https://code.claude.com/docs/en/memory and https://code.claude.com/docs/en/best-practices:

> "CLAUDE.md files: instructions you write to give Claude persistent context"

> "Size: target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence."

> "Keep it concise. For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it. **Bloated CLAUDE.md files cause Claude to ignore your actual instructions!**"

> "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost."

Anthropic's published include/exclude table (https://code.claude.com/docs/en/best-practices):

| Include | Exclude |
|---|---|
| Bash commands Claude can't guess | Anything Claude can figure out by reading code |
| Code style rules that differ from defaults | Standard language conventions Claude already knows |
| Testing instructions and preferred test runners | Detailed API documentation (link to docs instead) |
| Repository etiquette (branch naming, PR conventions) | Information that changes frequently |
| Architectural decisions specific to your project | **Long explanations or tutorials** |
| Developer environment quirks (required env vars) | **File-by-file descriptions of the codebase** |
| Common gotchas or non-obvious behaviors | Self-evident practices like "write clean code" |

**Critical mechanism**: skills and subagents have their own `description` fields that Claude Code loads at session start for matching. From https://code.claude.com/docs/en/skills:

> "Skill descriptions are loaded into context so Claude knows what's available. All skill names are always included."

From https://code.claude.com/docs/en/sub-agents:

> "Claude automatically delegates tasks based on the task description in your request, the `description` field in subagent configurations, and current context."

And Anthropic states the design intent of skills explicitly (https://code.claude.com/docs/en/best-practices):

> "CLAUDE.md is loaded every session, so only include things that apply broadly. For domain knowledge or workflows that are only relevant sometimes, use skills instead. Claude loads them on demand without bloating every conversation."

**Implication for codi**: any list of skill/agent triggers in CLAUDE.md is, by Anthropic's own reasoning, the thing skills were designed to replace.

---

## 2. What codi currently produces

Measured on `/Users/laht/projects/codi/CLAUDE.md` at audit time.

| Section | Lines | Bytes | ~Tokens | Required? | Duplicated elsewhere? |
|---------|------:|------:|--------:|-----------|-----------------------|
| Project Overview | 1–4 | ~80 | ~20 | Yes | No |
| Self-Development Mode (codi-repo-only) | 6–74 | 3,175 | ~794 | Yes (for codi itself) | No |
| Permissions | 76–81 | ~240 | ~60 | Yes | No |
| **Available Agents** table | 83–108 | 4,312 | ~1,078 | **No** | Yes — each `.claude/agents/*.md` has its own description |
| **Skill Routing** table | 110–194 | 10,645 | ~2,661 | **No** | Yes — each skill's own `description` is auto-loaded |
| Development Notes | 196–203 | ~170 | ~43 | Yes | No |
| Workflow | 205–221 | ~670 | ~168 | Yes | No |
| Generated footer | 223 | ~60 | ~15 | Marginal | No |
| Codi Verification (+ Artifact Improvement) | 226–247 | 3,217 | ~804 | Hash yes; **name lists redundant** | Yes — same 115 names (28+65+22) as on disk |
| **Totals** | **246** | **22,657** | **~5,664** | | |

Source for the measurements: evidence report at `/tmp/codi-audit-internals.md`.

The pure-duplication slice is **Available Agents + Skill Routing + Codi Verification name lists ≈ 18,174 bytes ≈ 4,543 tokens = ~80% of the file**.

Generation path (so fixes are directly applicable):
- Composition: `src/adapters/claude-code.ts:108-140`
- Agents table builder: `src/adapters/section-builder.ts:42-52`
- Skill Routing builder: `src/adapters/section-builder.ts:55-80`
- Verification section builder: `src/core/verify/section-builder.ts:9-58`
- Verification data (name lists): `src/core/verify/token.ts:38-75`

---

## 3. Findings

### HIGH — F1. CLAUDE.md exceeds Anthropic's recommended size by 2.5×

**Evidence.** 246 lines vs. Anthropic's target of <200. ~5,664 tokens is ~3% of a 200k context window consumed on every turn, permanently. Anthropic warns this directly degrades instruction adherence.

**Why it matters.** The three rules a codi-managed repo most cares about — workflow discipline, quality self-eval, commit etiquette — are in the *last third* of the file, competing with the 15k-byte skill table for the model's attention budget.

**Fix.** Drop Available Agents + Skill Routing tables entirely (see F2/F3). Move name lists out of the verification section (see F4). Target ~120 lines.

---

### HIGH — F2. `## Skill Routing` is redundant and costs ~2.7k tokens per turn

**Evidence.**
- `buildSkillRoutingTable` in `src/adapters/section-builder.ts:55-80` renders all non-brand skills installed. Current file: 66 rows.
- Every one of those skills also ships a SKILL.md with its own `description:` frontmatter, which Claude Code auto-loads per https://code.claude.com/docs/en/skills.
- Anthropic's explicit include/exclude rule: "Anything Claude can figure out by reading code" → exclude. Skill descriptions are already readable by Claude.
- Anthropic's explicit statement: "For domain knowledge or workflows that are only relevant sometimes, use skills instead. Claude loads them on demand without bloating every conversation."

**Why it matters.** 10,645 bytes (47% of the file) duplicating data Claude already has. Worse: when skill descriptions are updated, two places have to stay in sync (the skill's own frontmatter and this table).

**Fix.** Delete `buildSkillRoutingTable` call from `src/adapters/claude-code.ts:131`. Optionally leave a one-line pointer:

```md
## Skills
This project installs Codi skills; Claude Code auto-discovers them from `.claude/skills/`. List them with `codi list --skills`.
```

---

### HIGH — F3. `## Available Agents` duplicates subagent self-description

**Evidence.**
- `buildAgentsTable` in `src/adapters/section-builder.ts:42-52` dumps every installed agent with its full description, verbatim, no filtering.
- Per https://code.claude.com/docs/en/sub-agents: "Claude automatically delegates tasks based on the task description in your request, the `description` field in subagent configurations, and current context."
- The same descriptions are already in `.claude/agents/*.md` (re-serialized by `src/adapters/claude-code.ts:188-203`). That *is* the discovery mechanism Anthropic documents.

**Why it matters.** 4,312 bytes / ~1,078 tokens of verbatim duplication that adds zero selection accuracy — Claude's subagent dispatch already reads the same text from the agent file's own frontmatter.

**Fix.** Delete `buildAgentsTable` call from `src/adapters/claude-code.ts:127`. Like F2, leave a one-line pointer to `.claude/agents/` if desired.

---

### MEDIUM — F4. `## Codi Verification` embeds 115 artifact names; the hash doesn't need them

**Evidence.** `src/core/verify/section-builder.ts:14-20` writes full `Rules: ...`, `Skills: ...`, `Agents: ...` lines. These are the inputs used by `buildVerificationData` (`src/core/verify/token.ts:38-75`) to compute the token hash — but the hash itself (`data.token`, line 12) is what's verifiable. The name lists are shown in the file for human review, not for the hash.

**Why it matters.** ~0.8k tokens on every turn for content that's already derivable from `ls .codi/{rules,skills,agents}` or a single `codi list` command. Also, every time a user installs/removes an artifact, the verification section churns.

**Fix.** Replace the three name lines with a count summary:

```md
## Codi Verification
This project uses Codi for unified AI agent configuration.
- Verification token: `codi-649e745fecd9`
- Installed: 28 rules, 65 skills, 22 agents
- Run `codi verify` to validate the integrity hash
```

Keep full lists in a machine-readable sidecar (`.codi/manifest.json` already exists for this) so `codi verify` can still compute the hash.

---

### MEDIUM — F5. `Generated:` timestamp churn on every run

**Evidence.** `src/core/verify/token.ts:64`: `const timestamp = new Date().toISOString();`. Refreshed on every `codi generate`.

**Why it matters.** The file diffs on every regeneration even when artifact content is unchanged. Commit noise; breaks idempotency of `codi generate`.

**Fix.** Drop the timestamp from the generated file. The token hash already changes if artifact content changed — that's the meaningful signal. If you want "last generated" information, put it in `.codi/manifest.json`, not in the always-loaded CLAUDE.md.

---

### MEDIUM — F6. No AGENTS.md bridge

**Evidence.**
- Anthropic's memory docs (https://code.claude.com/docs/en/memory): "Claude Code reads CLAUDE.md, not AGENTS.md. **If your repository already uses AGENTS.md for other coding agents, create a CLAUDE.md that imports it so both tools read the same instructions without duplicating them.**"
- AGENTS.md is adopted by OpenAI Codex, Cursor, Aider, VS Code, GitHub Copilot, Google Jules (https://agents.md/).
- Codi only writes `CLAUDE.md`. A user who has both Claude Code and Codex/Cursor gets two separate instruction surfaces.

**Why it matters.** Codi markets itself as "unified AI agent configuration" — the AGENTS.md gap is the biggest unification hole.

**Fix options.** (a) Generate AGENTS.md as a second adapter (`src/adapters/codex.ts` already exists — check if it handles this). (b) Or generate CLAUDE.md with `@AGENTS.md` import and put canonical content in AGENTS.md. Anthropic explicitly endorses option (b).

---

### LOW — F7. Skill-routing row extractor breaks on multi-line descriptions

**Evidence.** `extractRoutingSummary` at `src/adapters/section-builder.ts:72-80` splits on `\.\s`. It does not normalise whitespace. Visible artifacts in the current file: `codi-agent-creator` (lines 114-115), `codi-brainstorming` (119-120), `codi-audit-fix` (122-124) have mid-table newline breaks that render as broken table rows.

**Fix.** If F2 is accepted the whole function disappears. If the table stays, normalise with `.replace(/\s+/g, " ").trim()` before truncation.

---

### LOW — F8. A few agent bodies exceed Anthropic's example ranges

**Evidence.**
- Anthropic's three official subagent examples (code-reviewer, debugger, data-scientist at https://code.claude.com/docs/en/sub-agents) are 20–30 lines of markdown body.
- Codi agents range 40–127 lines. `security-analyzer.ts` (127), `code-reviewer.ts` (95) are the outliers.
- No hard limit is documented by Anthropic for subagent body length, but the research post (https://www.anthropic.com/research/building-effective-agents) states simplicity as principle #1.

**Why it matters.** Longer system prompts cost per-invocation tokens and tend to encode process detail that would be better expressed as a skill or a reference doc the agent can read.

**Fix.** Optional tightening for the outliers. Check whether long checklists (e.g., OWASP categories in `security-analyzer.ts`) belong in a referenced `references/*.md` file instead of the agent body.

---

### INFO — F9. Non-standard frontmatter in `.codi/` templates

**Evidence.** `src/templates/agents/*.ts` frontmatter includes `managed_by: ${PROJECT_NAME}` and `version: 1`. Neither appears in Anthropic's documented schema.

**Why it's fine.** They're stripped during `.codi/ → .claude/` generation at `src/adapters/claude-code.ts:188-203`. The `.claude/` output is spec-compliant.

**Minor nit.** The generator emits `tools: Read, Grep, Glob` (comma-separated string) — matches Anthropic's docs. Good.

---

## 4. What codi is doing well

Not everything is a finding. Worth noting:

- **Frontmatter schema compliance** — `.claude/agents/*.md` output uses only documented Anthropic fields (`name`, `description`, `tools`, `model`, plus documented extensions `maxTurns`, `effort`, `permissionMode`, `isolation`, `memory`, `background`, `color`). Correct.
- **`model: inherit` default** — matches Anthropic's recommendation.
- **Description style** — "Use when X. Does Y." matches Anthropic's own examples ("Use proactively when...", "Use immediately after..."). Selection will work correctly.
- **Tool allowlists per agent** — aligned with Anthropic's "grant only necessary permissions" best practice.
- **Self-dev block scoped to the codi repo** — `buildSelfDevWarning` guards on `manifest.name === "codi"`. Consumers don't see it. Good scoping.
- **Rules are name-only in CLAUDE.md** — full rule bodies live in `.claude/rules/*.md` (read by Claude Code separately). This is already the right pattern; apply it to skills/agents too.

---

## 5. Proposed target CLAUDE.md shape (~120 lines)

```
## Project Overview
(unchanged)

## Self-Development Mode
(only emitted for the codi repo itself — unchanged)

## Project Context
(user-authored block — unchanged)

## Permissions
(unchanged)

## Development Notes
(unchanged)

## Workflow
(unchanged)

## Codi Verification
This project uses Codi for unified AI agent configuration.
- Verification token: `codi-...`
- Installed: N rules, M skills, P agents
- Run `codi verify` to validate
### Artifact Improvement
(unchanged — this block is directly useful)
```

Everything the user-facing agent needs to pick the right skill/subagent is already delivered via their own description fields. Everything a developer needs to audit what's installed is in `.codi/manifest.json` and `codi list`.

---

## 6. Concrete patch plan

Small, low-risk, each reversible.

| Step | File | Change |
|------|------|--------|
| 1 | `src/adapters/claude-code.ts:127` | Remove `buildAgentsTable` call |
| 2 | `src/adapters/claude-code.ts:131` | Remove `buildSkillRoutingTable` call |
| 3 | `src/adapters/section-builder.ts:42-80` | Delete `buildAgentsTable`, `buildSkillRoutingTable`, `buildSkillRow`, `extractRoutingSummary` (dead after steps 1–2) |
| 4 | `src/core/verify/section-builder.ts:17-19` | Replace full name lists with counts |
| 5 | `src/core/verify/token.ts:64` | Drop `timestamp` field from `VerificationData`; remove from rendered section (move into `.codi/manifest.json` if still wanted) |
| 6 | (new) `src/adapters/agents-md.ts` | Add an AGENTS.md emitter for cross-agent compatibility, OR have CLAUDE.md use `@AGENTS.md` import |
| 7 | Tests in `src/adapters/__tests__/` (if present) | Update expected fixtures |

Risk: very low. Generated subagent files are untouched. Skill dispatch is untouched. Only the redundant catalog is removed.

Expected result: CLAUDE.md drops from ~246 lines / ~5.7k tokens to ~110 lines / ~2.0k tokens, while preserving every piece of guidance Anthropic says belongs in CLAUDE.md.

---

## 7. References

Anthropic:
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/sub-agents
- https://www.anthropic.com/research/building-effective-agents

OpenAI / AGENTS.md:
- https://openai.github.io/openai-agents-python/agents/
- https://openai.github.io/openai-agents-python/quickstart/
- https://agents.md/

Codi evidence:
- Internals report: `/tmp/codi-audit-internals.md`
- Research report: `/tmp/codi-audit-research.md`
- Primary code paths: `src/adapters/claude-code.ts`, `src/adapters/section-builder.ts`, `src/core/verify/section-builder.ts`, `src/core/verify/token.ts`, `src/templates/agents/*.ts`
