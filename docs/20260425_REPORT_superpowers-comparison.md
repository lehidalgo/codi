# Superpowers vs Codi Skill Library Comparison

- **Date**: 2026-04-25
- **Document**: 20260425_REPORT_superpowers-comparison.md
- **Category**: REPORT

## Executive Summary

Codi's skill library is at **rough parity or better** on most direct mappings,
but it has **two genuine missing skills** and a handful of content gaps where
the obra/superpowers SKILL.md files cover patterns Codi skips. Net verdict:
**8 Codi skills are equal/better, 4 are worse, 2 corresponding skills are
missing entirely.**

The Codi templates win on integration density (every skill cross-references
the rest of the pipeline by name), trigger surface (Codi's "Skip When"
sections are systematically more thorough), and project-specific scaffolding
(documentation conventions, MCP usage, INLINE/SUBAGENT toggle). The
superpowers templates win on **rationalization tables**, **iron-law framing**,
and **discipline reinforcement under pressure** — patterns Codi has in some
skills (tdd, debugging) but inconsistently applied to others (verification,
brainstorming, branch-finish).

The single highest-leverage gap is **dispatching-parallel-agents**: a
genuinely useful pattern with no Codi equivalent. The second-highest is
**receiving-code-review** as a standalone skill — Codi covers the topic only
inside `code-review/SKILL.md` and `pr-review/SKILL.md`, but the discipline
question of how to *react* to feedback deserves its own surface.

## Action Items - Gaps to Close

Ranked by impact. Each item is concrete and actionable.

### Priority 1 - Missing skills

1. **Add `codi-dispatching-parallel-agents` skill**
   - The superpowers version teaches a 4-step pattern (identify independent
     domains, build focused tasks, dispatch concurrently, integrate) for
     attacking 2+ unrelated failures in parallel.
   - Codi has nothing for this case. `plan-execution/SUBAGENT` mode explicitly
     forbids parallel dispatch ("Never dispatch multiple implementer subagents
     in parallel"), which is correct for plan execution but leaves the
     legitimate parallel-debug case uncovered.
   - Build it as a sibling to `codi-debugging`, triggered when Phase 1
     reveals 3+ independent failure domains. Cross-reference both skills.

2. **Add `codi-receiving-code-review` skill (or split out the section in
   `code-review/SKILL.md`)**
   - The superpowers version is a full discipline skill: forbids performative
     agreement ("You're absolutely right!"), enforces verify-before-implement,
     teaches structured pushback, distinguishes human partner vs external
     reviewer feedback, and has an iron law ("External feedback = suggestions
     to evaluate, not orders to follow").
   - Codi puts a 25-line "Receiving a Code Review" subsection inside
     `code-review/SKILL.md` (lines 144-167) and a similar one in
     `pr-review/SKILL.md`. Both are too short to enforce the discipline under
     pressure and they are buried inside skills that activate for
     *producing* reviews, not consuming them.
   - Promote it to a standalone skill `codi-receiving-code-review` with its
     own trigger ("when reviewer feedback arrives", "when a teammate comments
     on my PR"), iron-law framing, rationalization table, and explicit
     forbidden-phrase list.

### Priority 2 - Content gaps in existing skills

3. **`codi-brainstorming` is missing an iron-law statement**
   - Codi has a `## HARD GATE` section, which is good, but the wording
     ("DO NOT invoke any implementation skill...") is buried under the
     section header. The superpowers version makes the gate the *core
     principle* and frames the entire skill around it.
   - Add a `## The Iron Law` section near the top: `> NO IMPLEMENTATION
     UNTIL DESIGN IS APPROVED.` This pattern matches `tdd`, `debugging`, and
     `verification` — those skills already use it and it works.

4. **`codi-verification` is missing the "agent reports success" specific
   pattern with VCS-diff verification**
   - The superpowers version has a row in its Evidence Table for "Agent
     completed → check VCS diff, verify changes exist; not sufficient: agent
     reports 'success'."
   - Codi's table (line 70-83 of `verification/template.ts`) does include
     this row ("Agent completed | Check VCS diff..."). Actually present. No
     action needed - retract this gap.

5. **`codi-branch-finish` is missing a clear "iron-law" framing**
   - Codi has a `## Hard Gate: Tests Must Pass` section, which is correct
     functionally, but the superpowers version frames the *entire* skill
     around four enumerated options ("Verify tests → Present options →
     Execute choice → Clean up") and never lets the agent answer
     open-ended. Codi already does this in practice (see lines 67-77) but
     the framing could be tightened with an explicit `## The Iron Law` block:
     "Tests must pass before any option is offered. The user picks exactly
     one of four options, never an open-ended question."

6. **`codi-debugging` is solid; one minor gap**
   - Codi's debugging skill is *better* than superpowers' overall (it adds
     Phase 5 for MCP-powered deep diagnosis, which superpowers does not
     have). One missing piece: the superpowers version has a "Real-World
     Impact" section quantifying the difference (15-30 min systematic vs
     2-3 hour thrashing, 95% first-time fix rate vs 40%).
   - Optional addition: add a `## Real-World Impact` block at the bottom of
     `debugging/template.ts`. This is minor - low priority.

7. **`codi-plan-execution` SUBAGENT mode misses the "model economics" callout
   prominence**
   - Codi has the "Model Selection (SUBAGENT)" subsection (lines 165-170)
     which covers this, but it is buried mid-document. The superpowers
     version puts model selection up front as a first-class concern.
   - Optional: promote to a top-level section above "What Never to Do" so
     it gets read.

8. **`codi-skill-creator` is missing the explicit TDD-for-skills framing**
   - Codi's skill-creator is significantly more comprehensive (765 lines vs
     ~400 in superpowers), but it does NOT frame skill creation as TDD for
     documentation. The superpowers version maps every TDD concept to a
     skill-creation step (test case = pressure scenario, RED = baseline
     behavior, GREEN = skill written, REFACTOR = close loopholes) and has
     an iron law ("NO SKILL WITHOUT A FAILING TEST FIRST").
   - Codi has Steps 4-6 (write evals, run evals, grade and improve) which
     is the same idea operationally, but missing the framing weakens the
     discipline message. Add a `## TDD for Skills` section that maps each
     phase explicitly. This is the single most valuable addition to
     skill-creator.

### Priority 3 - Asset / supporting-file gaps

9. **No `codi-tdd/references/testing-anti-patterns.md` content audit**
   - Codi has the file referenced in `tdd/template.ts` line 286 and the file
     exists in `references/testing-anti-patterns.md`. Need to verify it
     covers the same anti-patterns as obra's (testing mock behavior, adding
     test-only methods, mocking without understanding). Read and confirm or
     extend.

10. **`codi-debugging/references/` is richer than superpowers' equivalent**
    - Codi has `condition-based-waiting.md`, `defense-in-depth.md`,
      `root-cause-tracing.md`, plus a TypeScript example. Superpowers
      mentions these as separate skills/files but Codi already bundles them.
      No action - Codi is ahead here.

## Per-Skill Comparison

### 1. brainstorming → codi-brainstorming

**Verdict: Codi BETTER (with one gap)**

- Codi has a 9-step explicit checklist with project-context exploration,
  pipeline detection, spec self-review, and a user-review gate. Superpowers
  lists 9 sequential steps in similar shape but with less explicit hand-off.
- Codi adds the **"Visual Companion"** opt-in (browser-based mockup
  rendering during brainstorming) which superpowers does not have.
- Codi adds **Pipeline Detection** (implementation / content / quality)
  which routes to the right next skill. Superpowers only routes to
  writing-plans.
- **Gap**: Superpowers' "Skip implementation until design approved" framing
  is sharper. Codi has `## HARD GATE` but lacks an `## Iron Law` heading.
  See Action Item 3.

### 2. dispatching-parallel-agents → (NO CODI EQUIVALENT)

**Verdict: Codi WORSE (missing skill)**

- The superpowers skill teaches a 4-step pattern for dispatching N
  independent agents in parallel: (a) identify independent failure domains,
  (b) construct focused per-agent prompts, (c) dispatch concurrently,
  (d) integrate.
- Codi has nothing for this. `plan-execution/SUBAGENT` explicitly forbids
  parallel dispatch (line 174-175 of `plan-execution/template.ts`).
- The pattern is genuinely useful for parallel debugging across unrelated
  test files, parallel exploration of multiple subsystems, etc.
- See Action Item 1.

### 3. executing-plans → codi-plan-execution

**Verdict: Codi BETTER**

- Codi offers two execution modes (INLINE and SUBAGENT) and forces the
  user to pick. Superpowers only has one mode (sequential).
- Codi's SUBAGENT mode includes a **two-stage review** (spec compliance
  first, then code quality), the same model the superpowers
  `subagent-driven-development` skill uses, but integrated directly into
  plan execution.
- Codi has more rigorous **stopping conditions** (line 71-78 of
  `plan-execution/template.ts`) and an explicit **"What Never to Do"** list
  (lines 173-184).
- Codi is missing the prominence of model-economics decisions. See Action
  Item 7.

### 4. finishing-a-development-branch → codi-branch-finish

**Verdict: Codi EQUIVALENT (slightly weaker iron-law framing)**

- Both skills present 4 options (merge / PR / keep / discard). Same
  workflow.
- Codi has the same hard gate ("Tests Must Pass"), the same typed-confirm
  for discard, and the same selective worktree cleanup logic.
- Both have a Quick Reference table summarizing option behavior.
- Codi adds explicit base-branch detection logic (`git merge-base`).
- See Action Item 5 for the minor framing gap.

### 5. receiving-code-review → (covered partially in codi-code-review and codi-pr-review)

**Verdict: Codi WORSE (no standalone skill)**

- Superpowers has a full discipline skill for receiving feedback with iron
  law, forbidden phrases ("You're absolutely right!"), human-vs-external
  source distinction, YAGNI check on suggestions, push-back patterns, and a
  rationalization table.
- Codi covers the topic in two 20-25 line subsections inside
  `code-review/SKILL.md` (lines 144-167) and `pr-review/SKILL.md` (lines
  200-207). The content is correct but too short and buried under skills
  that activate for the wrong direction (producing review, not consuming).
- See Action Item 2.

### 6. requesting-code-review → codi-code-review + codi-pr-review

**Verdict: Codi BETTER**

- Codi splits this into two skills: `code-review` (uncommitted diff,
  single file, local branch) and `pr-review` (full GitHub PR with `gh`
  integration, severity-ranked findings doc, posting). Superpowers has
  one skill that handles both cases more thinly.
- Codi's `pr-review` produces a **persistent markdown doc** under `docs/`
  with full Conventional Comments labels, OWASP-aligned severity, and a
  Phase 3 verification pass (claims-vs-reality + self-critique). This is
  considerably more rigorous than the superpowers version which is mostly
  a template-based dispatch to a code-reviewer subagent.
- Codi's `code-review` includes a "Receiving a Code Review" subsection
  (correctly content, wrong location - see Action Item 2).

### 7. subagent-driven-development → codi-plan-execution (SUBAGENT mode)

**Verdict: Codi EQUIVALENT (folded into plan-execution)**

- Codi treats subagent-driven development as one of two modes inside
  `plan-execution`, not a separate skill. This is a design choice with
  trade-offs: Codi keeps related workflow in one place (better
  discoverability), but the SUBAGENT mode is harder to find when the user
  literally types "subagent-driven development".
- Functional content (fresh subagent per task, two-stage review, model
  selection, blocked-status handling) is all present in Codi's SUBAGENT
  mode (lines 110-184 of `plan-execution/template.ts`).
- Both warn against parallel dispatch.
- Both require fresh context per task.

### 8. systematic-debugging → codi-debugging

**Verdict: Codi BETTER**

- Codi has 5 phases (Root Cause → Pattern → Hypothesis → Implementation →
  MCP Deep Diagnosis). Superpowers has 4. Codi's Phase 5 adds explicit
  MCP-powered diagnosis (code-graph queries, sequential thinking,
  reasoning-confirmation-execution loop) for cases where Phases 1-4 fail.
- Both have the same iron law: `NO FIXES WITHOUT ROOT CAUSE INVESTIGATION
  FIRST`.
- Both have rationalization tables, red flags lists, and "user signals
  you're doing it wrong" sections. Identical content.
- Codi's references/ directory is richer (4 reference files vs 3 mentioned
  separately in superpowers).
- One missing piece: Codi does not have a "Real-World Impact" block. See
  Action Item 6 (low priority).

### 9. test-driven-development → codi-tdd

**Verdict: Codi EQUIVALENT (matches superpowers content fidelity closely)**

- Both have the iron law ("NO PRODUCTION CODE WITHOUT A FAILING TEST
  FIRST" / "Code written before tests must be deleted").
- Both have RED-GREEN-REFACTOR with explicit verify steps after RED and
  GREEN.
- Both have rationalization tables (Codi's has 11 entries, superpowers has
  ~8).
- Both have red flags lists and "delete means delete" enforcement.
- Codi's good/bad code examples (retry function, email validation) are
  more concrete than superpowers' abstract descriptions.
- Codi's `references/testing-anti-patterns.md` is referenced explicitly.
  Verify it covers obra's anti-patterns. See Action Item 9.

### 10. using-git-worktrees → codi-worktrees

**Verdict: Codi BETTER**

- Codi adds **Path A (simple branch)** vs **Path B (worktree)** decision
  logic with explicit criteria. Superpowers always assumes worktrees.
- Codi's gitignore safety check is identical (`git check-ignore`) but with
  clearer instructions to add to `.gitignore` and commit before creating
  the worktree.
- Codi auto-detects setup commands across pnpm/npm/cargo/uv/pip/go.
  Superpowers covers the same auto-detect concept but less explicitly.
- Codi has a richer Quick Reference table (12 rows vs 5).
- Codi reports baseline test results explicitly and gates progress on
  passing.

### 11. using-superpowers → (META; skip)

**Verdict: N/A**

- Meta-skill. The WebFetch returned a refusal pattern from the small fetcher
  model, but per the user's instructions this is noted in passing only.
- Codi's equivalent meta-knowledge lives in `CLAUDE.md` (the project's
  self-development guide), not in a dedicated skill. This is the right
  pattern for Codi - the meta-instructions are about *how to work on the
  project*, not how to use a skill library.

### 12. verification-before-completion → codi-verification

**Verdict: Codi EQUIVALENT**

- Both have the same iron law: `NO COMPLETION CLAIMS WITHOUT FRESH
  VERIFICATION EVIDENCE`.
- Both have the same 5-step gate (IDENTIFY → RUN → READ → VERIFY → CLAIM).
- Both have weasel-word lists ("should", "probably", "seems"), evidence
  tables, and red flags lists.
- Codi's evidence table is slightly more detailed (10 rows vs 8) and
  includes the agent-delegation row ("Check VCS diff, verify changes
  exist"). Note: my earlier draft listed this as a gap; it is present.
  Action Item 4 retracted.

### 13. writing-plans → codi-plan-writer

**Verdict: Codi BETTER**

- Both share the iron law on no placeholders ("Every step must contain
  executable code, exact file paths, runnable verification commands").
- Codi's plan format includes a **mandatory header** for agentic workers
  pointing them to `plan-execution`, plus explicit guidance on INLINE
  vs SUBAGENT mode selection. Superpowers does not have this hand-off
  block.
- Codi's "What Complete Code Means" section enumerates explicit anti-
  patterns ("TBD", "implement later", "// ... existing code ...",
  "similar to Task N") more thoroughly than superpowers.
- Codi's pre-write self-review is a 4-step checklist (spec coverage,
  placeholder scan, type consistency, task quality). Superpowers has a
  similar but less structured review step.
- Codi additionally dispatches a `plan-document-reviewer-prompt.md`
  subagent for a final external check before presenting to the user.

### 14. writing-skills → codi-skill-creator

**Verdict: Codi BETTER (but missing TDD-for-skills framing)**

- Codi's skill-creator is 765 lines vs superpowers' ~400. Codi covers:
  11-step lifecycle (vs superpowers' less-structured TDD-mapped flow),
  explicit Capture Intent interview (questions 1-4 are blocking), runtime
  compatibility (Python+TS dual scripts for Claude.ai), evals format with
  positive AND negative cases, description optimization with 20-query
  test, skill validation pre-commit hooks, security review (programmatic
  scan + agent review), Promotion path from .codi → built-in template,
  skill import / migration workflow, application-skill testing tier
  (vitest + pytest).
- The superpowers version is more concentrated on the core insight:
  **writing skills IS test-driven development applied to documentation**.
  This framing is missing from Codi. Codi has the operational pieces
  (write evals → run evals → grade → improve) but not the explicit TDD
  mapping.
- See Action Item 8.

## Mapping Summary

| Superpower | Codi Skill | Verdict |
|---|---|---|
| brainstorming | codi-brainstorming | Codi BETTER (gap: iron-law framing) |
| dispatching-parallel-agents | (none) | Codi WORSE (missing skill) |
| executing-plans | codi-plan-execution (INLINE) | Codi BETTER |
| finishing-a-development-branch | codi-branch-finish | Codi EQUIVALENT |
| receiving-code-review | (subsection of code-review/pr-review) | Codi WORSE (no standalone skill) |
| requesting-code-review | codi-code-review + codi-pr-review | Codi BETTER |
| subagent-driven-development | codi-plan-execution (SUBAGENT) | Codi EQUIVALENT |
| systematic-debugging | codi-debugging | Codi BETTER (Phase 5 MCP) |
| test-driven-development | codi-tdd | Codi EQUIVALENT |
| using-git-worktrees | codi-worktrees | Codi BETTER (Path A/B) |
| using-superpowers | (CLAUDE.md self-dev) | N/A meta |
| verification-before-completion | codi-verification | Codi EQUIVALENT |
| writing-plans | codi-plan-writer | Codi BETTER |
| writing-skills | codi-skill-creator | Codi BETTER (gap: TDD-for-skills framing) |

Tally: **6 BETTER, 4 EQUIVALENT, 2 WORSE (missing), 1 META, 1 not counted**

## Next Steps

1. Open issues for Action Items 1 and 2 (the two missing skills) — these are
   the most user-visible gaps.
2. Schedule a follow-up to address Action Items 3, 5, 8 (iron-law/TDD
   framing) as a single content-pass commit.
3. Action Items 6, 7, 10 are nice-to-have. Skip unless time permits.
4. Action Item 9 needs an audit of the existing `testing-anti-patterns.md`
   against obra's content - quick read, possibly nothing to do.
