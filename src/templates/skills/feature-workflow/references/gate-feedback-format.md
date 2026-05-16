# Gate Feedback Format

When a gate fails, the agent receives structured JSON. This document describes the format and how the agent should respond.

## Failure shape

```json
{
  "gate": "plan-complete",
  "phase_attempted_transition": "plan -> decompose",
  "failed_checks": [
    {
      "id": "plan_addresses_intent",
      "type": "agent",
      "message": "Plan does not cover user story #3 (localStorage persistence).",
      "evidence": {
        "missing_from_plan": ["localStorage handling", "default theme on first load"],
        "intent_path": "docs/[PLAN]_dark-mode.md#user-stories"
      },
      "suggested_action": "Add localStorage steps to plan, or document as out-of-scope."
    }
  ],
  "retry_count": 1,
  "retries_remaining": 1,
  "next_step": "Address failed checks. Re-run gate with: codi gate run plan-complete"
}
```

## How to respond

1. Read every entry in `failed_checks`. Do not skip.
2. For each entry, identify the underlying cause:
   - Genuine gap in the work? Fix the work.
   - Misclassification by the gate? Address with the human; do not auto-override.
   - Scope expansion that needs proposing? Use `codi scope propose-expansion`.
3. After addressing, re-run the gate:
   ```bash
   codi gate run <gate-name>
   ```
4. Do not propose a transition until the gate passes.

## When `retries_remaining: 0`

The gate has exhausted its automatic retries. The system escalates to the human as a structured decision:

> Gate `plan-complete` failed after 2 retries. The remaining issue is: <message>. The agent's last attempt to address it: <summary>. How would you like to proceed?

The human has three options:

- **Fix it together.** Discuss with the human, address the issue, then run `codi gate run` once more (overrides the retry exhaustion as a manual run, recorded explicitly).
- **Override.** Human decides the gate is wrong for this case. Append a `decision_recorded` event with the rationale, then advance manually.
- **Abandon.** The work is not viable. `codi abandon --reason "..."`.

Never auto-override a gate. Never silently retry past the budget.

## Reading the suggested_action

The `suggested_action` is the gate's guess at what would resolve the failure. It is advisory, not authoritative. If the suggestion does not fit your context, address the underlying check rule instead — the rule is the contract.

## After the gate passes

Once `gate_check_passed` events fire for every check in the gate, the system records `phase_completed` for the current phase. Then propose the transition:

```bash
codi transition --to <next-phase>
```
