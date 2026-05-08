# Rationalization counter table for TDD

Agents under pressure rationalize around the Iron Law. Each rationalization gets an explicit counter.

| Excuse                                 | Reality                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| "Too simple to test"                   | Simple code breaks. Test takes 30 seconds.                              |
| "I'll test after"                      | Tests passing immediately prove nothing.                                |
| "Tests after achieve same goals"       | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested"              | Ad-hoc ≠ systematic. No record, cannot re-run.                          |
| "Deleting X hours is wasteful"         | Sunk cost fallacy. Keeping unverified code is technical debt.           |
| "Keep as reference, write tests first" | You will adapt it. That is testing after. Delete means delete.          |
| "Need to explore first"                | Fine. Throw away exploration, start with TDD.                           |
| "Hard to test = design unclear"        | Listen to the test. Hard to test = hard to use.                         |
| "TDD will slow me down"                | TDD is faster than debugging. Pragmatic = test-first.                   |
| "Manual test is faster"                | Manual does not prove edge cases. You will re-test every change.        |
| "Existing code has no tests"           | You are improving it. Add tests for existing code.                      |
| "It's about spirit not ritual"         | Spirit-vs-letter is the rationalization. Both are required.             |
| "Just this once"                       | No exceptions without explicit human partner permission.                |

## Final rule

```
Production code → test exists and failed first
Otherwise → not TDD
```
