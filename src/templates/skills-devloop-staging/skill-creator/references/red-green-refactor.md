# RED-GREEN-REFACTOR for skill content

Writing skills IS TDD applied to documentation. The Iron Law applies:

> NO SKILL WITHOUT A FAILING TEST FIRST

Applies to NEW skills AND EDITS to existing skills. No exceptions.

## TDD mapping

| TDD step            | Skill creation                                                     |
| ------------------- | ------------------------------------------------------------------ |
| Test case           | Pressure scenario or trigger scenario in `evals/evals.json`        |
| Production code     | The skill content (SKILL.md + references)                          |
| Test fails (RED)    | Agent fails the scenario without the skill present                 |
| Test passes (GREEN) | Agent complies / triggers correctly with the skill present         |
| Refactor            | Close loopholes (new rationalizations) without breaking compliance |

## RED — write the failing test

Before writing SKILL.md:

1. **Write the eval** at `skills/<name>/evals/evals.json`.
2. **Pick the scenario type:**
   - **Discriminator scenarios** (technique skills) — "the agent should detect this case and apply X technique". Cases prove the skill triggers and produces correct behavior.
   - **Pressure scenarios** (discipline skills like TDD, verify-evidence, code-review) — combine pressures (time, sunk cost, authority, exhaustion) and assert the discipline holds.
3. **Run the scenario without the skill** present (or with a stripped-down baseline). Document the agent's actual behavior verbatim — every rationalization, every shortcut.
4. **Save the rationalizations** as the input for the GREEN phase.

## GREEN — write the minimal skill

Address only the specific rationalizations / failures observed in RED. Do NOT add content for hypothetical cases — that pads the skill and hides the load-bearing rules.

Run the scenario WITH the skill present. The agent should now comply.

## REFACTOR — close loopholes

Agents are smart and find new rationalizations under pressure. Each one needs an explicit counter in the skill body.

Common rationalization patterns to plug:

| Excuse                         | Counter                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| "Too simple to need this"      | Add: "Simple is where unexamined assumptions cost the most."                            |
| "Spirit vs letter of the rule" | Add: "Violating the letter is violating the spirit."                                    |
| "Just this once"               | Add: "No exceptions. Not for simple changes. Not for documentation. Not for refactors." |
| "I already manually tested"    | Add: "Manual testing without a recorded test means no test exists."                     |
| "Tests after achieve the same" | Add: "Tests-after = 'what does this do?'. Tests-first = 'what should this do?'."        |

Capture every rationalization the agent produces during testing. Build a Red Flags / Common Rationalizations table at the end of SKILL.md so future agents self-check.

## Red flags that should make the agent stop

- About to skip writing the eval first
- About to write SKILL.md before scenarios are documented
- About to add "obvious" content not tied to a specific scenario
- About to call an edit "small enough to not need an eval update"

All of these mean: stop. Return to RED.

## Iron Law applies to edits too

Edit a skill without updating the eval? Same violation as writing code without a test.

When editing:

1. Re-read `evals/evals.json`.
2. Add or update cases that capture the new behavior.
3. Run the new cases without the edit (they should fail).
4. Make the edit.
5. Re-run; cases should pass.
6. Validator must still pass.

## Anti-patterns

- Writing SKILL.md first, then back-filling evals to match. The eval no longer pressures the skill.
- Reusing eval cases across skills. Each skill needs its own load-bearing scenarios.
- Single-case evals for discipline skills. Need ≥3 pressure scenarios to cover the rationalization space.
- Treating the eval as a "TODO". Empty evals/evals.json fails the validator.
