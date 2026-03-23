import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';

const TEMPLATES: Record<string, string> = {
  security: `---
name: {{name}}
description: Security best practices and vulnerability prevention
priority: high
alwaysApply: true
managed_by: user
---

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
- Implement proper error handling that does not leak internal details`,

  'code-style': `---
name: {{name}}
description: Code style and formatting conventions
priority: medium
alwaysApply: true
managed_by: user
---

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
- Use TODO/FIXME with ticket references, not open-ended notes`,

  testing: `---
name: {{name}}
description: Testing standards and TDD workflow
priority: medium
alwaysApply: true
managed_by: user
---

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
- Reset mocks between tests to avoid leaking state`,

  architecture: `---
name: {{name}}
description: Architecture guidelines and design patterns
priority: high
alwaysApply: true
managed_by: user
---

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
- If in doubt, choose the simpler approach`,

  'git-workflow': `---
name: {{name}}
description: Git workflow and commit conventions
priority: medium
alwaysApply: true
managed_by: user
---

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
- Tag releases with semantic versions (vMAJOR.MINOR.PATCH)`,

  'error-handling': `---
name: {{name}}
description: Error handling and resilience patterns
priority: high
alwaysApply: true
managed_by: user
---

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
- Leave the system in a consistent state after errors`,

  performance: `---
name: {{name}}
description: Performance optimization guidelines
priority: medium
alwaysApply: true
managed_by: user
---

# Performance Guidelines

## Database & Queries
- Avoid N+1 queries — use eager loading or batch fetching
- Add indexes for frequently queried columns
- Use pagination for list endpoints — never return unbounded results
- Select only needed columns, not SELECT *

## Async & Concurrency
- Parallelize independent async operations (Promise.all or equivalent)
- Do not block the main thread with synchronous I/O
- Use connection pooling for database and HTTP clients
- Set appropriate timeouts on all async operations

## Caching
- Cache expensive computations and frequently accessed data
- Define cache invalidation strategy before adding a cache
- Use appropriate TTLs — stale data is worse than no cache
- Cache at the right level: in-memory, CDN, or distributed

## Payload & Transfer
- Minimize payload sizes — send only what the client needs
- Compress responses (gzip/brotli) for text-based formats
- Use streaming for large data transfers
- Implement efficient serialization formats

## General
- Measure before optimizing — profile to find actual bottlenecks
- Lazy load resources that are not immediately needed
- Prefer algorithms with better time complexity for large datasets
- Set performance budgets and monitor regressions`,

  documentation: `---
name: {{name}}
description: Documentation standards and practices
priority: medium
alwaysApply: true
managed_by: user
---

# Documentation Standards

## Code Documentation
- Write self-documenting code first — clear names, small functions
- Add JSDoc/docstrings to all public APIs: purpose, parameters, return value, examples
- Document non-obvious behavior with inline comments (WHY, not WHAT)
- Keep documentation close to the code it describes

## Project Documentation
- Keep README up to date with every significant change
- Include: what the project does, how to install, how to use, how to contribute
- Document environment setup and prerequisites
- Provide working examples that can be copy-pasted

## Architecture Documentation
- Document high-level architecture decisions and their rationale
- Use Architecture Decision Records (ADRs) for significant choices
- Include diagrams for complex system interactions
- Keep architecture docs updated when the system evolves

## API Documentation
- Document all endpoints: method, path, parameters, request/response bodies
- Include example requests and responses
- Document error responses and status codes
- Version the documentation alongside the API

## Maintenance
- Remove outdated documentation — wrong docs are worse than no docs
- Review documentation during code review
- Use automated tools to detect broken links and examples
- Write documentation as part of the feature, not after`,

  'api-design': `---
name: {{name}}
description: API design conventions and best practices
priority: medium
alwaysApply: true
managed_by: user
---

# API Design

## RESTful Conventions
- Use nouns for resources: /users, /orders (not /getUsers, /createOrder)
- Use HTTP methods for actions: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- Use plural nouns for collections: /users not /user
- Nest related resources: /users/:id/orders

## Request & Response
- Validate all request bodies at the API boundary
- Return consistent response format: { data, error, meta }
- Return consistent error format: { code, message, details }
- Use proper HTTP status codes: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 404 (Not Found), 500 (Internal Error)

## Versioning & Evolution
- Version APIs from day one: /api/v1/ or Accept header
- Add new fields as optional — do not remove existing fields
- Deprecate endpoints gracefully with sunset headers
- Document breaking changes in changelogs

## Pagination & Filtering
- Paginate all list endpoints with cursor or offset pagination
- Support filtering: ?status=active&created_after=2024-01-01
- Support sorting: ?sort=created_at&order=desc
- Return pagination metadata: total count, next/previous links

## Security & Limits
- Implement rate limiting on all public endpoints
- Return rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining
- Require authentication for sensitive operations
- Log all API access for audit trails`,
};

export const AVAILABLE_TEMPLATES = Object.keys(TEMPLATES);

export function loadTemplate(templateName: string): Result<string> {
  const content = TEMPLATES[templateName];
  if (!content) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `template:${templateName}`,
    })]);
  }
  return ok(content);
}
