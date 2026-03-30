# Agent: codi-test-generator

> Generates comprehensive unit and integration tests following TDD workflows.

## When to Delegate

- Coverage gaps have been identified and tests need to be written
- The user asks for test generation for specific uncovered modules
- Complex test scenarios require expert test design

## How to Use

Defined at `.codi/agents/codi-test-generator.md`. Invoke via the Agent tool with `subagent_type` set to `codi-test-generator`.

## Key Capabilities

- TDD RED-GREEN-REFACTOR workflow
- Framework auto-detection (Jest, Vitest, pytest, Go test, cargo test)
- Testing trophy: integration > unit > e2e prioritization
