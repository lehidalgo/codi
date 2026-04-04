import {
  MIN_CODE_COVERAGE_PERCENT,
  PROJECT_NAME,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: Test coverage analysis workflow. Use when measuring coverage, identifying gaps below ${MIN_CODE_COVERAGE_PERCENT}% threshold, or generating missing tests. Detects framework automatically and produces before/after comparison.
category: Code Quality
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 1
---

# {{name}}

## When to Activate

- User asks to measure or report current test coverage
- User wants to identify files or functions that lack test coverage
- User asks to generate tests for uncovered code paths
- User needs a before/after coverage comparison after adding tests
- New feature has been implemented and needs test coverage verification

## Coverage Analysis Process

### Step 1: Detect Test Framework

**[SYSTEM]** Identify the project's test framework by checking:
- \\\`package.json\\\` — look for jest, vitest, mocha, ava in devDependencies
- \\\`pyproject.toml\\\` or \\\`setup.cfg\\\` — look for pytest, unittest configuration
- \\\`go.mod\\\` — Go projects use built-in \\\`go test\\\`
- \\\`Cargo.toml\\\` — Rust projects use built-in \\\`cargo test\\\`, tarpaulin for coverage

### Step 2: Run Coverage Analysis

**[SYSTEM]** Execute the appropriate coverage command:
- Jest: \\\`npx jest --coverage --coverageReporters=text --coverageReporters=json-summary\\\`
- Vitest: \\\`npx vitest run --coverage\\\`
- Pytest: \\\`pytest --cov=src --cov-report=term-missing --cov-report=json\\\`
- Go: \\\`go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out\\\`
- Rust: \\\`cargo tarpaulin --out json\\\`

Record the baseline coverage numbers before making any changes.

### Step 3: Identify Coverage Gaps

**[CODING AGENT]** Parse the coverage output and identify:
- Files below the ${MIN_CODE_COVERAGE_PERCENT}% coverage threshold
- Specific uncovered line ranges in each file
- Functions or methods with zero coverage
- Branches (if/else, switch) that are only partially covered

Sort files by coverage gap size (lowest coverage first).

### Step 4: Prioritize Test Generation

**[CODING AGENT]** For each uncovered area, prioritize in this order:
1. **Happy path** — Normal successful execution paths
2. **Error handling** — Catch blocks, error returns, validation failures
3. **Edge cases** — Empty inputs, null values, boundary conditions
4. **Branch coverage** — Untested conditional branches

Skip generating tests for:
- Auto-generated code (protobuf, GraphQL codegen)
- Configuration files or type definitions
- Third-party library wrappers with no logic

### Step 5: Generate Missing Tests

**[CODING AGENT]** For each identified gap:
- Read the source file to understand the function behavior
- Read existing tests in adjacent test files to match patterns and style
- Generate tests following the arrange-act-assert (AAA) pattern
- Use descriptive test names: "should [behavior] when [condition]"
- Place tests adjacent to source files following project convention
- Mock only external dependencies (APIs, databases, file system)

### Step 6: Verify and Report

**[SYSTEM]** Re-run the coverage command after generating tests.

**[CODING AGENT]** Produce a coverage comparison report:
- Overall coverage: before vs after (percentage change)
- Per-file coverage improvements
- Files still below ${MIN_CODE_COVERAGE_PERCENT}% threshold
- Remaining gaps that need manual attention (complex logic, integration points)
- Total tests added and their locations

## Available Agents

For specialized analysis, delegate to these agents (see \\\`agents/\\\` directory):
- **${PROJECT_NAME}-test-generator** — Expert test creation with TDD workflow
- **${PROJECT_NAME}-code-reviewer** — Review generated tests for quality and correctness

## Related Skills

- **${PROJECT_NAME}-refactoring** — Clean up dead code after improving coverage
`;
