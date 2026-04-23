# Codi Hooks Optimization Roadmap for Codex and Claude Code

- **Date**: 2026-04-21 12:48
- **Document**: 20260421_124829_[ROADMAP]_codi-hooks-optimization.md
- **Category**: ROADMAP

## Purpose

Consolidate the conclusions from the Claude plugins marketplace research
and the empirical Codex vs Claude hook probe into one prioritized
optimization plan for Codi. This doc is the bridge between the
exploratory research and the eventual PLAN docs for each phase.

## Source documents

- `20260421_103122_[RESEARCH]_claude-plugins-marketplace-learnings.md`
  patterns observed across 12 internal plugins + 15 external plugins in
  the official marketplace, with proposed Codi features grouped A - G.
- `20260421_122241_[REPORT]_codex-vs-claude-hook-probe-results.md`
  empirical evidence from a probe harness exercising every candidate
  hook event on Claude Code 2.1.116 and Codex 0.118.0.

## Conclusions

### 1. Codi has a live silent regression on Codex

The codex adapter writes `.codex/hooks.json` but does not enable the
`codex_hooks` feature flag that Codex requires. On stock Codex 0.118.0,
`codex features list` reports `codex_hooks under development false`. The
heartbeat observer Codi already ships is a silent no-op for every Codex
user who has not manually enabled the flag. Evidence:
`~/codi-hook-probe/logs/probe.ndjson` showed zero Codex events on the
first run and nine events on the second run after passing
`-c features.codex_hooks=true`.

### 2. The reliable cross-agent event surface is narrower than it looked

Only `SessionStart`, `UserPromptSubmit`, `PreToolUse(Bash)`,
`PostToolUse(Bash)`, and `Stop` fire on both agents with consistent
semantics. Everything else is Claude-only in practice:

- Codex does not fire hooks for `apply patch` (file mutations).
- Codex does not fire `SessionEnd`.
- Codex may not fire `Notification`, `SubagentStop`, or `PreCompact` at
  all (untested, assume absent until proven otherwise).

Any Codi guardrail that promises portable behavior must live inside the
narrow common subset and degrade gracefully elsewhere.

### 3. Codex exposes two enforcement surfaces Codi is not using

`prefix_rule` DSL at `~/.codex/rules/*.rules` and `features.*` toggles
in `~/.codex/config.toml` are machine-checked at command invocation. They
do not rely on the model honoring a hook. Claude has no equivalent.
Defense-in-depth on Codex means compiling the same Codi rule to hooks,
`prefix_rule`, and `features` together rather than picking one.

### 4. Codi's unique leverage is cross-agent compilation

No other tool in the ecosystem ships rules to both agents from one
source. Every other plugin lives inside Claude or inside Codex.
If Codi compiles each rule down to up to five surfaces (Claude hooks,
Codex hooks, Codex prefix_rule, pre-commit, GitHub Actions CI), then a
single Markdown rule file enforces across all of them. Defense-in-depth
is the product differentiation.

## The big idea

One rule file in `src/templates/rules/` becomes enforcement on five
surfaces:

```
rules/security/no-hardcoded-secrets.md       (source)
   |
   +-- .claude/hooks.json          PreToolUse:Write|Edit (reminds, blocks)
   +-- .codex/hooks.json           PreToolUse:Bash (shell-level patterns)
   +-- .codex/config.toml          features.codex_hooks=true + prefix_rule
   +-- .husky/pre-commit           scans staged diff for secret patterns
   +-- .github/workflows/codi.yml  final gate on pull requests
```

If the model ignores the hook, sandbox catches it. If sandbox misses it,
pre-commit catches it. If the dev skipped pre-commit, CI catches it.
Every surface derives from the same rule Codi already ships.

## Roadmap

### P0 - Fix the silent regression (this week)

**Scope:** Update `src/adapters/codex.ts` so that when it writes
`.codex/hooks.json`, it also writes `features.codex_hooks = true` to
the generated `.codex/config.toml`. Add a test verifying the flag is
set whenever hooks are generated.

**Why now:** The heartbeat observer and any future hook Codi ships is
already broken on Codex without this. Zero architectural dependencies.
One-file PR.

**Effort:** 15-30 minutes.
**Impact:** Unblocks every downstream Codex hook, today and future.

### P1 - Payload normalization shim (week 1)

**Scope:** `src/core/hooks/hook-runtime.cjs` shim that every Codi
generated hook script imports. Responsibilities:

- Read stdin JSON.
- Normalize `tool_response` (Codex string vs Claude object) into
  `{ stdout, stderr, exit_code }`.
- Resolve `project_dir` from `cwd`, `CLAUDE_PROJECT_DIR`, or
  `git rev-parse --show-toplevel` in priority order.
- Populate `turn_id` with a derived value on Claude (where it is missing)
  so downstream code does not have to branch on agent.
- Expose a single `getHookContext()` function.

**Effort:** 1 day.
**Impact:** All future hook logic stops carrying per-agent branches.

### P2 - Guardrails engine on the common subset (week 2)

**Scope:** `.codi/guardrails/*.md` files with YAML frontmatter. One Codi
dispatcher per event. Support the common-subset events only:
`SessionStart`, `UserPromptSubmit`, `PreToolUse(Bash)`,
`PostToolUse(Bash)`, `Stop`. Rule-to-hook compiler: every Codi rule with
BAD and GOOD examples auto-compiles into a PreToolUse:Bash regex guard.
No hand-written Python or Node per rule.

Actions: `warn`, `block`, `policy` (block + write to `.codi/audit-log/`).

**Effort:** 3 days.
**Impact:** Every existing Codi security rule becomes enforceable on
both agents from day one.

**Dependency:** P1.

### P3 - Codex-specific compiler targets (week 2)

**Scope:** For Codex, the same `.codi/guardrails/*.md` source compiles
additionally to:

- `~/.codex/rules/codi-<slug>.rules` entries using `prefix_rule` DSL
  for shell-command allow and deny decisions.
- `~/.codex/config.toml` under `[features]` to set Codi-required flags
  and under `[projects.<path>]` for per-project trust adjustments.

This closes the `apply patch` blindspot for file mutations: even though
Codex hooks cannot intercept them, most dangerous file mutations (for
example `echo KEY >> .env`) happen via shell, which Codex sandbox
controls reach.

**Effort:** 1 day.
**Impact:** Enforcement on Codex no longer depends on the model honoring
a hook reminder.

**Dependency:** P2.

### P4 - Agent-agnostic fallback compilers (week 3)

**Scope:** Same `.codi/guardrails/*.md` source compiles to:

- `.husky/pre-commit` (or `.pre-commit-config.yaml`) scanning staged
  diffs against the same regex catalog.
- `.github/workflows/codi-guardrails.yml` running the same checks on
  every pull request.

These fire even when the agent is Cursor, Windsurf, or a human. Covers
gaps that hook-level enforcement cannot reach (for example Codex
`apply patch` today).

**Effort:** 1 day.
**Impact:** Five-surface defense-in-depth. Works across every supported
agent and on PRs.

**Dependency:** P2.

### P5 - Artifact quality upgrades (week 3 - 4)

Ported from the Claude plugins marketplace patterns.

- **Progressive-disclosure audit** of every Codi skill. SKILL.md lean,
  `references/` detailed, `examples/` runnable. Automated via a new
  `codi-validator` agent.
- **Skill-trigger overlap detector** in `codi-validator`. Codi already
  has a rule flagging overlap; automate detection at `codi generate`
  time.
- **Confidence-threshold PR review.** Port the code-review pattern:
  parallel narrow agents per rule category, 0 - 100 confidence score,
  post only items above threshold.

**Effort:** 3 days.
**Impact:** Fewer false skill activations, fewer noisy PR review
comments, better artifact quality over time.

**Dependency:** none (parallelizable with P1 - P4).

### P6 - Self-improvement loop (week 4 and beyond)

- **`codi-skill-eval`** framework. Generate N eval prompts per skill,
  run headless, assert activation. Variance analysis. Evidence feeds
  `.codi/feedback/` so `codi-refine-rules` runs on data.
- **`codi-session-report`** transcript analyzer. Parses
  `~/.claude/projects/*.jsonl` and `~/.codex/sessions/**/*.jsonl`.
  Surfaces rule activation, user-correction clusters, agent cost,
  repeated mistakes.
- **Cross-session rollups.** Weekly digest of `.codi/feedback/` with
  trend analysis.

**Effort:** 1 - 2 weeks.
**Impact:** Codi learns from its own transcripts. Rule refinement stops
being manual.

**Dependency:** P1 and P2 landed.

## Ordered roadmap table

| Rank | Phase | Deliverable | Effort | Impact | Blocking |
|---|---|---|---|---|---|
| 1 | P0 | `features.codex_hooks=true` in codex adapter | 15 min | Unblocks Codex hooks | none |
| 2 | P1 | Hook runtime normalization shim | 1 day | Removes per-agent branches | P0 |
| 3 | P2 | Guardrails engine (common-subset events) | 3 days | Rules -> hooks compile | P1 |
| 4 | P3 | Codex prefix_rule + features compiler | 1 day | Machine-enforced on Codex | P2 |
| 5 | P4 | Pre-commit + CI compilers | 1 day | Defense-in-depth | P2 |
| 6 | P5 | Quality upgrades (progressive disclosure, trigger overlap, PR review) | 3 days | Fewer false activations | none (parallel) |
| 7 | P6 | Self-improvement loop (skill-eval, session-report) | 1 - 2 weeks | Data-driven rule refinement | P1, P2 |

## Constraints locked in by the probe evidence

These rules are non-negotiable for any downstream PLAN doc:

1. Portable guardrails must not rely on `PreToolUse(Write|Edit|Read)`.
   Codex does not fire those events in 0.118.0.
2. Portable cleanup logic must trigger on `Stop`, not `SessionEnd`.
   Codex does not fire `SessionEnd`.
3. Hook scripts must not depend on `CLAUDE_PROJECT_DIR`. Always read
   `cwd` from stdin JSON first, `git rev-parse` second.
4. Hook scripts must normalize `tool_response` before use. Codex returns
   a string, Claude returns an object.
5. Codex adapter must emit `features.codex_hooks = true` whenever it
   emits `.codex/hooks.json`. Otherwise the file is a silent no-op.
6. Any Codex-side file-mutation enforcement must go through sandbox,
   `prefix_rule`, or pre-commit / CI. Hooks cannot reach `apply patch`.

## Open questions for the next phase

1. **Codex `codex_hooks` stability timeline.** The flag is marked
   `under development`. Before designing P2, check the Codex repo
   changelog for an expected stable release to avoid coupling to an
   event surface that may change. `codi-docs-lookup` task.

2. **Matcher syntax on Codex.** The probe's `Write|Edit` matcher fired
   zero events. Unclear whether matchers are silently ignored, require
   different syntax, or the events never fire. Deferred until P2
   needs it.

3. **Interactive-only events.** `Notification`, `SubagentStop`,
   `PreCompact` were not exercised. Interactive follow-up probe required
   before P5 - P6 can reason about them.

4. **P5 and P6 sequencing.** Quality upgrades (P5) are independent of
   the hook pipeline and can ship in parallel with P2 - P4, or wait
   until the engine lands. Recommend parallel to avoid long gaps in
   visible output.

## Definition of done for this roadmap

Roadmap is complete when:

- P0 - P4 have shipped and a Codi rule written as
  `src/templates/rules/<name>.md` appears on all five surfaces in a
  clean Codi project with both Claude and Codex configured.
- `.codi/guardrails/*.md` is a documented authoring pattern with
  `codi add guardrail <name>` scaffolding.
- `codi-validator` reports zero progressive-disclosure violations,
  zero trigger overlaps, zero rule conflicts on the Codi source repo.
- `codi-session-report` produces weekly HTML with rule-level delta and
  the top 10 user corrections for the week.

## Immediate next action

Approve P0. I will ship the codex-adapter fix on a feature branch,
with the flag-setting guarded by a test, and the PR will link back to
this roadmap and the REPORT doc as evidence.
