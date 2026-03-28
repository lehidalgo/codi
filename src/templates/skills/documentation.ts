export const template = `---
name: {{name}}
description: Documentation creation and maintenance workflows. Use when writing docs, updating README, generating API documentation, or creating architecture decision records.
compatibility: [claude-code, cursor, codex]
managed_by: codi
---

# {{name}}

## When to Use

Use when creating, updating, or reviewing project documentation.

## When to Activate

- User asks to write or update a README, API docs, or architecture decision record
- User needs to add JSDoc, docstrings, or inline documentation to code
- User wants to generate documentation from existing code or APIs
- User asks to review documentation for accuracy or completeness
- User needs to create an onboarding guide or contributing guide

## Diataxis Framework

Before writing, classify the documentation type:
- **Tutorial**: learning-oriented, step-by-step guided experience
- **How-to Guide**: task-oriented, solving a specific problem
- **Reference**: information-oriented, factual description of APIs/config
- **Explanation**: understanding-oriented, discussing concepts and reasoning

Do not mix types in one document — a tutorial should not include exhaustive reference tables.

## Documentation Types

### README

**[CODING AGENT]** Structure:
1. Read existing README (if any)
2. Include these sections in order:
   - **Overview**: what the project does (1-3 sentences)
   - **Quick Start**: install + first usage (copy-paste ready)
   - **Usage**: key commands or API with examples
   - **Configuration**: options, environment variables, config files
   - **Contributing**: how to set up dev environment and submit changes
3. Keep total under 300 lines — link to separate guides for details
4. Include badges (CI status, version, license) at the top

### API Documentation

**[CODING AGENT]** For each endpoint or public function:
1. Method, path, and description
2. Parameters with types and required/optional status
3. Request body schema (if applicable)
4. Response schema with status codes
5. Working example (curl, fetch, or SDK call)

Use OpenAPI/Swagger for REST APIs. Use JSDoc/TypeDoc for library code.

### Architecture Decision Records (ADR)

**[HUMAN]** Provide the context and decision.

**[CODING AGENT]** Format as:
1. **Title**: short description of the decision
2. **Status**: proposed, accepted, deprecated, superseded
3. **Context**: what problem prompted this decision
4. **Decision**: what was decided and why
5. **Consequences**: trade-offs, what changes, what to watch for

Store in \\\`docs/adr/\\\` with numbered filenames (\\\`001-use-postgres.md\\\`).

### Code Comments

**[CODING AGENT]** Rules:
- Add JSDoc/docstring to all public APIs (functions, classes, interfaces)
- Comment the WHY, not the WHAT — the code shows what, comments explain why
- Remove commented-out code — version control has the history
- Use TODO with ticket references: \\\`// TODO(JIRA-123): migrate to v2 endpoint\\\`

## Docs-as-Code Workflow

- Store documentation in the same repository as code — changes ship together in the same PR
- Auto-generate API reference from OpenAPI specs or code annotations where possible
- Use CI to validate documentation: lint markdown, check broken links, test code examples

## Quality Checklist

- [ ] Language is clear and concise
- [ ] Classified by Diataxis type (tutorial, how-to, reference, explanation)
- [ ] Code examples are copy-paste ready and tested
- [ ] No outdated references to removed features
- [ ] Links work and point to current resources
- [ ] Diagrams use Mermaid (not ASCII art)
`;
