import {
  MIN_CODE_COVERAGE_PERCENT,
  PROJECT_NAME,
  SKILL_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Unified testing skill with three modes. RUN: detect the framework and
  execute the test suite, report pass/fail with quick triage. COVERAGE:
  run with coverage instrumentation, identify files and lines below the
  ${MIN_CODE_COVERAGE_PERCENT}% threshold, produce a gap report.
  GENERATE: COVERAGE + generate tests for uncovered code paths (delegates
  to ${PROJECT_NAME}-test-generator and ${PROJECT_NAME}-code-reviewer
  subagents). Auto-detects Jest, Vitest, Pytest, Go, Rust, and .NET.
  Activates on phrases like "run the tests", "are the tests green", "test
  results", "npm test", "pytest", "go test", "cargo test", "vitest",
  "code coverage", "test gaps", "uncovered lines", "measure coverage",
  "fill coverage gaps", "what's my coverage". Do NOT activate for writing
  new feature tests (use ${PROJECT_NAME}-tdd), fixing a failing test
  (use ${PROJECT_NAME}-debugging), quality-reviewing existing tests
  (use ${PROJECT_NAME}-code-review), full ${PROJECT_NAME} installation
  audits (use ${PROJECT_NAME}-dev-e2e-testing), or multi-phase QA sweeps
  (use ${PROJECT_NAME}-guided-qa-testing).
category: ${SKILL_CATEGORY.TESTING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Testing

Three modes over one pipeline. Pick the mode from user intent.

## Mode Selection

| Mode | Trigger phrases | Reads | Writes |
|------|-----------------|-------|--------|
| **RUN** (default) | "run the tests", "are tests green", "npm test", "pytest", "test results" | Source + tests | Nothing — stdout report only |
| **COVERAGE** | "coverage", "measure coverage", "test gaps", "what's my coverage", "coverage report" | Source + tests + coverage output | Coverage artifacts (\\\`coverage/\\\`, \\\`coverage.out\\\`) — no source modification |
| **GENERATE** | "fill coverage gaps", "generate missing tests", "improve coverage", "tests for uncovered lines" | Source + existing tests | **New test files** in the project |

When the user intent is ambiguous between RUN and COVERAGE, ask: "Do you want pass/fail or coverage metrics?"

## Skip When

- User is implementing a new feature with tests (RED → GREEN → REFACTOR) — use ${PROJECT_NAME}-tdd
- User has a specific failing test to debug — use ${PROJECT_NAME}-debugging
- User wants to review test quality (style, assertions, mocks) — use ${PROJECT_NAME}-code-review
- User wants to remove dead / uncovered code — use ${PROJECT_NAME}-refactoring
- User wants a full ${PROJECT_NAME} installation audit (contributor-only) — use ${PROJECT_NAME}-dev-e2e-testing
- User wants systematic multi-phase QA — use ${PROJECT_NAME}-guided-qa-testing

## Framework Detection (all modes)

**[SYSTEM]** Identify the test framework from the project manifest:

| Signal | Framework |
|--------|-----------|
| \\\`package.json\\\` devDependencies has vitest | Vitest |
| \\\`package.json\\\` devDependencies has jest | Jest |
| \\\`package.json\\\` devDependencies has mocha / ava | Mocha / Ava |
| \\\`pyproject.toml\\\` or \\\`setup.cfg\\\` has pytest | Pytest |
| \\\`go.mod\\\` present | Go \\\`go test\\\` |
| \\\`Cargo.toml\\\` present | Rust \\\`cargo test\\\` |
| \\\`*.csproj\\\` / \\\`*.sln\\\` present | .NET \\\`dotnet test\\\` |

If no framework can be detected, report that and ask the user to confirm.

---

## Mode: RUN

Use when the user wants pass/fail feedback.

### Step 1 — Detect (see Framework Detection above)

### Step 2 — Execute

**[SYSTEM]** Run the suite:

| Framework | Command |
|-----------|---------|
| Node.js | \\\`npm test\\\` / \\\`pnpm test\\\` / \\\`yarn test\\\` |
| Python | \\\`pytest\\\` |
| Go | \\\`go test ./...\\\` |
| Rust | \\\`cargo test\\\` |
| .NET | \\\`dotnet test\\\` |

### Step 3 — Report

**[CODING AGENT]** Summarize:
- Total: passed, failed, skipped
- For each failure:
  - Test name, file, and error message
  - Distinguish pre-existing failures from new ones — run \\\`git stash\\\` and re-run if needed to isolate
  - Suggest a specific fix (route to ${PROJECT_NAME}-debugging for root-cause work)
- If all pass, confirm with a one-line summary

---

## Mode: COVERAGE

Use when the user wants to measure current coverage or identify gaps. Read-only — does not modify source or generate tests.

### Step 1 — Detect (see Framework Detection above)

### Step 2 — Run Coverage Analysis

**[SYSTEM]** Execute the coverage command:

| Framework | Command |
|-----------|---------|
| Jest | \\\`npx jest --coverage --coverageReporters=text --coverageReporters=json-summary\\\` |
| Vitest | \\\`npx vitest run --coverage\\\` |
| Pytest | \\\`pytest --cov=src --cov-report=term-missing --cov-report=json\\\` |
| Go | \\\`go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out\\\` |
| Rust | \\\`cargo tarpaulin --out json\\\` |

Record the baseline coverage numbers.

### Step 3 — Identify Coverage Gaps

**[CODING AGENT]** Parse the coverage output:
- Files below the ${MIN_CODE_COVERAGE_PERCENT}% coverage threshold
- Specific uncovered line ranges in each file
- Functions or methods with zero coverage
- Branches (if/else, switch) only partially covered

Sort files by coverage gap size (lowest first).

### Step 4 — Report

**[CODING AGENT]** Produce a concise gap report:
- Overall coverage (percentage)
- Files below threshold, sorted by gap
- Top 3 highest-impact gaps (large file × low coverage)
- Recommendation: stay in COVERAGE mode for a second look, or switch to GENERATE mode to fill gaps

---

## Mode: GENERATE

Use when the user wants to fill coverage gaps with new tests. **Writes new test files.** Requires COVERAGE data first.

### Step 1-3 — Run COVERAGE Steps 1-3

### Step 4 — Prioritize Test Generation

**[CODING AGENT]** For each uncovered area, prioritize:
1. **Happy path** — Normal successful execution paths
2. **Error handling** — Catch blocks, error returns, validation failures
3. **Edge cases** — Empty inputs, null values, boundary conditions
4. **Branch coverage** — Untested conditional branches

Skip generating tests for:
- Auto-generated code (protobuf, GraphQL codegen)
- Configuration files or type definitions
- Third-party library wrappers with no logic

### Step 5 — Generate Missing Tests

**[CODING AGENT]** For each gap:
- Read the source file to understand the function behavior
- Read existing tests in adjacent test files to match patterns and style
- Generate tests following arrange-act-assert (AAA)
- Use descriptive names: "should [behavior] when [condition]"
- Place tests adjacent to source files following project convention
- Mock only external dependencies (APIs, databases, file system)

Delegate to the specialized agent for higher quality:
- **${PROJECT_NAME}-test-generator** — prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/test-generator.md]]\\\`

### Step 6 — Review Generated Tests

**[CODING AGENT]** Before finalizing:
- **${PROJECT_NAME}-code-reviewer** — prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/code-reviewer.md]]\\\`

### Step 7 — Verify and Report

**[SYSTEM]** Re-run the coverage command.

**[CODING AGENT]** Produce a before/after comparison:
- Overall coverage: before vs after (percentage delta)
- Per-file improvements
- Files still below ${MIN_CODE_COVERAGE_PERCENT}% threshold
- Remaining gaps requiring manual attention (complex logic, integration points)
- Total tests added and their file locations

---

## Related Skills

- **${PROJECT_NAME}-tdd** — RED → GREEN → REFACTOR for new features
- **${PROJECT_NAME}-debugging** — Root-cause analysis for failing tests
- **${PROJECT_NAME}-refactoring** — Remove dead / uncovered code after analysis
- **${PROJECT_NAME}-guided-qa-testing** — Multi-phase systematic QA sweep
`;
