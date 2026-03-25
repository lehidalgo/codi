export const template = `---
name: {{name}}
description: Production-grade standards — no shortcuts, migration safety, accessibility, responsive UI
priority: high
alwaysApply: true
managed_by: codi
---

# Production Mindset

## Core Principle
- Treat every project as production-grade — no workarounds, no temporary solutions
- Implement as if deploying to production TODAY
- All solutions must follow current industry standards

## Database & Migrations
- Never apply migrations that are not written to a migration file first — ad-hoc schema changes cause drift
- Only execute migrations with explicit user confirmation
- Use connection pooling appropriate to your database and expected load
- Test migrations against a copy of production schema before deploying

## UI Standards
- Ensure all UI is responsive across mobile, tablet, and desktop breakpoints
- Ensure accessibility compliance (WCAG 2.1 AA minimum) — not optional, it is a legal requirement in many jurisdictions
- Use semantic HTML elements for screen reader compatibility
- Test with keyboard navigation and screen readers

## Reliability
- Implement retries with exponential backoff for transient failures
- Set timeouts on all external calls — unbounded waits cascade into outages
- Use health checks and readiness probes in containerized deployments
- Design for graceful degradation — partial functionality is better than total failure

## No Shortcuts
- Never suppress linter errors without a documented reason
- Never skip tests to meet a deadline — technical debt compounds faster than financial debt
- Never use \\\`// @ts-ignore\\\` or equivalent without a ticket reference explaining why
- If a proper solution takes longer, discuss scope with the team — do not hack around it`;
