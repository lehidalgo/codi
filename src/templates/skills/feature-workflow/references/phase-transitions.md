# Phase transition mechanics

How phases advance under the agent / human approval model.

## How to advance a phase

1. Complete the work of the current phase per `references/phase-<current>.md`.
2. Propose the transition:
   ```bash
   codi transition --to <next-phase> --author <agent-or-user>
   ```
3. Present a short summary of what was done to the human.
4. Wait for the human to run one of:
   ```bash
   codi transition --approve --author <user>
   codi transition --reject --reason "<text>" --author <user>
   ```
5. On approve, advance to the next phase per the corresponding reference.
   On reject, address the reason and re-propose when ready.

Do not skip phases. Do not pre-approve on behalf of the human.

## Scope discipline at execute

Modify only files declared in `scope.files_in_plan`. Any change to a file outside that list is either:

- **Incidental** (one-line import fix, pure type assertion) — auto-classified and recorded as `incidental_change_recorded`.
- **Scope expansion** (new logic, new file, interface change) — propose explicitly:
  ```bash
  codi scope propose-expansion --reason "<why>"
  ```
  Wait for human approval. If approved, `manifest.scope.files_in_plan` updates and the agent can proceed.

If the change is structural (touches public interfaces in multiple files, requires moving modules, or surfaces a separate concern), the system may suggest elevating it to a child workflow. See `phase-execute.md` for the elevation flow.

## Knowledge base updates inline

Throughout all phases, keep `docs/CONTEXT.md` and `docs/adr/` current:

- **New domain term emerges** → add to `CONTEXT.md` immediately.
- **Architectural decision passes the triple test** (hard-to-reverse + surprising-without-context + real-trade-off) → propose an ADR.
- **Plan markdown finalized** → save under `docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md` and link via `artifact_linked` event.

## Reading order at every phase boundary

1. `SKILL.md` (you are here).
2. `references/phase-<next-phase>.md` for the phase about to begin.
3. `docs/CONTEXT.md` for project domain vocabulary.
4. `docs/adr/` entries that relate to the area being touched.
5. `references/tracer-bullets.md` before starting `decompose`.
6. `references/gate-feedback-format.md` if a gate fails.
