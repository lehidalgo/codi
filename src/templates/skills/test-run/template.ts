import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Detect and run the project test suite, then report results with quick
  failure triage. Use when the user wants to run tests, check if tests
  pass, confirm the suite is green, or identify failures. Also activate
  for phrases like "run the tests", "are the tests green", "test
  results", "run the test suite", "unit tests pass?", "vitest", "pytest",
  "go test", "cargo test", "npm test", "pnpm test". Auto-detects the
  framework. Do NOT activate for fixing failing tests (use
  ${PROJECT_NAME}-debugging), generating new tests (use ${PROJECT_NAME}-tdd),
  measuring test coverage (use ${PROJECT_NAME}-test-coverage), or
  multi-phase QA sweeps (use ${PROJECT_NAME}-guided-qa-testing).
category: ${SKILL_CATEGORY.TESTING}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Test Run

## When to Activate

- User asks to run the project's tests
- User wants to check if tests pass
- User needs test results before committing or merging

## Skip When

- User wants to fix a failing test — use ${PROJECT_NAME}-debugging
- User wants to generate new tests — use ${PROJECT_NAME}-tdd
- User wants to measure or improve coverage — use ${PROJECT_NAME}-test-coverage
- User wants a systematic multi-phase QA sweep — use ${PROJECT_NAME}-guided-qa-testing
- User wants the full Codi installation audit (contributor-only) — use ${PROJECT_NAME}-dev-e2e-testing

## Workflow

### Step 1: Detect Test Runner

**[SYSTEM]** Identify the test framework:
- \`package.json\` — look for vitest, jest, mocha in scripts or devDependencies
- \`pyproject.toml\` / \`setup.cfg\` — look for pytest configuration
- \`go.mod\` — Go uses \`go test\`
- \`Cargo.toml\` — Rust uses \`cargo test\`
- \`*.csproj\` / \`*.sln\` — .NET uses \`dotnet test\`

### Step 2: Execute the Full Test Suite

**[SYSTEM]** Run the appropriate command:
- Node.js: \`npm test\` / \`pnpm test\` / \`yarn test\`
- Python: \`pytest\`
- Go: \`go test ./...\`
- Rust: \`cargo test\`
- .NET: \`dotnet test\`

### Step 3: Report Results

**[CODING AGENT]** Summarize the outcome:
- Total: passed, failed, skipped
- For each failure:
  - Test name, file, and error message
  - Distinguish pre-existing failures from new ones — run \`git stash\` and re-run if needed to isolate
  - Suggest a specific fix
- If all tests pass, confirm with a one-line summary
`;
