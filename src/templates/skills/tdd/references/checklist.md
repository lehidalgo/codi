# Pre-completion checklist for TDD work

Before marking work complete, verify all of the following. If any box is unchecked, TDD was skipped — start over.

## Per-test verification

- [ ] Every new function/method has a test.
- [ ] Each test was watched FAILING before implementation (RED phase observed).
- [ ] Each test failed for the EXPECTED reason (feature missing, not a typo or import error).
- [ ] Wrote MINIMAL code to pass each test (no YAGNI features).
- [ ] All tests pass.
- [ ] Output pristine (no errors, no warnings).
- [ ] Tests use real code (mocks only if unavoidable).

## Coverage discipline

- [ ] Edge cases covered by separate tests.
- [ ] Error paths covered.
- [ ] No "and" in test names (each test asserts one behavior).

## Refactor discipline

- [ ] Refactor only happened with all tests green.
- [ ] Refactor did NOT add new behavior — only restructured existing code.
- [ ] Tests stayed green throughout the refactor.

## Pre-commit

- [ ] No commented-out code.
- [ ] No `console.log` / `print` / debug instrumentation left.
- [ ] No unused imports.
- [ ] Commit message accurately describes the behavior added.

If any check fails: do not claim done. Fix or start over.
