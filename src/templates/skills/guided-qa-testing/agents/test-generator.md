# Agent: codi-test-generator

> Test generation agent for creating automated tests from QA findings.

## When to Delegate

- QA testing identifies bugs that need regression tests
- Automatable test phases need test suite generation
- The user wants to convert manual QA checks into automated tests

## How to Use

Defined at `.codi/agents/codi-test-generator.md`. Invoke via the Agent tool with `subagent_type` set to `codi-test-generator`.

## Key Capabilities

- TDD RED-GREEN-REFACTOR workflow
- Framework auto-detection
- Regression test generation from bug reports
