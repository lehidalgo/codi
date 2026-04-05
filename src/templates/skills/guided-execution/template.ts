import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Collaborative step-by-step execution for first-time technical processes. Use when
  the user wants to perform a setup, configuration, infrastructure task, deployment,
  or operational workflow for the first time and needs structured guidance with
  documentation at each step. Agent and user work as a team: agent reasons, plans,
  and executes what it can; user performs actions that require credentials, browser
  access, or external systems.
category: Developer Workflow
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 4
---

# {{name}}

## When to Activate

- User is performing a technical process for the first time
- Setup, configuration, environment, infrastructure, or deployment tasks
- User needs structured guidance with documentation as they go
- User wants the process documented as a reusable guide while executing it
- Any workflow where agent and user must collaborate step by step

**Skip this skill for:**
- Pure code changes within the codebase (use ${PROJECT_NAME}-plan-executor)
- Systematic audits of existing code (use ${PROJECT_NAME}-audit-fix)
- Design and planning only (use ${PROJECT_NAME}-brainstorming → ${PROJECT_NAME}-plan-writer)

## The Iron Laws

> **Never execute a step without explaining what it does, why it matters, and who does it.**
>
> **Never move to the next step without validating the current one.**
>
> **Every completed step must produce a written document.**

## The Checklist

Work through these 9 steps in order. Mark each via TaskUpdate before starting and when complete.

1. **Understand the goal** — Clarify what the user wants to achieve, current state, constraints, and starting point
2. **Build the master task list** — Decompose the goal into phases and steps using TaskCreate
3. **Present the execution plan** — Show the full plan, ownership per step, and get user approval
4. **Execute the current step** — Follow the Step Execution Protocol
5. **Validate the step** — Use ${PROJECT_NAME}-evidence-gathering and ${PROJECT_NAME}-verification
6. **Document the step** — Invoke ${PROJECT_NAME}-step-documenter
7. **Update the task list** — Mark completed, surface the next step
8. **Repeat steps 4–7** — Until all steps in the current phase are done
9. **Generate workflow summary** — Final doc linking all step docs, in docs/executions/<workflow-name>/README.md

## Step Execution Protocol

For every step, follow these 7 phases in order:

### Phase 1: Step Framing
State the goal of this step in one sentence. "In this step, we will [action] so that [outcome]."

### Phase 2: Context and Rationale
Explain in plain language why this step matters. What breaks or stays incomplete if we skip it? Write as if explaining to someone doing this for the first time.

### Phase 3: Responsibility Split
Clearly state who does what:

| Agent Does | User Does |
|-----------|-----------|
| Code changes and file creation | External service configuration and setup |
| CLI commands within the project | Commands requiring elevated credentials or access |
| Analysis, planning, documentation | Browser actions, visual confirmation |
| Reading output and interpreting results | Physical verification and authentication |
| Proposing decisions | Approving decisions |

If any action in this step requires something the agent cannot do, list it explicitly as a "User Action Required" item.

### Phase 4: Action Instructions
Give precise, numbered instructions for every action in the step. Include:
- Exact commands to run (the agent runs what it can; the user runs what requires their environment)
- Expected output or result for each action
- What to do if the output is unexpected

Never give vague instructions like "configure the database." Give exact steps: which file, which value, which command.

### Phase 5: Feedback Loop
If the user must perform an action, explicitly ask for the result:
"Please [action]. When done, paste the output here."

Wait for the user's response before proceeding. Do not assume success.

### Phase 6: Validation
Invoke ${PROJECT_NAME}-evidence-gathering to confirm the step's intended outcome is achieved.
Then invoke ${PROJECT_NAME}-verification for the completion claim.
If validation fails, enter Troubleshooting Mode (see below).

### Phase 7: Step Closure
Summarize the result in one paragraph.
Invoke ${PROJECT_NAME}-step-documenter to generate the step document.
Show the user: "Step N complete. Document written to docs/executions/<workflow>/step-NN-<slug>.md"

## Troubleshooting Mode

When a step fails validation:

1. Do not move to the next step.
2. State clearly: "Step N validation failed. Entering troubleshooting mode."
3. Invoke ${PROJECT_NAME}-debugging to isolate the root cause.
4. Propose a targeted fix — do not change scope or skip the original step.
5. Re-execute Phase 4 (instructions) and Phase 5 (feedback loop) for the corrected action.
6. Re-validate before proceeding.

If troubleshooting takes more than 3 cycles without resolution, surface the blocker to the user and ask how to proceed.

## Task Management

Use TaskCreate and TaskUpdate throughout:

- Create one task per step at the start (Step 2 of the checklist)
- Use statuses: pending, in-progress, waiting-for-user, blocked, completed
- Always show the user: what is done, what is current, what comes next
- If a step is blocked waiting for the user, mark it "waiting-for-user" and state exactly what is needed

Visible progress is essential. The user should never wonder where they are in the process.

## Communication Style

- Explain every action before doing it
- Use plain language — no jargon without definition
- Be explicit about what the agent can verify vs what requires the user's eyes
- When uncertain, state the uncertainty and propose the safest next action
- Keep each message focused on one thing: one instruction, one question, one validation

## Progress Status Format

At the start of each step, output:

\`Step N of M: [Step Name] | Phase: [Current Phase] | Status: [in-progress / waiting-for-user]\`

At the end of each step:

\`Step N complete. Validated. Document: docs/executions/<workflow>/step-NN-<slug>.md | Next: Step N+1 — [Next Step Name]\`

## Integration

- Uses ${PROJECT_NAME}-evidence-gathering for step validation in Phase 6.
- Uses ${PROJECT_NAME}-verification before claiming any step complete.
- Uses ${PROJECT_NAME}-step-documenter to document each completed step.
- Uses ${PROJECT_NAME}-debugging in Troubleshooting Mode.
- For complex goals requiring initial planning, invoke ${PROJECT_NAME}-brainstorming and ${PROJECT_NAME}-plan-writer first, then use this skill to execute the resulting plan collaboratively.
`;
