# Agent: codi-test-generator

> Test generation agent for creating comprehensive e2e and integration tests.

## When to Delegate

- E2E validation identifies gaps that need new test cases
- The user asks for automated test generation for critical paths
- Test suites need expansion based on e2e testing findings

## How to Use

Defined at `.codi/agents/codi-test-generator.md`. Invoke via the Agent tool with `subagent_type` set to `codi-test-generator`.

## Key Capabilities

- TDD RED-GREEN-REFACTOR workflow
- Framework auto-detection
- Integration and e2e test creation
