# Codi Learnings from the Claude Plugins Official Marketplace

- **Date**: 2026-04-21 10:31
- **Document**: 20260421_103122_[RESEARCH]_claude-plugins-marketplace-learnings.md
- **Category**: RESEARCH

## Scope

Research pass over `~/.claude/plugins/marketplaces/claude-plugins-official/`
(33 internal plugins + 15 external). The goal is to extract reusable
patterns from the Anthropic-maintained plugins and Codex ecosystem, then
propose concrete Codi features for hook-based event interception, security,
self-improvement, and best-practices enforcement.

Nothing in this document is implemented yet. This is Phase 2
(Propose) of the Understand - Search - Propose - Execute workflow.

## Plugins sampled

| Plugin | Role studied |
|---|---|
| security-guidance | PreToolUse regex reminder engine |
| hookify | Declarative hooks from Markdown + YAML |
| ralph-loop | Stop-hook self-referential loops |
| claude-md-management | Two-mode doc self-improvement |
| session-report | Transcript analyzer + HTML report |
| plugin-dev | Meta-toolkit for plugin authorship |
| skill-creator | Skill evals and performance benchmarks |
| code-review | Parallel agents + confidence filter |
| pr-review-toolkit | Specialized narrow review agents |
| feature-dev | 7-phase guided workflow |
| mcp-server-dev | MCP integration reference |
| agent-sdk-dev | Agent authoring reference |

External plugins (context7, linear, github, playwright, serena, firebase,
terraform, etc.) were inventoried for integration patterns but not deeply
analyzed for this pass.

## Observed patterns (what the marketplace does well)

### 1. Rule-to-hook compilation (security-guidance)
- `PreToolUse:Edit|Write|MultiEdit` Python script scans file paths and
  diff text against a rule catalog.
- Each rule carries a path check, substring or regex trigger, and a
  reminder string.
- Reminders are codebase-aware: they name the concrete safer alternative
  that already exists in the repo (for instance, the plugin points callers
  to `src/utils/execFileNoThrow.ts` instead of the unsafe child-process
  shell API).
- Session-scoped dedupe via `/tmp/security-warnings-log.txt` prevents the
  same reminder from firing on every edit.

### 2. Declarative user-defined hooks (hookify)
- Rules live as `.claude/hookify.*.local.md` files with YAML frontmatter.
- One generic Python engine dispatches across PreToolUse, PostToolUse,
  Stop, and UserPromptSubmit.
- Events: `bash`, `file`, `stop`, `prompt`, `all`.
- Operators: `regex_match`, `contains`, `equals`, `not_contains`,
  `starts_with`, `ends_with`.
- Fields available: `command`, `file_path`, `new_text`, `old_text`,
  `content`, `user_prompt`, `transcript`.
- Actions: `warn` (allow with message), `block` (deny).
- Bonus mode: analyze recent conversation to auto-suggest rules from
  behaviors the user corrected.

### 3. Self-referential Stop-hook loops (ralph-loop)
- A Stop hook blocks session exit based on a state file, re-feeds the
  same prompt, and breaks only when a completion-promise string appears.
- Session isolation through `session_id` match against hook input so
  concurrent sessions do not corrupt the loop state.
- State file is project-scoped Markdown with YAML frontmatter, legible
  and editable by the user.

### 4. Two-mode document self-improvement (claude-md-management)
- `claude-md-improver` skill: audits a CLAUDE.md against the current
  codebase, surfaces drift (references to removed files, outdated
  patterns, missing coverage).
- `/revise-claude-md` command: captures session learnings at the end
  of a session and folds them into CLAUDE.md.
- The two modes serve different cadences: maintenance vs. capture.

### 5. Transcript analyzer (session-report)
- Parses `~/.claude/projects/*.jsonl` for tokens, cache hit rate,
  subagents used, skills fired, and expensive prompts.
- Bundles a self-contained HTML template; the agent only produces JSON
  plus 3 to 5 one-line findings.
- Layout is pre-baked so the agent cannot accidentally restructure the
  report.

### 6. Meta-toolkit philosophy (plugin-dev)
- Seven narrow skills: hook-development, mcp-integration,
  plugin-structure, plugin-settings, command-development,
  agent-development, skill-development.
- Three support agents: `plugin-validator`, `skill-reviewer`,
  `agent-creator`.
- 8-phase guided `/create-plugin` command walks discovery to
  documentation without skipping validation.

### 7. Parallel narrow agents + confidence threshold (code-review)
- 4 agents run in parallel, each from a different lens (2 CLAUDE.md
  compliance, 1 bug hunt, 1 git blame context).
- Each issue scored 0 to 100. Threshold 80. Only high-confidence
  findings reach the PR.
- pr-review-toolkit decomposes this further into 6 single-purpose
  agents that compose on demand.

### 8. Skill performance evals (skill-creator)
- Generates eval prompts and benchmarks skill activation with variance
  analysis. Anthropic ships the measurement harness alongside the
  authoring tool.

## Design principles worth stealing

- Declarative over imperative. Markdown + YAML beats hand-written scripts
  for user-facing rules.
- Progressive disclosure. Lean core SKILL.md, detail under `references/`,
  runnable patterns under `examples/`.
- Session-scoped state keyed by `session_id` to prevent cross-session
  bleed and repeated nagging.
- Codebase-aware reminders. Naming the actual replacement file in the
  current repo is dramatically better than generic advice.
- Parallel narrow agents + confidence filter beats one monolithic
  reviewer.
- Ship the measurement harness alongside the thing measured (evals with
  skill-creator, transcripts with session-report).
- Meta-toolkits first. Anthropic built `plugin-dev` so users can build
  plugins the right way. Codi should ship the same for Codi artifacts.

## Proposals for Codi

Grouped by theme. IDs are stable so later phases can reference them.
Size estimates are rough (S = 1 to 2 days, M = 3 to 5 days, L = 1 to 2
weeks).

### A. Hook engine (highest leverage)

**A1. `codi-guardrails` generic hook engine (size: M).**
Port hookify's pattern. Rules live in `.codi/guardrails/*.md` with YAML
frontmatter. One Python 3 stdlib engine dispatches PreToolUse,
PostToolUse, Stop, and UserPromptSubmit. Emit per-agent output: Claude
`hooks.json`, Codex hook format, and a pre-commit fallback for editors
that lack hook primitives. Python matches the precedent set by every
official plugin that ships hooks.

**A2. Rule-to-hook compiler (size: M).**
Every Codi rule with BAD and GOOD examples auto-compiles into a
PreToolUse regex guardrail. Compile step runs in `codi generate`. No
hand-written Python per rule. A failed pattern match emits the rule's
GOOD example as the reminder, pointing at the actual in-repo
replacement if one is declared via a new `alternatives:` frontmatter
field.

**A3. Built-in security guardrails pack (size: M).**
Opt-in bundle shipped with Codi that covers:
- Secrets in diffs (API keys, tokens, bearer strings).
- Dangerous shell patterns (recursive force-delete on `/`, force-push
  to `main` or `master`, publish outside CI).
- SSRF-prone URL fetchers accepting unvalidated input.
- SQL string concatenation with user input.
- Edits to CLAUDE.md, AGENTS.md, or `.codi/` without explicit
  confirmation.
- PostToolUse check for PII tokens inside new log statements.

Each guardrail references the Codi rule slug that generated it, closing
the loop between rule text and enforcement.

### B. Self-improvement loop

**B1. `codi-rule-drift-audit` skill (size: S).**
Periodic scan that compares rule text against actual codebase patterns.
Flags rules that reference removed APIs, rules with no matching
patterns in the repo (candidates for demotion), and repeated patterns
in the repo with no rule coverage (candidates for promotion). Emits a
`docs/YYYYMMDD_HHMMSS_[AUDIT]_rule-drift.md` report.

**B2. `codi-skill-eval` framework (size: L).**
Generate N eval prompts per skill, run them headless in a harness,
assert which skill activated. Track trigger precision and recall over
time. Variance analysis flags skills with unstable activation. Results
feed `.codi/feedback/` so `codi-refine-rules` runs from evidence
instead of manual review.

**B3. `codi-session-report` (size: M).**
Adapt session-report's transcript parser. Surface Codi-specific
signals: which rules fired, which skills activated, user-correction
clusters per rule, agent cost breakdown, repeated mistakes, and
observation marker frequency. Render as bundled HTML. Aggregate
findings flow to `.codi/feedback/` automatically.

**B4. `/codi-loop` command (size: S).**
Port ralph-loop's Stop-hook mechanic. Use cases: TDD red-green-refactor
enforcement, audit-fix cycles, draining `.codi/feedback/` through
`codi-refine-rules`. Completion-promise string prevents runaway. State
file under `.codi/loops/<name>.local.md`.

**B5. Cross-session learning rollups (size: S).**
Weekly digest: `.codi/feedback/` to rule-level delta. Which rules
generate the most observations, which have zero activity, which
trigger overlaps repeated. Input to `codi-refine-rules`.

### C. Multi-agent review toolkit

**C1. `codi-pr-review` parallel narrow agents (size: M).**
One agent per rule category (security, performance, architecture,
testing, error handling, code style, API design, docs). Spawn in
parallel. Each scores 0 to 100. Threshold 80. Post only high-confidence
findings. Link to file:line plus the Codi rule slug that triggered the
finding. Mirrors code-review + pr-review-toolkit.

**C2. Confidence calibration (size: S).**
Track posted-comment accept and reject rate per agent over time.
Auto-tune thresholds per rule category so noisy agents self-throttle.

### D. Meta-toolkit (Codi artifact authorship)

**D1. `codi-artifact-dev` bundle (size: S).**
Consolidate existing `codi-skill-creator`, `codi-agent-creator`,
`codi-rule-creator`, add `codi-guardrail-creator` and `codi-validator`.
Single entry point: `/codi-create`.

**D2. `codi-validator` agent (size: M).**
Static analysis over `.codi/`: skill trigger overlap detection (already
flagged as a Codi rule, now automated), rule conflict detection,
version drift between source template, installed `.codi/`, and
per-agent output, progressive-disclosure compliance (SKILL.md line
budget, `references/` and `examples/` present), integrity-hash check.

### E. Codex and multi-agent event interception

**E1. Map Codex CLI hook equivalents (size: S, research first).**
Codex CLI has its own session hook system. Generate equivalent
guardrails from the same `.codi/guardrails/` source, parallel to how
Codi already fans rules out to Cursor and Kiro. Research task: confirm
Codex hook spec completeness before committing engine work.

**E2. Editor-agnostic pre-commit fallback (size: S).**
For agents without native hooks, emit a `.husky/pre-commit` or
`.pre-commit-config.yaml` that runs the same regex checks. Enforcement
wins either way.

**E3. CI guardrails mirror (size: S).**
Same `.codi/guardrails/` compiles to a GitHub Actions workflow that
runs on PRs. Defence-in-depth: local agent warns, CI blocks.

### F. Policy tiers

Current Codi rules are advisory text in the system prompt. Add
enforcement tiers to guardrails:
- `tier: advisory` - text only (today's behavior).
- `tier: soft` - PreToolUse reminder, allow.
- `tier: hard` - PreToolUse block.
- `tier: policy` - block, append to `.codi/audit-log/`, and surface in
  the next session report.

### G. Marketplace-style Codi presets

Elevate `codi add preset` to a browsable directory with preview and
install. Curated bundles (finance-strict, startup-velocity,
research-lab). Mirrors the Claude plugins marketplace UX but scoped to
Codi artifact collections.

## Suggested sequence

| Phase | Deliverables | Rationale |
|---|---|---|
| 1 | A1, A2, A3 | Foundational. Turns every existing rule into enforcement. Highest ROI because the rule catalog is already rich. |
| 2 | B2, B3, D2 | Compound-interest loop. Once running, the system refines itself from transcript evidence instead of manual review. |
| 3 | C1, E1, E2 | Review and multi-agent. Makes PR review cheap and consistent. Extends enforcement to Codex and editor-agnostic flows. |
| 4 | F, G | Enforcement tiers and marketplace. Done once B and C are paying dividends. |

## Open questions before committing

1. **Scope for the first PR**: land A1 alone (engine only, no built-in
   rules) so it can be reviewed in isolation, or land A1 + A2 + a
   minimal A3 pack in one PR to demonstrate the full loop?
2. **Codex hook surface**: do we already know the Codex PreToolUse
   equivalent, or should E1 start with a docs-only research sprint?
3. **Implementation language**: Python 3 stdlib (matches every official
   plugin that ships hooks, zero install burden) vs. TypeScript
   (matches Codi's `src/` and avoids a second language). Precedent
   favors Python.
4. **Guardrail severity default**: when A3 lands, ship every guardrail
   as `advisory`, `soft`, or `hard` by default? Advisory is the
   safest rollout; soft matches user expectation given security-guidance
   ships warnings, not blocks.
5. **Session-scoped dedupe**: mirror security-guidance's
   `/tmp/security-warnings-log.txt` approach, or store dedupe state
   under `.codi/runtime/` where it lives with the project?

## Novel Codi opportunities (not covered by any official plugin)

- **Multi-agent fan-out**: Codi already generates for Claude, Cursor,
  Kiro, Codex. Guardrails can fan out the same way, giving one source
  of truth for hook behavior across every supported agent.
- **Rule-slug traceability**: every reminder and every blocked action
  points to a Codi rule slug. Closes a gap that even security-guidance
  does not address.
- **Evidence-backed observation markers**: `[CODI-OBSERVATION: ...]`
  already exists. Tie it to guardrail triggers so the system learns
  which rules under- or over-fire without human labeling.
- **Versioned enforcement**: `version:` already lives in template
  frontmatter. Extend it to guardrails so stale installs are detected
  and flagged.

## Next steps

Await user selection of the thread to pull first. Once chosen, produce
a `[PLAN]` doc with exact file layout, frontmatter schema, and
atomic tasks.
