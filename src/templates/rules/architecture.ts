import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Architecture guidelines, design patterns, and module boundaries
priority: high
alwaysApply: true
managed_by: ${PROJECT_NAME}
version: 2
---

# Architecture Guidelines

## File Organization
- Respect the configured maximum file line limit — large files signal too many responsibilities
- One responsibility per module
- Group by feature or domain, not by file type — reduces cross-directory coupling when a feature changes

BAD: models/, controllers/, views/ (change one feature, touch every directory)
GOOD: users/, orders/, payments/ (all feature files colocated)

- Keep related files close together in the directory tree

## Modular Monolith First
- Start with a modular monolith — extract microservices only when scaling demands prove the boundary is stable
- Enforce module boundaries at compile time (internal packages, module visibility) — boundaries without enforcement erode
- Use event-driven communication between modules when preparing for future extraction

## Architecture Patterns
- Use hexagonal architecture (ports and adapters) for core domains — separate business logic from infrastructure through defined ports
- Consider vertical slice architecture for feature delivery — each use case is self-contained with its own handler, validation, and persistence
- Use CQRS when read and write models have divergent requirements — do not apply it everywhere by default
- Define bounded contexts to identify module boundaries — a module owns its data and exposes only contracts

## Dependencies
- Depend on abstractions, not concrete implementations — enables swapping implementations without changing callers
- No circular dependencies between modules — circular deps make code untestable and hard to reason about
- Dependencies flow inward: UI → services → domain → utilities
- The presentation layer (cli/, web/, ui/) imports FROM the domain (core/, runtime/) — the domain NEVER imports from the presentation layer. If a domain module needs a symbol that currently lives in presentation, the symbol is misplaced — move it down to the domain
- For each new "upward" import you would write, prefer in order: (1) move the imported symbol down a layer if it is presentation-agnostic data/types/errors, (2) pass the presentation-side value as a function parameter from the composition root, (3) only as a last resort, define a port interface in the domain and implement it in the presentation layer
- Use dependency injection for testability
- Use path aliases (\`#src/*\`, \`@/*\`) for cross-module imports — makes dependency direction visible and survives file moves

## Design Principles
- Reuse existing components before creating new ones — search the codebase first
- Keep business logic in services or hooks — never in UI components or controllers
- Prefer composition over inheritance — inheritance creates rigid hierarchies that are hard to change

BAD: UserController extends BaseController extends AuthController
GOOD: UserController uses AuthService and LoggingMiddleware

- Separate concerns: data access, business rules, presentation
- Design for change: isolate likely change points behind interfaces

## Event-Driven Communication
- Use the Outbox Pattern to guarantee at-least-once event delivery without distributed transactions
- Use the Inbox Pattern for message idempotency at the consumer side
- Prefer async events between modules over synchronous calls — reduces coupling and enables independent scaling

## API Boundaries
- Define clear contracts between modules
- Use types/interfaces at module boundaries — catches integration errors at compile time
- Validate data at system boundaries, trust internal data
- Keep internal implementation details private

## Avoid Over-Engineering
- Solve the current problem, not hypothetical future ones
- Three similar lines are better than a premature abstraction — wait for the pattern to emerge
- Add complexity only when it reduces overall system complexity
- If in doubt, choose the simpler approach`;
