# Architecture-review process — detailed steps

## Step 1 — Explore

1. Read `docs/CONTEXT.md` (domain glossary) and any `docs/adr/` decisions in the area being reviewed. Domain language gives names to good seams; ADRs record decisions this skill must not re-litigate.
2. Use the Task tool with `subagent_type=Explore` (or `general-purpose` with explore-only constraints) to walk the codebase. Do not follow rigid heuristics — explore organically and note where you experience friction.

**Friction checklist:**

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they are called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested or hard to test through their current interface?

3. Apply the **deletion test** to anything suspected of being shallow.

## Step 2 — Present candidates

Present a numbered list of deepening opportunities. For each candidate:

- **Files** — modules involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, plus how tests would improve

Use **CONTEXT.md vocabulary** for the domain and **glossary vocabulary** for the architecture. If `CONTEXT.md` defines "Order", talk about "the Order intake module" — not "the FooBarHandler", not "the Order service".

**ADR conflicts** — if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting. Mark clearly: _"contradicts ADR-0007 — but worth reopening because…"_. Do not list every theoretical refactor an ADR forbids.

Do NOT propose interfaces yet. Ask: "Which of these would you like to explore?"

## Step 3 — Grilling loop on chosen candidate

Once the user picks a candidate, drop into a grilling conversation. Walk the design tree — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Classify dependencies (see `deepening.md`).

Inline side effects as decisions crystallize:

- **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md` immediately (lazy-create if it does not exist). Same discipline as `discover` mode `domain`.
- **Sharpening a fuzzy term during the conversation?** Update `CONTEXT.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR: _"Want me to record this as an ADR so future architecture reviews do not re-suggest it?"_ Only offer when the reason would be needed by a future explorer to avoid re-suggesting the same thing — skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces?** See `interface-design.md` — parallel sub-agent pattern.
