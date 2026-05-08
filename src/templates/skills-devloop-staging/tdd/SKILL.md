---
name: tdd
description: Use when implementing any feature or bugfix, before writing implementation code. Triggers on "add a function", "implement", "build", "write code", "fix a bug" — any time production code is about to be written. Body documents the Iron Law, RED-GREEN-REFACTOR cycle, and the rationalization counters.
---

# tdd

Write the test first. Watch it fail. Write minimal code to pass. If you didn't watch the test fail, you don't know if it tests the right thing. Violating the letter of the rules is violating the spirit.

## When to use

- Always: new features, bug fixes, refactoring, behavior changes.
- Exceptions (ask first): throwaway prototypes, generated code, configuration files.

Thinking "skip TDD just this once"? Stop. That is rationalization.

## The Iron Law

> NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

Write code before the test? Delete it. Start over.

No exceptions:

- Do not keep it as "reference".
- Do not "adapt" it while writing tests.
- Do not look at it.
- Delete means delete.

Implement fresh from tests. Period.

## Process — RED-GREEN-REFACTOR cycle

| Phase        | Step                                                         | Verification                                       |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------- |
| **RED**      | Write one minimal test showing what should happen            | Run it; confirm it fails for the RIGHT reason      |
| **GREEN**    | Write the simplest code to pass the test                     | Run it; confirm it passes; other tests still green |
| **REFACTOR** | Clean up: remove duplication, improve names, extract helpers | Tests stay green; do not add behavior              |

Full cycle examples in `references/cycle-examples.md`. Bug-fix variant in `references/bug-fix-tdd.md`.

## Quality bar

| Quality   | Good                        | Bad                                                 |
| --------- | --------------------------- | --------------------------------------------------- |
| Minimal   | One thing per test          | `test('validates email and domain and whitespace')` |
| Clear     | Name describes behavior     | `test('test1')`                                     |
| Real code | No mocks unless unavoidable | Test mocks, not real behavior                       |

Full quality patterns in `references/test-quality.md`.

## Anti-patterns

- Code before test → delete and start over.
- Test passes immediately → testing existing behavior. Fix the test.
- Mock-heavy tests → testing mocks, not code.
- "I already manually tested" → ad-hoc ≠ systematic.
- "Tests after achieve same goals" → wrong: tests-after biases on implementation.
- "Sunk cost: X hours of work" → unverified code is technical debt.
- "TDD is dogmatic" → TDD IS pragmatic; debugging is slower.

Full rationalization counters and red-flag list in `references/rationalizations.md`.

## Termination

- New function / method has a test that failed first → implementation makes it pass → refactor stays green → done.
- All tests pass with pristine output (no errors, no warnings).
- Edge cases and errors covered.
- Validation: see `references/checklist.md` for the pre-completion checklist.

## Boundaries

- Drives implementation via test-first discipline. Does NOT cover refactor characterization tests (use `refactor-workflow` phase baseline).
- Does NOT replace `verify-evidence` — TDD ensures the test exists; verify-evidence ensures completion claims have evidence.
- Does NOT cover security/performance testing approaches — those are out of scope.
