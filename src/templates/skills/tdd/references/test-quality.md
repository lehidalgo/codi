# Test quality patterns

Patterns for writing tests that catch real bugs, not just achieve coverage.

## Quality bar

| Quality      | Good                                                        | Bad                                                 |
| ------------ | ----------------------------------------------------------- | --------------------------------------------------- |
| Minimal      | One thing per test. If "and" appears in the name, split it. | `test('validates email and domain and whitespace')` |
| Clear        | Name describes behavior.                                    | `test('test1')`                                     |
| Real code    | No mocks unless unavoidable. Test the actual behavior.      | Test mocks, not real behavior.                      |
| Shows intent | Demonstrates the desired API for callers.                   | Obscures what the code should do.                   |

## Why order matters

### "I'll write tests after"

Tests written after code pass immediately. Passing immediately proves nothing:

- Might test the wrong thing.
- Might test implementation, not behavior.
- Might miss edge cases you forgot.
- You never saw it catch the bug.

Test-first forces you to see the test fail, proving it actually tests something.

### "I already manually tested all the edge cases"

Manual testing is ad-hoc:

- No record of what you tested.
- Can't re-run when code changes.
- Easy to forget cases under pressure.
- "It worked when I tried it" ≠ comprehensive.

Automated tests are systematic. Same way every time.

### "Tests-after ≠ TDD"

Tests-after answer "what does this do?". Tests-first answer "what should this do?".

Tests-after are biased by your implementation. You test what you built, not what is required. You verify remembered edge cases, not discovered ones.

Tests-first force edge-case discovery before implementing.

## When stuck

| Problem                | Solution                                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| Don't know how to test | Write the wished-for API. Write the assertion first. Ask the human partner. |
| Test too complicated   | Design too complicated. Simplify the interface.                             |
| Must mock everything   | Code too coupled. Use dependency injection.                                 |
| Test setup huge        | Extract helpers. Still complex? Simplify the design.                        |

## Anti-patterns specific to test code

- Testing mock behavior instead of real behavior.
- Adding test-only methods to production classes.
- Mocking without understanding the dependency.
- Single-test-coverage on multi-behavior code (split into multiple tests).
