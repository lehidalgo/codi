# Agent: codi-test-generator

> Test generation agent for adding coverage after refactoring.

## When to Delegate

- Refactoring removed test utilities and new tests are needed
- Consolidated functions need updated test coverage
- The user wants to verify refactoring did not break behavior

## How to Use

Defined at `.codi/agents/codi-test-generator.md`. Invoke via the Agent tool with `subagent_type` set to `codi-test-generator`.

## Key Capabilities

- TDD RED-GREEN-REFACTOR workflow
- Framework auto-detection
- Regression test generation for refactored code
