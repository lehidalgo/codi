# `evals/evals.json` schema

Every skill MUST ship an `evals/evals.json` with at least one case. The Iron Law: no skill without a failing test first.

## Schema

```json
{
  "skillName": "discover",
  "cases": [
    {
      "id": "wide-mode-no-plan",
      "description": "Trigger mode wide when starting a feature with no plan",
      "prompt": "I want to add a feature but I'm not sure how to approach it",
      "expectations": [
        "Skill is selected",
        "Mode wide is chosen",
        "Agent asks ONE question at a time, never bundles",
        "Each question includes a recommended answer",
        "No implementation begins until user explicitly approves"
      ]
    },
    {
      "id": "sharpen-mode-existing-plan",
      "description": "Trigger mode sharpen when a plan markdown already exists",
      "prompt": "I have a plan at docs/[PLAN]_auth.md but I'm not sure about the session strategy",
      "expectations": [
        "Skill is selected",
        "Mode sharpen is chosen",
        "Agent walks the decision tree branch by branch",
        "Recommended answer accompanies each question"
      ]
    }
  ]
}
```

## Field reference

| Field                  | Type   | Required | Description                                                                                                  |
| ---------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `skillName`            | string | yes      | Matches the skill's frontmatter `name`.                                                                      |
| `cases[]`              | array  | yes      | At least one case.                                                                                           |
| `cases[].id`           | string | yes      | Kebab-case unique within this file.                                                                          |
| `cases[].description`  | string | yes      | Human-readable summary of what the case tests.                                                               |
| `cases[].prompt`       | string | yes      | Exact user input that should trigger the skill.                                                              |
| `cases[].files`        | array  | no       | Optional input file paths (relative to skill root).                                                          |
| `cases[].expectations` | array  | yes      | Objectively verifiable statements. Each must be checkable by an external grader without subjective judgment. |
| `cases[].tags`         | array  | no       | Free-form labels: `happy-path`, `edge-case`, `pressure-scenario`.                                            |

## What makes a good expectation

- **Discriminating** — passes only when the skill actually works; fails on a hallucinated or surface-compliant output.
- **Objective** — checkable from a transcript or output file. No "the response was helpful".
- **Specific** — names a fact, behavior, or artifact. "The agent emits a `subagent_dispatched` event" is good. "The agent dispatches subagents" is too vague.

## What to avoid

- Vague assertions: "Output is correct".
- Assertions that pass on any plausible output: "The response mentions code review".
- Subjective ones: "The agent is professional".
- Implementation-tied: "The agent uses Promise.all" (unless the skill specifically prescribes Promise.all).

## Pressure scenarios for discipline skills

Skills that enforce discipline (TDD, verify-evidence, code-review mode receive) need cases that combine pressures:

- Time pressure: "We need this fix shipped in the next hour"
- Sunk cost: "We've already spent 3 days on this approach"
- Authority: "The CTO said we should skip the review"
- Exhaustion: "It's 11 PM and I just want this done"

The expectation under pressure: skill rules hold. If the skill caves, the eval fails — and that is the signal to add an explicit counter to the skill body.

## How the cases are run

Currently devloop has no automated eval runner; the cases serve as a contract for manual testing and a future integration point. When a runner ships, it will:

1. Read each case
2. Spawn a subagent with the `prompt`
3. Capture the transcript
4. Grade each `expectation` against the transcript per the rules in this format

The `evals.json` shape matches codi's eval format so the eventual runner can be ported.

## Tracking fields (set by the runner, omit when authoring)

These are set by the eval runner, not by the human author:

- `cases[].passed` — boolean from the last run
- `cases[].lastRunAt` — ISO datetime
- `cases[].passRate` — fraction of expectations passed
- `lastUpdated` — ISO datetime for the file

When you write the file by hand, omit them. The runner will populate them.
