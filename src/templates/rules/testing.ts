import { MIN_CODE_COVERAGE_PERCENT } from '../../constants.js';

export const template = `---
name: {{name}}
description: Testing standards and TDD workflow
priority: medium
alwaysApply: true
managed_by: codi
---

# Testing Standards

## Coverage & Requirements
- Maintain minimum ${MIN_CODE_COVERAGE_PERCENT}% code coverage
- All new features require tests before merging — untested code is a liability
- All bug fixes require a regression test — prevents the same bug from recurring
- Write all three test types: unit tests for logic, integration tests for API/database, end-to-end tests for critical user flows
- Critical paths require integration tests

## Test-Driven Development (TDD)
1. RED: Write a failing test that describes the expected behavior
2. GREEN: Write the minimal implementation to make it pass
3. REFACTOR: Improve the code while keeping tests green

## Test Structure
- Follow arrange-act-assert (AAA) pattern — makes test intent immediately clear
- One assertion per test when practical
- Use descriptive names: "should [behavior] when [condition]"
- Keep tests independent — no shared mutable state between tests

BAD: Test B relies on data created by Test A
GOOD: Each test creates its own data in the arrange phase

## What to Test
- Business logic and domain rules
- Edge cases: empty inputs, nulls, boundaries, overflow — most bugs hide at boundaries
- Error paths: invalid input, network failures, timeouts
- Integration points: API endpoints, database operations

## What NOT to Test
- Framework internals or third-party library behavior — trust the library, test your usage
- Trivial getters/setters with no logic
- Implementation details (test behavior, not structure) — implementation-coupled tests break on every refactor

BAD: Assert that an internal method was called 3 times
GOOD: Assert that the output matches the expected result

## Mocking
- Mock only external dependencies (APIs, databases, file system)
- Do not mock the module under test — you would be testing the mock, not the code
- Prefer fakes and stubs over complex mock frameworks
- Reset mocks between tests to avoid leaking state`;
