## Permissions

Keep source code files under 700 lines. Documentation files have no line limit.
Do NOT use force push (--force) on git operations.
All changes require pull request review before merging.
Maximum context window: 50000 tokens.

## architecture

# Architecture Guidelines

## File Organization
- Respect the configured maximum file line limit
- One responsibility per module
- Group by feature or domain, not by file type
- Keep related files close together in the directory tree

## Dependencies
- Depend on abstractions, not concrete implementations
- No circular dependencies between modules
- Dependencies flow inward: UI → services → domain → utilities
- Use dependency injection for testability

## Design Principles
- Prefer composition over inheritance
- Keep business logic out of UI components and controllers
- Separate concerns: data access, business rules, presentation
- Design for change: isolate likely change points behind interfaces

## API Boundaries
- Define clear contracts between modules
- Use types/interfaces at module boundaries
- Validate data at system boundaries, trust internal data
- Keep internal implementation details private

## Avoid Over-Engineering
- Solve the current problem, not hypothetical future ones
- Three similar lines are better than a premature abstraction
- Add complexity only when it reduces overall system complexity
- If in doubt, choose the simpler approach

## code-style

# Code Style

## Naming Conventions
- Variables and functions: camelCase
- Classes, interfaces, and types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for modules, PascalCase for components
- Booleans: prefix with is, has, can, should (e.g., isActive, hasPermission)

## Functions
- Keep functions under 30 lines — extract when longer
- Single responsibility: one function does one thing
- Pure functions preferred: same input always produces same output
- Limit parameters to 3 — use an options object for more

## File Organization
- One primary export per file where practical
- Group imports: external libraries, internal modules, types
- Order imports alphabetically within each group
- Keep files focused on a single concern

## Error Handling
- Never silently swallow errors (empty catch blocks)
- Handle errors at the appropriate level, not everywhere
- Use typed errors when the language supports them
- Always clean up resources in finally blocks

## Comments
- Write self-documenting code first
- Comment the WHY, not the WHAT
- Remove commented-out code — version control has the history
- Use TODO/FIXME with ticket references, not open-ended notes

## error-handling

# Error Handling

## Core Principles
- Never silently swallow errors — every error must be handled or propagated
- Use typed errors with error codes for programmatic handling
- Return Result types for recoverable operations
- Throw/raise only for programmer errors (bugs), not expected failures

## Error Messages
- Write actionable error messages: what happened, why, and how to fix it
- Include relevant context: operation, input, expected vs actual
- Never expose internal details (stack traces, SQL) to end users
- Log full details server-side, return sanitized messages to clients

## Logging
- Log errors with structured context (who, what, where, when)
- Use appropriate severity levels: debug, info, warn, error, fatal
- Include correlation IDs for request tracing
- Do not log sensitive data (passwords, tokens, PII)

## Resilience
- Implement timeouts for all external calls
- Use retries with exponential backoff for transient failures
- Provide fallback behavior where appropriate
- Fail fast on configuration errors at startup, not at runtime

## Cleanup
- Always release resources in finally blocks or equivalent
- Close database connections, file handles, and network sockets
- Roll back partial operations on failure
- Leave the system in a consistent state after errors

## git-workflow

# Git Workflow

## Commit Messages
- Use conventional commits format: type(scope): description
- Types: feat, fix, docs, refactor, test, chore, perf, ci
- Write in imperative mood: "add feature" not "added feature"
- First line under 72 characters, details in body

## Commit Practices
- Make atomic commits: one logical change per commit
- Every commit should leave the codebase in a working state
- Review your diff before committing
- Do not commit generated files, build artifacts, or secrets

## Branch Strategy
- Branch from main for all work
- Use descriptive branch names: feature/, fix/, chore/
- Keep branches short-lived and focused
- Delete branches after merging

## Safety
- Never force push to main or shared branches
- Always pull before pushing to avoid unnecessary merge conflicts
- Resolve merge conflicts carefully — understand both sides
- Tag releases with semantic versions (vMAJOR.MINOR.PATCH)

## security

# Security Rules

## Secret Management
- Never hardcode secrets, API keys, tokens, or credentials in source code
- Use environment variables or secret managers for all sensitive configuration
- Add .env files to .gitignore — never commit them
- Rotate secrets immediately if exposed in version control

## Input Validation
- Validate and sanitize ALL user input at system boundaries
- Use parameterized queries to prevent SQL injection
- Escape output to prevent XSS (cross-site scripting)
- Validate file uploads: check type, size, and content

## Authentication & Authorization
- Protect authentication endpoints with rate limiting
- Use secure password hashing (bcrypt, argon2) — never store plaintext
- Implement proper session management with secure cookie flags
- Apply principle of least privilege for all access control

## Dependencies
- Audit dependencies regularly for known vulnerabilities
- Pin dependency versions in lock files
- Remove unused dependencies promptly
- Prefer well-maintained packages with active security practices

## General
- Follow OWASP Top 10 guidelines
- Log security events without exposing sensitive data
- Use HTTPS for all external communications
- Implement proper error handling that does not leak internal details

## testing

# Testing Standards

## Coverage & Requirements
- Maintain minimum 80% code coverage
- All new features require tests before merging
- All bug fixes require a regression test
- Critical paths require integration tests

## Test-Driven Development (TDD)
1. RED: Write a failing test that describes the expected behavior
2. GREEN: Write the minimal implementation to make it pass
3. REFACTOR: Improve the code while keeping tests green

## Test Structure
- Follow arrange-act-assert (AAA) pattern
- One assertion per test when practical
- Use descriptive names: "should [behavior] when [condition]"
- Keep tests independent — no shared mutable state between tests

## What to Test
- Business logic and domain rules
- Edge cases: empty inputs, nulls, boundaries, overflow
- Error paths: invalid input, network failures, timeouts
- Integration points: API endpoints, database operations

## What NOT to Test
- Framework internals or third-party library behavior
- Trivial getters/setters with no logic
- Implementation details (test behavior, not structure)

## Mocking
- Mock only external dependencies (APIs, databases, file system)
- Do not mock the module under test
- Prefer fakes and stubs over complex mock frameworks
- Reset mocks between tests to avoid leaking state

## Skill: rule-management

# rule-management

## When to Use

Use this skill when the user asks to create, modify, or update codi rules.

## Rule Format

Rules are Markdown files in `.codi/rules/custom/` with YAML frontmatter:

```markdown
---
name: rule-name
description: One-line description
priority: high | medium | low
alwaysApply: true
managed_by: user | codi
---

# Rule Title

## Section
- Specific, actionable guideline
- Include measurable criteria where possible
```

## Creating a New Rule

1. Run: `codi add rule <name>` (blank) or `codi add rule <name> --template <template>`
2. Edit `.codi/rules/custom/<name>.md` with the team's guidelines
3. Run: `codi generate` to push the rule to all agent configs
4. Run: `codi status` to verify no drift

## Modifying an Existing Rule

1. Edit the file in `.codi/rules/custom/`
2. If the rule has `managed_by: codi` and you want to keep custom changes, change it to `managed_by: user`
3. Run: `codi generate`

## managed_by Field

- `managed_by: codi` — template-managed, updated by `codi update --rules`
- `managed_by: user` — custom, never overwritten by codi

## Available Templates

security, code-style, testing, architecture, git-workflow, error-handling, performance, documentation, api-design

Add all at once: `codi add rule --all`

## Writing Guidelines

- Be specific: "Use 2-space indentation" not "Use consistent indentation"
- Be measurable: "80% test coverage" not "Write enough tests"
- Use imperative mood: "Validate all inputs" not "Inputs should be validated"
- Group under clear section headings
- Explain WHY when not obvious

## After Changes

Always run `codi generate` after modifying rules to update all agent config files.

## Codi Verification

This project uses Codi for unified AI agent configuration.
When asked "verify codi" or "codi verify", respond with:
- Verification token: `codi-61672e`
- Rules loaded: [list the rule names you see in this file]
- Flags active: [list any permission constraints from this file]