# Codi Onboarding Feature Audit
- **Date**: 2026-04-17 08:50 UTC
- **Document**: 20260417_085014_[AUDIT]_codi-onboarding-design-quality.md
- **Category**: AUDIT
- **Scope**: how codi onboards a project — `codi init`, `codi onboard`, the `codebase-onboarding` skill, the `onboarding-guide` agent, `detectStack`, `manifest.project_context`, and the preserve-on-regen mechanism.
- **Evidence**: `/tmp/codi-onboarding-map.md`; Anthropic docs (https://code.claude.com/docs/en/memory, https://code.claude.com/docs/en/best-practices, https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/sub-agents); AGENTS.md spec (https://agents.md/).

---

## Executive Summary

The onboarding design makes **one good architectural bet** and **carries three structural problems** that reduce its value. The good bet: delegate project-specific content extraction to the coding agent (via a skill) rather than building brittle parsers in TypeScript. This is the correct way to leverage an LLM. The problems: (1) two parallel onboarding paths exist that overlap in purpose, (2) `manifest.project_context` is a ghost field with a reader but no writer, (3) AGENTS.md consumers get a half-implementation.

**Severity at a glance**

| # | Finding | Severity | Fix cost |
|---|---------|----------|----------|
| 1 | `manifest.project_context` is dead storage — schema + type + one reader (claude-code only), zero writers | HIGH | Low |
| 2 | Two overlapping onboarding artifacts: `codi-onboarding-guide` (agent, 55 LOC) and `codi-codebase-onboarding` (skill, 247 LOC) — unclear which is canonical | HIGH | Low |
| 3 | AGENTS.md (Codex adapter) skips `buildProjectContext` — the skill works around it via preserve-markers, creating dual sources of truth | HIGH | Low |
| 4 | `codi onboard` CLI is a stdout printer — it does nothing the skill doesn't already do | MEDIUM | Low |
| 5 | `detectStack` is existence-only — no framework, version, or monorepo detection; its output doesn't feed CLAUDE.md | MEDIUM | Medium |
| 6 | No staleness detection — project-context block rots silently when `package.json`/`pyproject.toml` changes | MEDIUM | Medium |
| 7 | No integration/delineation vs. Claude Code native `/init` — users will run both and get inconsistent results | MEDIUM | Low |
| 8 | Skill writes duplicate blocks into every instruction file (CLAUDE.md, .cursorrules, .windsurfrules, AGENTS.md) — drift risk across agents | MEDIUM | Medium |
| 9 | `importAgentsMd()` migration utility is orphaned — no CLI wires it up | LOW | Low |
| 10 | Skill's Phase 5 inserts before first `##` — works with current CLAUDE.md shape but fragile to structural changes | LOW | Low |

---

## 1. What onboarding actually does today

From the evidence map:

```
codi init                          codi onboard
  ↓                                   ↓
scaffolds .codi/                   prints playbook to stdout
calls detectStack (existence-only)    (agent reads it + follows)
writes codi.yaml (no project_context)
prints "run /codi-codebase-onboarding"

        ↓
/codi-codebase-onboarding  (skill, 247 LOC, 6 phases)
  Phase 1: reads package.json/pyproject.toml/go.mod/Cargo.toml/pom.xml
  Phase 2: architecture analysis
  Phase 3: convention detection
  Phase 4: produces inline guide (<100 lines)
  Phase 5: writes between <!-- codi:project-context:start --> / :end -->
           into CLAUDE.md, .cursorrules, .windsurfrules, AGENTS.md
  Phase 6: writes .codi/rules/project-commands.md (managed_by: user)
           runs codi generate

        ↓
codi generate
  preserves marker-delimited block from existing file
  re-injects before first ##
  renders claude-code.ts → ## Project Context from manifest.project_context (NOT read by the skill path)
```

**Two independent mechanisms populate the same conceptual field**:
1. The *skill path*: writes directly into instruction files between markers (what actually happens).
2. The *adapter path*: reads `manifest.project_context` and renders `## Project Context` (what the schema suggests, but nothing writes to it).

They don't conflict only because `manifest.project_context` is never set. The day anyone sets it, they'll get *two* project-context sections.

---

## 2. Findings

### HIGH — F1. `manifest.project_context` is dead storage

**Evidence.**
- Schema: `src/schemas/manifest.ts:24` declares `project_context: z.string().optional()`.
- Type: `src/types/config.ts:27` declares the TS field.
- Readers: `src/adapters/claude-code.ts:117` + `src/adapters/section-builder.ts:204-208` (renders `## Project Context`).
- Writers: **zero** anywhere in `src/`. No CLI command, no scaffolder, no skill, no agent writes it.

**Why it matters.** Two separate outcomes, both bad:
- If a user manually sets `project_context` in `codi.yaml` AND runs the skill, they get **two** "Project Context" sections (one from the adapter, one from the preserved marker block).
- If no one uses the field, it's cargo-culted schema surface. The plan doc (`docs/20260411_220211_[PLAN]_codi-self-awareness.md:151`) even admits "Layer C (`project_context`) is wired only into the `claude-code` adapter for now" — the "for now" never completed.

**Fix.** Pick one:
- **(a) Delete the field**: remove from schema/type, delete `buildProjectContext` caller in claude-code.ts. The skill-path marker block is sufficient.
- **(b) Make it the single source of truth**: the skill writes to `manifest.project_context`, `codi generate` renders it from there, the preserve-on-regen mechanism becomes unnecessary for this section. Higher design coherence but more refactor.

Recommendation: **(a)** unless F3 triggers (b). The marker-block mechanism already solves the "preserve user edits" problem cleanly.

---

### HIGH — F2. Two overlapping onboarding artifacts

**Evidence.**
- Agent: `src/templates/agents/onboarding-guide.ts` — 55 lines. Frontmatter description: "onboarding new developers… concise guide covering architecture, key modules, conventions, and local setup steps." Body is a 4-phase prompt (Reconnaissance → Architecture → Conventions → Output). **Produces only inline text — no file writes.**
- Skill: `src/templates/skills/codebase-onboarding/template.ts` — 220 lines in SKILL.md. Description overlaps heavily. **6-phase workflow that writes files.**

**Why it matters.**
- The agent description "onboarding new developers" competes with the skill description "After running `codi init`" for dispatch. Claude Code's subagent dispatcher and skill dispatcher both key on descriptions — overlapping triggers mean nondeterministic routing.
- The agent produces inline text only; the skill writes persistent files. A user asking "help me onboard" might get either — one leaves no trace, the other modifies 4+ files. Very different outcomes.
- The skill also ships an `agents/onboarding-guide.md` (19 lines) inside its directory — a *third* onboarding artifact nested inside the skill. The skill bundles its own copy of the agent.

**Fix.** Collapse to one of these:
- **(a) Skill only**: the skill is the real onboarding workflow. Delete the top-level `onboarding-guide` agent. The nested `agents/onboarding-guide.md` inside the skill is fine — skills can bundle agents.
- **(b) Agent calls skill**: keep the agent but have it invoke the skill. Makes the natural-language trigger ("onboard me") resolve cleanly.

Recommendation: **(a)**. The agent is a lightweight duplicate.

---

### HIGH — F3. AGENTS.md gets a half-implementation

**Evidence.**
- `src/adapters/codex.ts:67` declares `instructionFile: "AGENTS.md"`.
- Codex adapter at `src/adapters/codex.ts:91-139` builds the file and does **not** call `buildProjectContext` (contrast `claude-code.ts:117`).
- The skill Phase 5 *does* write between markers into AGENTS.md.
- The preserve-on-regen mechanism (`src/core/generator/generator.ts:89-112`) runs for **every** adapter's instruction file, so the skill-written block survives regen in AGENTS.md.

**Net effect.** AGENTS.md receives project context via the skill path, but not via the adapter path. CLAUDE.md receives it via **both** paths. Asymmetric.

**Why it matters.**
- Inconsistent behavior between adapters contradicts codi's marketing: "unified AI agent configuration".
- Codex/Cursor/Windsurf/Cline users who set `manifest.project_context` get nothing. Only Claude Code users do.
- AGENTS.md is adopted by OpenAI Codex, Cursor, Aider, VS Code, GitHub Copilot (https://agents.md/). Missing project_context there weakens the cross-tool story.

**Fix.** If F1 fix option (a) is chosen (delete the field), every adapter already receives project context uniformly via the skill/marker path. Problem dissolves. If option (b) is chosen, wire `buildProjectContext` into codex/cursor/windsurf/cline adapters.

---

### MEDIUM — F4. `codi onboard` CLI is a stdout printer

**Evidence.** Full body of `src/cli/onboard.ts` is 14 lines. The action handler is `() => { process.stdout.write(renderOnboardingGuide()); }`. It writes nothing, detects nothing, scaffolds nothing. The playbook it prints tells the coding agent to run `codi init/add/generate` — all of which can already be triggered by the skill or by natural language.

**Why it matters.** Three paths now do onboarding work:
1. `codi init` (actual scaffolding)
2. `codi onboard` (prints instructions)
3. `/codi-codebase-onboarding` (skill — the real workflow)

New users face a choice matrix with no good guidance on which to pick. Anthropic's best practice: simplicity — single obvious entry point.

**Fix.** Either (a) delete `codi onboard` and have `codi init` print the "run the skill next" pointer (already done at `src/cli/init.ts:671`), or (b) make `codi onboard` actually invoke the skill through a bridge (harder — requires agent integration). Recommendation: **(a)**. Delete the command, update docs to say: "after `codi init`, your agent will run the onboarding skill automatically."

---

### MEDIUM — F5. `detectStack` is existence-only and its output is wasted on CLAUDE.md

**Evidence.** `src/core/hooks/stack-detector.ts` defines `STACK_INDICATORS` mapping 14 marker files to language tags. All checks are `fs.access` / `readdir` — **no file contents parsed**. Output is `string[]` of language tags (e.g. `["typescript", "python"]`).

Callers use the result for:
- Hook installation (`cli/init.ts:132`, `cli/generate.ts:137`, `cli/hooks.ts:23`)
- Command center banner (`cli/hub.ts:142`)
- Wizard UI (`cli/init-wizard.ts:51`)

**The result never reaches CLAUDE.md.** The skill re-reads the same files in Phase 1, more deeply (it parses them). TypeScript detector effort is spent; skill duplicates the work with richer output.

**Why it matters.** If the stack were identified in code once and fed into the manifest (e.g., `manifest.stack: ["typescript", "python"]`), the adapter could render a concise `## Stack` section, and the skill would only need to fill in frameworks/commands/conventions. Today the skill does everything from scratch.

**Fix (optional).** Extend `detectStack` to also detect framework markers (Next.js via `next.config.*`, Django via `manage.py`, FastAPI via imports in `main.py`, etc.) and package manager (`pnpm-lock.yaml` vs `package-lock.json` vs `yarn.lock`). Store the result in a new `manifest.stack` field. The claude-code adapter renders `## Stack`. The skill augments with deeper conventions. This is a real architectural improvement but not strictly needed — the skill works today.

---

### MEDIUM — F6. No staleness detection

**Evidence.** The skill runs once. Nothing in `src/core/` detects drift between `<!-- codi:project-context -->` content and the current state of `package.json`/`pyproject.toml`/`go.mod`.

**Why it matters.** Claude Code warns (https://code.claude.com/docs/en/best-practices) that stale CLAUDE.md content is a primary cause of incorrect agent behavior. After a `pnpm add next@16` or a migration from Django to FastAPI, the project-context block quietly lies to every future session.

**Fix options.**
- **(a) Lightweight**: `codi doctor --onboarding` (or just `codi doctor`) compares marker-block modification time vs. stack-marker-file modification time; warns when the block is older than any detected marker.
- **(b) Proactive**: hook on `codi generate` — if staleness detected, print a one-line warning "project-context may be out of date; re-run /codi-codebase-onboarding".

Recommendation: **(b)**. Near-zero cost; prevents silent rot.

---

### MEDIUM — F7. No delineation vs. Claude Code native `/init`

**Evidence.** Grep of `docs/` and `README*` for `/init` references finds **zero** mentions of Anthropic's native `/init` command. The `init` references point to codi's own `codi init` or `[PLAN]_codi-init.md` docs.

**What Anthropic's `/init` does.** Scans the repo, writes a CLAUDE.md with detected conventions. It is the default onboarding experience for Claude Code.

**Why it matters.** A user with a codi-managed project who types `/init` in Claude Code will get an AI-generated CLAUDE.md that overwrites the codi-generated one (subject to user confirmation). They will then wonder why `codi generate` complains / overwrites it back. There is no conflict handling or guidance.

**Fix.** Document the interaction clearly. Either:
- **(a)** "If you have codi, don't run `/init` — run `/codi-codebase-onboarding` instead (same outcome, preserves codi's managed blocks)."
- **(b)** Detect `/init` output and migrate it — if CLAUDE.md contains `/init`-style sections and lacks codi's marker block, prompt: "Migrate existing CLAUDE.md content into codi's managed structure?"

Recommendation: **(a)** — one doc note. **(b)** is nice-to-have.

---

### MEDIUM — F8. Skill writes duplicate blocks into every instruction file

**Evidence.** Skill Phase 5 inserts a marker block into **CLAUDE.md, .cursorrules, .windsurfrules, AGENTS.md** (whichever exist). Each file gets its own copy.

**Why it matters.** If the skill is re-run and produces a slightly different block, all four files drift independently. Worse, if a user edits CLAUDE.md to refine the context, the edit does not propagate to the other files.

**Compare to what F1 option (b) would enable.** Single source of truth in `manifest.project_context` → all adapters render it identically → no drift possible.

**Fix.** Either (a) accept the duplication (consistent with codi's current "render per adapter" pattern) and add a drift-check to `codi doctor`, or (b) take F1 option (b) and collapse to manifest-driven rendering. Recommendation: **(b)** if you're going to do F1(b); otherwise **(a)** — the drift risk is real but rare in practice because most users only have one agent enabled.

---

### LOW — F9. Orphaned migration utility

**Evidence.** `src/core/migration/agents-md.ts` exports `importAgentsMd()` that converts an existing AGENTS.md's `##` sections into `.codi/rules/<slug>.md` files. **Not wired to any CLI command.** No way to invoke from outside codi.

**Why it matters.** Dead code is misleading. Either it should be exposed (e.g., `codi init --from-agents-md`) or removed.

**Fix.** Wire it as a flag on `codi init`, or delete.

---

### LOW — F10. Marker insertion point is positionally fragile

**Evidence.** `injectProjectContext` in `src/utils/project-context-preserv.ts` inserts the preserved block **before the first `##` heading** in the newly generated content. If the CLAUDE.md structure ever changes so that a non-project-context `##` appears first (e.g., a future `## Quickstart` at the top), the block lands in the wrong place.

**Why it matters.** Low probability, high blast radius when it hits.

**Fix.** Use a named anchor rather than positional. Emit `<!-- codi:project-context:insert-here -->` in the generated content at the intended location; `injectProjectContext` replaces that anchor. Deterministic, not positional.

---

## 3. What the design gets right

Equally important — don't fix what works:

- **Agent-driven detection.** Phase 1 of the skill reads `package.json`/`pyproject.toml`/`go.mod`/`Cargo.toml`/`pom.xml` and lets the LLM synthesize. This is the correct use of an LLM — better than writing a TypeScript parser for every ecosystem. Keep.
- **Preserve-on-regen.** Marker-delimited block extraction + re-injection is elegant, language-agnostic, and user-editable. Keep. Only refine per F10.
- **Skill produces an inline guide + persistent files.** The inline guide (Phase 4, <100 lines) serves the human reader; the file writes (Phases 5–6) serve future agents. Two audiences, one skill invocation. Good.
- **`managed_by: user` on generated rule.** Phase 6 marks `.codi/rules/project-commands.md` as user-owned, which means `codi generate` won't clobber user edits. Correct.
- **`codi init` prints the next step.** `src/cli/init.ts:671` points explicitly at `/codi-codebase-onboarding`. Good discoverability.
- **Output guide length cap.** The skill tells the agent to keep the inline guide under 100 lines. This aligns with Anthropic's <200-line CLAUDE.md guidance.

---

## 4. Proposed target design

Minimal, keeps the good bets:

```
codi init
  └─ detectStack (existence-only, still feeds hook installation)
     scaffold .codi/ + codi.yaml
     print: "run /codi-codebase-onboarding"
  ❌ codi onboard (deleted — duplicate of init's pointer + skill)
  ❌ codi-onboarding-guide agent (deleted — duplicate of skill)
  ❌ manifest.project_context field (deleted — ghost storage)

/codi-codebase-onboarding (skill, unchanged workflow)
  ├─ Phase 1: parse stack markers
  ├─ Phase 2–4: synthesize + emit inline guide
  ├─ Phase 5: insert marker block into every detected instruction file
  └─ Phase 6: write .codi/rules/project-commands.md (managed_by: user)

codi generate
  preserves marker block across regen (unchanged)
  + staleness check: warn if marker file older than any stack marker   (F6)
  + uses <!-- codi:project-context:insert-here --> anchor              (F10)
```

Net outcome:
- One onboarding path (the skill).
- Zero ghost schema surface.
- Uniform behavior across CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, .clinerules.
- Built-in staleness warning prevents silent rot.

---

## 5. Concrete patch plan

All atomic, independently reversible.

| Step | Files | Change | Risk |
|------|-------|--------|------|
| 1 | `src/cli.ts`, `src/cli/onboard.ts` | Delete `codi onboard` command + registration | Very low |
| 2 | `src/core/onboard/catalog-renderer.ts` | Either delete or retain as a library function for the skill to reference | Very low |
| 3 | `src/templates/agents/onboarding-guide.ts`, `src/templates/agents/index.ts`, `src/core/scaffolder/agent-template-loader.ts` | Delete top-level onboarding-guide agent (the skill bundles its own) | Low |
| 4 | `src/schemas/manifest.ts:24`, `src/types/config.ts:27`, `src/adapters/claude-code.ts:116-120`, `src/adapters/section-builder.ts:204-209`, `src/core/docs/renderers/schema-renderers.ts:273` | Remove `project_context` field + reader + `buildProjectContext` function | Low — no writers exist, so no data loss |
| 5 | `src/utils/project-context-preserv.ts`, adapter emit sites | Add `<!-- codi:project-context:insert-here -->` anchor in generated content; `injectProjectContext` replaces anchor instead of inserting before first `##` | Low |
| 6 | `src/cli/generate.ts` or `src/core/generator/generator.ts` | Compare marker-block mtime vs. stack-marker mtimes; print warning when stale | Low |
| 7 | Tests in `tests/unit/adapters/`, `tests/unit/core/generator/`, `tests/unit/cli/` | Update for steps 1-6 | Low |
| 8 | `docs/` or README | One-paragraph note explaining codi's relationship to Claude Code's native `/init` | Very low |
| 9 (optional) | `src/cli/init.ts`, `src/core/migration/agents-md.ts` | Wire `importAgentsMd` behind `codi init --from-agents-md` — or delete | Low |

Order of operations recommended: **1 → 4 → 5 → 6 → 3** (start with the least-coupled deletions, then refactor the anchor, then add staleness). Steps 2, 7, 8, 9 in any slot.

---

## 6. References

Anthropic:
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/sub-agents

AGENTS.md convention:
- https://agents.md/

Codi evidence:
- Onboarding map: `/tmp/codi-onboarding-map.md`
- Earlier CLAUDE.md audit: `docs/20260417_082900_[AUDIT]_codi-claudemd-agent-quality.md`
- Related plan: `docs/20260411_220211_[PLAN]_codi-self-awareness.md`
- Primary code paths: `src/cli/init.ts`, `src/cli/onboard.ts`, `src/core/onboard/catalog-renderer.ts`, `src/core/hooks/stack-detector.ts`, `src/core/generator/generator.ts`, `src/utils/project-context-preserv.ts`, `src/templates/skills/codebase-onboarding/template.ts`, `src/templates/agents/onboarding-guide.ts`, `src/schemas/manifest.ts`, `src/types/config.ts`, `src/adapters/claude-code.ts`, `src/adapters/codex.ts`, `src/adapters/section-builder.ts`
