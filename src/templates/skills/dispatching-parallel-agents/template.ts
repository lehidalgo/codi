import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Parallel agent orchestration across multiple INDEPENDENT failure domains.
  Use when investigation reveals 3+ unrelated failures (test files with no
  shared cause, separate subsystems, disjoint migration tasks, unrelated
  audit findings) so dispatching N concurrent agents beats serial diagnosis.
  Trigger phrases: "dispatch parallel agents", "parallel debug", "fan out
  to subagents", "investigate these in parallel", "concurrent
  investigation", "multiple independent failures". Enforces an iron law —
  independence must be proven before dispatch (no shared state, no
  sequential dependency, no shared files). Each agent gets a focused
  per-domain prompt; integration is mechanical, not a re-diagnosis. Do NOT
  activate for executing approved plan tasks (use
  ${PROJECT_NAME}-plan-execution SUBAGENT — sequential by contract), for a
  single failure (use ${PROJECT_NAME}-debugging), for tasks with shared
  state (decouple first), or for a single subagent (call it directly).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 2
---

# {{name}} — Dispatching Parallel Agents

## When to Activate

Use when investigation reveals 3+ INDEPENDENT failure domains and serial diagnosis would N-multiply the time:

- 3+ test files failing with no shared cause
- 3+ subsystems with separate bugs surfaced together
- 3+ migration tasks touching disjoint code paths
- 3+ unrelated audit findings each needing its own evidence pass
- 3+ pieces of unfamiliar code to map for a refactor (parallel exploration)

The 3+ threshold matters: 2 small tasks are usually faster handled inline. Only escalate to parallel dispatch when the time cost of serial work clearly dominates the coordination cost of fan-out.

## Independence Means All Three

A domain is independent only if ALL three hold:

1. **No shared state** — agents do not read or write the same files, data structures, or database rows during their work
2. **No sequential dependency** — agent B's input does not depend on agent A's output
3. **No coordination need** — the integration step can combine results mechanically (concatenate findings, merge reports), not require a re-diagnosis

If any one fails, this is not a parallel-dispatch case. Either make the domains independent first (split shared files, decouple data flow) or stay sequential.

## Skip When

- Executing approved plan tasks — use **${PROJECT_NAME}-plan-execution** SUBAGENT mode (sequential by contract, forbids parallel dispatch)
- A single failure needs root-cause analysis — use **${PROJECT_NAME}-debugging** Phases 1-5
- Tasks share state or sequential dependency — split or refactor first, then re-evaluate
- Only one subagent is needed — just call it directly via the Agent tool
- 2 small tasks — handle inline, the overhead is not worth it
- The user is asking for batch processing of similar items — use **${PROJECT_NAME}-audit-fix**

## The Iron Law

**INDEPENDENCE MUST BE PROVEN BEFORE DISPATCH.** If you cannot articulate why each domain is fully independent under the three-part test above, the right answer is not parallel dispatch — it is to make them independent first or stay sequential.

A failed parallel dispatch (agents step on each other, results conflict, you re-do the diagnosis) is more expensive than serial work. The cost of getting it wrong is high; the cost of pausing to prove independence is low.

## The 4-Step Pattern

You MUST complete each step in order.

### Step 1 — Identify Independent Failure Domains

Before dispatching anything, list the candidate domains and apply the three-part independence test to each pair.

Write down explicitly:
- The N domains by name (e.g. \\\`auth.test.ts\\\`, \\\`payments.test.ts\\\`, \\\`search.test.ts\\\`)
- For each pair, confirm: no shared state, no sequential dependency, no coordination need
- If any pair fails the test, STOP and either split the work or stay sequential

If the user gave you the domains, still verify independence — user-supplied groupings are not always truly independent.

### Step 2 — Build Focused Per-Agent Prompts

Each agent gets its own prompt. The prompts must be:

- **Self-contained** — the agent cannot see your conversation; include the full domain context (file paths, error messages, what to investigate)
- **Narrow** — one domain per agent; do not bundle "and also look at X"
- **Output-shaped** — say what shape of result you need back (e.g. "report: root cause + 3-line fix sketch + confidence 1-5")
- **Token-bounded** — say how long the response should be ("under 300 words" beats unbounded)

Reuse the existing template:

> You are investigating ONE failure: \\\`<domain>\\\`. Context: <verbatim error / file paths / observed behavior>. Do not investigate adjacent files. Report: (1) root cause hypothesis, (2) confidence 1-5, (3) proposed fix in 3 lines or fewer. Under 300 words.

### Step 3 — Dispatch Concurrently

Send all N Agent tool calls in a SINGLE message. Multiple Agent tool uses in one assistant turn run in parallel — multiple turns run sequentially.

Each agent gets the same agent-type unless a domain genuinely needs a specialist (e.g. one is a security domain → use \`security-expert\`, the others use \`general-purpose\`).

Do NOT:
- Dispatch agents one-per-turn (that is sequential, defeating the purpose)
- Share a single agent across domains (that is sequential inside the agent)
- Pre-summarize findings to the agent (let it form its own conclusion from raw evidence)

### Step 4 — Integrate Findings Mechanically

When all agents return, the integration step must be **mechanical** — combine the per-domain reports into one structured artifact without re-running the diagnosis:

- Concatenate root-cause sections under per-domain headers
- Cross-check confidence scores; flag any below 3 for follow-up
- If two reports contradict on a shared assumption, that is a signal Step 1 was wrong (the domains were not actually independent) — do not paper over it

If integration requires you to re-investigate any domain, the parallel dispatch failed. Document why for the next attempt and continue serially.

After integration, hand off to the right next skill:
- Multiple bugs identified → **${PROJECT_NAME}-plan-writer** to bundle the fixes into one execution plan
- Single high-confidence bug per domain → **${PROJECT_NAME}-debugging** Phase 4 per domain to implement the fixes
- Findings inform a refactor → **${PROJECT_NAME}-brainstorming** for the refactor design

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Two tasks look similar enough to parallelize" | Below the 3+ threshold the coordination cost dominates. Stay serial. |
| "They share a helper file but the test domains are different" | Shared files = shared state. Not independent. Refactor first. |
| "The agents can sort out coordination as they go" | Subagents do not see each other. Coordination must happen in your integration step, not theirs. |
| "I will let the results conflict and pick the best one" | Conflicting results = wasted agent runs. Prove independence up front. |
| "This is faster than thinking about whether they are independent" | The independence test takes 60 seconds. A failed parallel dispatch costs the full agent-run time. |
| "I can dispatch and start the next thing while they work" | You cannot integrate without reading the results. Plan to receive them. |
| "Two of three agents finished, I will start integrating early" | Partial integration risks rework when the third returns. Wait for all N. |

## Red Flags

If you catch yourself thinking any of the following, STOP and re-apply the independence test:

- "I will let the agents figure out coordination"
- "Two agents touched the same file but it should be fine"
- "Results came back conflicting and I had to redo the diagnosis"
- "I dispatched 5 agents and 3 returned 'I need more context'"
- "The integration step turned into another full investigation"
- "I am running this in parallel to save time" (with no per-domain prompt)
- Dispatching without writing down the N domains first

## Quick Reference

| Question | Answer |
|----------|--------|
| When to use? | 3+ INDEPENDENT failure domains where serial work N-multiplies the time |
| Threshold | 3+ (2 = inline, 1 = single agent or debugging) |
| Per-agent prompt shape | Self-contained, narrow, output-shaped, token-bounded |
| How to dispatch | Single message, multiple Agent tool uses |
| Integration step | Mechanical concatenation; no re-diagnosis |
| Fallback if dispatch fails | Document the cause, continue serially with **${PROJECT_NAME}-debugging** |

## Integration

- **${PROJECT_NAME}-debugging** — the upstream skill. Phase 1 of debugging surfaces 3+ independent failure domains and hands off here. The downstream Phase 4 implementations also live in debugging.
- **${PROJECT_NAME}-plan-execution SUBAGENT** — sibling but distinct. SUBAGENT mode is sequential per task by contract; this skill is parallel across domains. Never combine modes.
- **${PROJECT_NAME}-plan-writer** — downstream when integration produces multiple fixes that need a unified execution plan.
- **${PROJECT_NAME}-verification** — gate after integration. Fresh evidence per domain before any completion claim.
- **${PROJECT_NAME}-audit-fix** — sibling for the batch-of-similar-items case. Audit-fix is one-at-a-time with commits per item; this skill is many-at-once with a single integration.
`;
