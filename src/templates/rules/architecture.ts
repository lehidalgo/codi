export const template = `---
name: {{name}}
description: Architecture guidelines and design patterns
priority: high
alwaysApply: true
managed_by: codi
---

# Architecture Guidelines

## File Organization
- Respect the configured maximum file line limit — large files signal too many responsibilities
- One responsibility per module
- Group by feature or domain, not by file type — reduces cross-directory coupling when a feature changes

BAD: models/, controllers/, views/ (change one feature, touch every directory)
GOOD: users/, orders/, payments/ (all feature files colocated)

- Keep related files close together in the directory tree

## Dependencies
- Depend on abstractions, not concrete implementations — enables swapping implementations without changing callers
- No circular dependencies between modules — circular deps make code untestable and hard to reason about
- Dependencies flow inward: UI → services → domain → utilities
- Use dependency injection for testability

## Design Principles
- Reuse existing components before creating new ones — search the codebase first
- Keep business logic in services or hooks — never in UI components or controllers
- Prefer composition over inheritance — inheritance creates rigid hierarchies that are hard to change

BAD: UserController extends BaseController extends AuthController
GOOD: UserController uses AuthService and LoggingMiddleware

- Keep business logic out of UI components and controllers
- Separate concerns: data access, business rules, presentation
- Design for change: isolate likely change points behind interfaces

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
