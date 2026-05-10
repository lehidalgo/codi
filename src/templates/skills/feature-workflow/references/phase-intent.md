# Phase: intent

<!-- BEGIN auto-generated chain — DO NOT EDIT -->

## Chain skills

- You **MUST** invoke `codi:discover`.
- Optionally, invoke `codi:step-documenter` when domain terms emerge inline.

<!-- END auto-generated chain -->

Goal: understand what to build before writing a single line of code.

## When `--from-story US-NNN` was passed

The workflow was invoked with `codi run feature --from-story US-NNN`. The init event payload carries `from_story_id`. Treat the Story as the seed, not the cage:

1. **Read the Story from the Sheet** — `codi sheets read UserStory US-NNN`. This is the agent-facing scope contract. The Story carries `as_a / i_want / so_that / acceptance_criteria / priority / elaborated_from`.
2. **Read the linked Requirement** — `codi sheets read Requirement <REQ-NNN>` if `elaborated_from` is set. Captures functional behavior or NFR thresholds the Story implies.
3. **Read source markdown** — `docs/sources/*.md` for the broader context the original spec was extracted from.
4. **Skip parts of `discover`** that the Story already answers. The Story has acceptance criteria — those ARE the success criteria. Do NOT re-elicit them.
5. **Still grill the user on gaps** — if acceptance criteria are vague, if NFRs conflict, if the Requirement implies more scope than the Story names, surface those gaps via `discover` (one question per turn).
6. **Update the Story row in the Sheet** when you commit to start. `codi sheets upsert UserStory '{"id":"US-NNN","status":"in-progress","workflow_type":"feature","branch":"<branch>","started_at":"<iso>","assigned_to":"<git email>"}'` — execution columns only, caller defaults to `execution-only`.

If the workflow was invoked WITHOUT `--from-story`, see "How to run this phase (chained skills)" below — the standard interview-driven flow applies, AND at the end of intent you should auto-create a Story row (see "Free-running Story creation" below).

## Free-running Story creation (when `--from-story` is absent)

For ad-hoc work that wasn't pre-planned via `project-workflow`, create a Story row at end of intent so the work doesn't go invisible:

```bash
codi sheets upsert UserStory '{
  "i_want": "<one-line task>",
  "as_a": "developer",
  "so_that": "<benefit, derived from intent>",
  "acceptance_criteria": "<derived from success criteria decisions>",
  "workflow_type": "feature",
  "status": "in-progress",
  "branch": "<branch>",
  "started_at": "<iso>",
  "assigned_to": "<git email>"
}'
```

The Story has no `elaborated_from` and no `parent_story` — Dashboard's "Untraced work" formula will surface it for stakeholder visibility. That's the system working as designed; ad-hoc work is captured, not invisible.

## How to run this phase (chained skills)

You **MUST** invoke `codi:discover` (mode `wide`) before producing the intent summary. The skill enforces:

- ONE question per turn (never bundle multiple questions)
- ALWAYS provide a recommended answer (no open-ended "what do you want?")
- Explore the codebase before asking — do not ask what reading the code can answer
- HARD GATE: no implementation, no phase transition, no scaffolding until the user explicitly approves the design
- Scope decomposition first — if the request describes multiple independent subsystems, surface that and decompose before refining details
- 2-3 approaches with trade-offs once enough understanding is reached
- Spec self-review for placeholders, contradictions, scope, ambiguity
- User review gate before transition

Do NOT improvise open-ended questions yourself. `discover` is mandatory for this phase. Standalone, free-form Q&A is the failure mode this phase prevents.

After `discover` completes with explicit user approval, record the resolved decisions in the manifest as `decision_recorded` events and propose transition to `plan`. Do NOT auto-write the plan markdown here — that is the responsibility of phase plan, chained with the future `plan-writing` skill.

## What you produce

By the end of this phase, the manifest has:

- A non-empty `task` (set at workflow init)
- A `decision_recorded` event capturing scope boundaries (in / out of scope)
- A `decision_recorded` event capturing success criteria (testable, observable)
- Optional `context_term_added` events if new domain terms emerged

## What you do

1. **Read the project context first**
   - `docs/CONTEXT.md` — project domain glossary
   - `docs/adr/` — architectural decisions, especially anything relating to the area you are touching
   - Recent git activity in the area: `git log --oneline -20 -- <area>`

2. **Restate the task in your own words**
   Confirm what the user wants. Show three sections:

   ```
   ## What I understand
   You want to: <restated in 2-3 sentences>

   ## What already exists
   - <file:line> — <relevance>
   - <pattern> — <how it could be reused>

   ## Open questions for the human
   - <decision question 1>
   - <decision question 2>
   ```

3. **Get answers, not assumptions**
   For each open question, get an explicit answer from the human. Do not proceed with assumed answers. Capture each resolved decision via:

   ```bash
   codi scope propose-expansion --reason "..."   # if scope grows during exploration
   ```

   or by appending a `decision_recorded` event with a clear rationale.

4. **Define success criteria**
   List what observable behavior proves the feature works. Each item must be testable.

   Examples that pass: "User can toggle theme via settings menu", "Theme preference persists across page reloads", "All existing tests still pass".
   Examples that fail: "Looks good", "Performant", "Better UX".

5. **Mark out-of-scope explicitly**
   List what the user might reasonably expect that is **not** part of this feature. Surfacing this prevents scope creep later.

6. **Write the intent summary as a `decision_recorded` event**
   Use `codi` to append:

   ```bash
   codi scope propose-expansion ...
   ```

   or directly via the manifest CLI (M1 only; M3 will wrap this).

## When to transition to plan

You are ready when:

- [ ] Task restatement is approved by the human
- [ ] Success criteria are listed and testable
- [ ] Out-of-scope items are explicit
- [ ] No open questions remain that block planning

Then propose:

```bash
codi transition --to plan
```

Wait for human approve or reject.

## Common mistakes to avoid

- Skipping the codebase read. You will plan against an imagined codebase.
- Asking generic questions. Ask about decisions, not information you can find by reading code.
- Inventing success criteria the human did not approve.
- Bundling multiple features. Each feature gets its own workflow.
