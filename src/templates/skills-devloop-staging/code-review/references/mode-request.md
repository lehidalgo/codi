# Mode: request

You wrote code, you want it reviewed by a fresh perspective.

## When this mode is mandatory

- After each major task in `subagent-orchestration` (review catches issues before they cascade across tasks)
- After completing a major feature (any feature spanning >1 file or >1 hour of work)
- Before merge to main
- After fixing a complex bug (regression risk is highest here)

## When this mode is optional but high-value

- When stuck (a fresh perspective often unblocks)
- Before refactoring (baseline check on understanding)
- When the diff feels uncertain ("did I miss something?")

## How to dispatch

### 1. Resolve the SHAs

```bash
BASE_SHA=$(git rev-parse HEAD~1)   # or origin/main, or whatever the comparison base is
HEAD_SHA=$(git rev-parse HEAD)
```

If the work spans multiple commits, use the merge-base of the working branch:

```bash
BASE_SHA=$(git merge-base HEAD origin/main)
```

### 2. Package the context

The reviewer subagent gets only what it needs to evaluate the work product. NEVER hand it your session's history; that pollutes the review with your reasoning.

The reviewer needs:

- `WHAT_WAS_IMPLEMENTED` — 1-2 sentence summary of the change
- `PLAN_OR_REQUIREMENTS` — the source plan (path to `[PLAN]` doc) or the success criteria the diff is meant to satisfy
- `BASE_SHA`, `HEAD_SHA` — for `git diff` and `git log`
- `DESCRIPTION` — short brief on what to focus on (e.g., "regression test coverage", "scope discipline", "deep modules")

### 3. Dispatch via Task tool with `context: fork`

Use the prompt template in `reviewer-prompt.md` filled with the placeholders above. The subagent runs in isolated context, returns structured JSON.

### 4. Parse the response

The subagent returns:

```json
{
  "strengths": ["<bullet>", "<bullet>"],
  "issues": [
    { "severity": "Critical" | "Important" | "Minor", "title": "<short>", "detail": "<file:line + explanation>" }
  ],
  "assessment": "Ready to proceed" | "Address issues first" | "Reconsider approach",
  "tokens_consumed": <integer>
}
```

### 5. Act per severity (in this order)

1. **All Critical issues**: stop other work. Fix them first. Re-run the original tests to confirm. Re-dispatch review on the fixed diff before continuing.
2. **All Important issues**: fix before transitioning to the next phase or merging. Test each fix individually.
3. **Minor issues**: note in a follow-up TODO. Do not block on these.

### 6. Push back when the reviewer is wrong

The reviewer is a subagent — it can hallucinate, miss context, or follow patterns that do not apply. When pushing back:

- Show evidence: `git log` output, file:line references, test results.
- Re-dispatch the review with additional context that clarifies why the original feedback was off.
- Or: accept the disagreement and document in the manifest as a `decision_recorded` event with the reasoning.

## Manifest events

- `subagent_dispatched` (when the reviewer is launched)
- `subagent_completed` (when the verdict returns; payload includes `tokens_consumed`)
- `subagent_failed` (if timeout or schema validation fails)
- `decision_recorded` (if you push back on feedback and the disagreement is structural)

## Integration with other skills

- After `subagent-orchestration` (future skill, mode role-based): each implementer subagent is followed by a code-review subagent in mode `request`.
- Before `verify-evidence`: code-review catches code-quality issues; verify-evidence catches behavior-vs-plan issues. Run both.
- Inside phase verify of any workflow when `.devloop/config.yaml` declares `auto_review: true`, mode `request` runs automatically.

## Red flags

Never:

- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback
- Pass your session's history to the reviewer subagent

If reviewer wrong:

- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification by re-dispatching with more context
