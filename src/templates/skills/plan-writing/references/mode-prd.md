# Mode: prd

Synthesize the current conversation context plus codebase understanding into a Product Requirements Document. **Do NOT interview** — this mode produces a PRD from what is already known.

## Pre-conditions

- The conversation up to this point has surfaced the user's intent (e.g., a `discover` session has happened, or the user has described the feature in detail).
- `docs/CONTEXT.md` exists with the project's domain vocabulary.
- An issue tracker is configured (`.codi/config.yaml` declares one) IF the PRD will be published to the tracker; otherwise the PRD lives only as a markdown file.

## Order of operations

1. **Read the codebase** if not already explored. Use the domain glossary from `docs/CONTEXT.md` consistently in the PRD.

2. **Sketch the modules** to be built or modified. Look explicitly for opportunities to extract deep modules (small interface, rich implementation) that can be tested in isolation. Apply the deletion test on each module.

3. **Confirm modules with the user.** Show the proposed module structure and ask:

   > "Modules I'd extract: A, B, C. Of these, which need their own tests? Any modules I missed or invented?"
   > This is the only question this mode asks. It is a synthesis check, not an interview.

4. **Write the PRD.** Use `references/plan-template.md`'s "PRD template" section (or write the full template inline if standalone).

## PRD template

```markdown
# PRD: <Feature name>

| Field             | Value                         |
| ----------------- | ----------------------------- |
| Status            | draft                         |
| Date              | YYYY-MM-DD                    |
| Workflow (if any) | <workflow id or "standalone"> |

## Problem Statement

The problem the user is facing, FROM THE USER'S PERSPECTIVE. Not from the engineer's perspective.

## Solution

The solution to the problem, FROM THE USER'S PERSPECTIVE. Describe what the user can now do, not how the system implements it.

## User Stories

A LONG numbered list of user stories. Each in the format:

1. As a <actor>, I want a <feature>, so that <benefit>.

Example:

1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending.
2. As a mobile bank customer, I want to filter transactions by date range, so that I can find the one I am looking for quickly.

The list should be extensive — cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions made. May include:

- Modules to be built / modified
- Module interfaces (signatures, error modes, invariants — at the contract level)
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. PRDs go stale faster than code; pinning to file paths invalidates the PRD on the first refactor.

## Testing Decisions

- A description of what makes a good test in this codebase (test external behavior, not implementation details).
- Which modules will be tested.
- Prior art for the tests (similar tests in the existing codebase).

## Out of Scope

A list of things the PRD explicitly does NOT cover. Stakeholders need this to know what NOT to expect.

## Further Notes

Any further context or notes.
```

## Destination

- File: `docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md` (yes, `[PLAN]` category — the project naming convention does not have a `[PRD]` category; PRDs are a kind of plan).
- Optionally publish to issue tracker (gh / linear / etc.) if `.codi/config.yaml` declares one and the user explicitly approves publication. Apply the `needs-triage` label so it enters the team's normal triage flow.

## What you do NOT do in this mode

- Interview the user. The mode is synthesis-only. The single confirmation question (modules) is the only allowed dialogue.
- Include file paths or code snippets. Use module names and interface descriptions instead.
- Substitute for `mode-plan`. PRDs are stakeholder docs; plans are engineer docs. They serve different audiences.
- Skip the deep-module check. Every module proposed must be evaluated for interface/implementation depth.

## What follows

After the PRD is written and (optionally) published:

- If standalone, this is the terminal state. The user starts a workflow when ready (`codi run feature "<task>"`).
- If during a workflow phase, this mode is unusual — phase plan typically uses mode `plan`, not `prd`. If the workflow truly needs both a PRD and a plan, write the PRD first, then re-invoke `plan-writing` in mode `plan`.
