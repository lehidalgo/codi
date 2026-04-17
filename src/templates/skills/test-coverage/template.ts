import {
  MIN_CODE_COVERAGE_PERCENT,
  PROJECT_NAME,
  SKILL_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Test coverage analysis workflow. Use when the user wants to measure,
  report, or improve code coverage, identify test gaps below the
  ${MIN_CODE_COVERAGE_PERCENT}% threshold, generate missing tests for
  uncovered lines, or produce a before/after coverage comparison. Also
  activate for phrases like "code coverage", "test gaps", "uncovered
  lines", "coverage report", "measure coverage", "fill coverage gaps",
  "coverage metric", "what's my coverage". Detects test framework
  (Jest / Vitest / Pytest / Go / Rust) automatically. Do NOT activate
  for implementing new features with tests (use ${PROJECT_NAME}-tdd),
  fixing a specific failing test (use ${PROJECT_NAME}-debugging), or
  quality-reviewing existing tests (use ${PROJECT_NAME}-code-review).
category: ${SKILL_CATEGORY.CODE_QUALITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Test Coverage

## When to Activate

- User asks to measure or report current test coverage
- User wants to identify files or functions that lack test coverage
- User asks to generate tests for uncovered code paths
- User needs a before/after coverage comparison after adding tests
- New feature has been implemented and needs test coverage verification

## Skip When

- User is implementing a new feature with tests (RED-GREEN-REFACTOR) — use ${PROJECT_NAME}-tdd
- User is debugging a specific failing test — use ${PROJECT_NAME}-debugging
- User wants to quality-review existing tests — use ${PROJECT_NAME}-code-review
- User wants to remove dead / uncovered code — use ${PROJECT_NAME}-refactoring
- User wants systematic multi-phase QA — use ${PROJECT_NAME}-guided-qa-testing

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

For specialized analysis, delegate to these agents:
- **${PROJECT_NAME}-test-generator** — Expert test creation with TDD workflow. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/test-generator.md]]\\\`
- **${PROJECT_NAME}-code-reviewer** — Review generated tests for quality and correctness. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/code-reviewer.md]]\\\`

## Related Skills

- **${PROJECT_NAME}-refactoring** — Clean up dead code after improving coverage
`;
