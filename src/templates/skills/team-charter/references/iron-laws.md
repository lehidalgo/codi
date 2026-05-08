# Iron Laws — authoritative reference

These laws override convenience and override defaults. Every workflow's elicitation, phase, and gate documentation cites this file rather than restating the rules in-line.

| #   | Law                                                                    | Test                                                                                                 |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Recommend AND execute; ask only when input is required                 | Default mode is action. Ask only at HARD GATE / credential / ambiguous-business / irreversible-write |
| 2   | One question per turn                                                  | Elicitation prompts are atomic; no bundled questions                                                 |
| 3   | Sheet is the canvas                                                    | Strategic info written to Sheet via draft+sync, never dumped in chat                                 |
| 4   | HARD GATES require explicit "ok" (case-insensitive, exactly two chars) | "okay" / "looks good" / "yeah" / "sure" / "yes" do NOT pass a gate                                   |
| 5   | Pull before patch; preview before apply                                | Re-runs of a phase begin with `devloop sheets pull-all`                                              |
| 6   | Atomic writes; rollback ready                                          | `sync-draft` auto-snapshots; `restore --latest` is the undo                                          |
| 7   | Never commit without explicit approval                                 | `git commit`, PR creation, branch deletion all gated                                                 |
| 8   | Output mode honors preference                                          | `.devloop/preferences.json::output_mode` defaults to caveman                                         |

## Rationale per law

### 1. Recommend AND execute; ask only when input is required

Two anti-patterns this law kills:

**Anti-pattern A — blank decisions.** Asking "what do you want?" without a recommendation pushes synthesis onto the user. The agent has the full conversational context, has read the docs, has surveyed the codebase — it can almost always propose a sensible default. Asking blankly wastes the user's time and signals helplessness.

**Anti-pattern B — asking permission to start.** When the user says "let's go" / "start" / "fix it", the agent freezes and asks "should I start?". The user has ALREADY authorized — the directive itself is the permission. Pausing before the first concrete action is interrogation theater.

**The rule:** the agent's default mode is action. Treat user directives as authorization to begin. The agent pauses ONLY at:

1. **HARD GATEs** — phase transitions requiring the literal two-character `ok` (case-insensitive).
2. **Credentials / OAuth** — input only the human can supply (a click-through, a secret).
3. **Ambiguous business decisions** — the answer would CHANGE the path, and there's no signal in the codebase to default it.
4. **Irreversible actions** — `git commit`, `git push`, branch delete, large destructive Sheet writes.

When asking IS required, the question must carry: `Recommend X because Y. Confirm or override.` That gives the user a one-word reply path (`y` / `redirect`) and makes the agent's reasoning legible.

**Wrong:**

> User: "let's start the project"
> Agent: "Recommend the `project` workflow. Run, or describe task? (y/redirect)"
> [waits]

**Right:**

> User: "let's start the project"
> Agent: "Starting `project` workflow." [executes]
> [reads docs/sources/]
> "Project name: `acme-checkout` (from 'rewriting checkout' in the discovery call). Confirm or override?"

The agent is already moving when it asks — and the question is at the first ambiguous decision, not before any action.

**Framing for ask-the-human cases:** when input is genuinely required, frame it as `I need <X> from you because <I cannot do Y myself>` — not `Do you want me to <thing-I-can-already-do>?`. The user is your reviewer at decision points, not the foreman at every step.

### 2. One question per turn

Bundling questions invites the user to skip some. They answer the easy ones, the hard ones rot. Atomic questions force a decision per turn and keep the gate progression auditable.

### 3. Sheet is the canvas

The Sheet is the persistent, shareable, stakeholder-visible artifact. Chat is ephemeral and consumes tokens. A 25-row table dump in chat is a 1.5k-token cost for information the user can read in the Sheet at zero token cost. It also fragments the source of truth — once a story is in chat AND the Sheet, the two diverge.

### 4. HARD GATES require explicit "ok"

Phase transitions are the few moments where the user explicitly takes ownership of what comes next. A soft yes ("looks good", "yeah", "sure") signals "I scanned it" — not "I commit". Requiring the literal two-character `ok` (case-insensitive — `ok`, `OK`, and `Ok` all qualify) forces a beat of consideration and makes the audit trail unambiguous: the user typed the word; the manifest records it.

The match is **exact length 2** — `okay`, `okie`, `okey-doke` do NOT qualify. The agent re-prompts on any other input, including soft yeses.

The shape is `<token>` with no trailing punctuation. `ok!` and `ok.` qualify only after trimming whitespace and trailing `.!` characters; the agent is permitted to be lenient on trailing punctuation but must remain strict on length.

To reject the proposal: `redirect <reason>`.

### 5. Pull before patch; preview before apply

The Sheet evolves: stakeholders edit cells, parallel workflows touch execution columns, scopes shift. A draft built from yesterday's mental model can clobber today's reality. The pull-before-patch discipline means every draft is a delta against current truth, and the diff preview gives a final visual check before any write.

### 6. Atomic writes; rollback ready

`sync-draft` is implemented as: snapshot → per-row apply → on first failure, restore from snapshot. The user-facing guarantee: if anything goes wrong, the Sheet looks exactly as it did before the call. The escape hatch (`--skip-snapshot`) exists for tests, not production.

### 7. Never commit without explicit approval

A commit is a public record. The agent can't unsend it (force-push exists but is itself another irreversible action). Requiring explicit approval per commit prevents the agent from getting "ahead of itself" and makes every `git log` entry attributable to a user decision.

### 8. Output mode honors preference

Different teams tolerate different verbosity. Caveman is the default because workflow phases are short, high-frequency, and benefit from compact output. The `?` escape gives the user a one-turn verbose-mode override without committing the project to it.

## Cross-references

| Workflow             | Cites these laws |
| -------------------- | ---------------- |
| `project-workflow`   | 1, 2, 3, 4, 5, 6 |
| `feature-workflow`   | 1, 2, 4, 6, 7    |
| `bug-fix-workflow`   | 1, 2, 4, 7       |
| `refactor-workflow`  | 1, 4, 6, 7       |
| `migration-workflow` | 1, 4, 5, 6, 7    |
| `quality-gates`      | 1, 4, 7          |

## What's NOT in the Iron Laws

- Specific subagent invocation rules — those live in each workflow's references.
- Specific token budgets / verbosity caps — those live in `caveman` mode rules.
- Specific commit-message conventions — those live in `quality-gates` and project CLAUDE.md.
- Specific file-naming conventions — those live in project CLAUDE.md.

The Iron Laws are the small set that every workflow shares.
