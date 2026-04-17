import {
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
  SKILL_CATEGORY,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Documentation creation and maintenance for consumer projects. Use when the
  user asks to write or update a README, API reference, OpenAPI spec, ADR,
  contributing guide, changelog, RFC, spec document, JSDoc, docstrings, or
  inline code documentation. Also activate for phrases like "write the
  README", "document this API", "technical writing", "draft a proposal",
  "write an RFC", "author a decision doc", "co-author a spec". Applies the
  Diataxis framework (tutorial / how-to / reference / explanation). Do NOT
  activate for branded PDF reports or proposals (use ${PROJECT_NAME}-content-factory),
  Word documents (use ${PROJECT_NAME}-docx), slide decks (use
  ${PROJECT_NAME}-content-factory or ${PROJECT_NAME}-pptx), or
  ${PROJECT_NAME_DISPLAY}'s own self-documentation (use ${PROJECT_NAME}-dev-docs-manager).
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 7
---

# {{name}} — Project Documentation

## When to Activate

- User asks to write or update a README, API docs, or architecture decision record
- User needs to add JSDoc, docstrings, or inline documentation to code
- User wants to generate documentation from existing code or APIs
- User asks to review documentation for accuracy or completeness
- User needs to create an onboarding guide or contributing guide
- User mentions writing docs, drafting proposals, specs, decision docs, or RFCs
- User wants to co-author a document through structured iteration

## Skip When

- User wants a branded PDF report or proposal — use ${PROJECT_NAME}-content-factory
- User wants a Word document (.docx) — use ${PROJECT_NAME}-docx
- User wants a slide deck or presentation — use ${PROJECT_NAME}-content-factory or ${PROJECT_NAME}-pptx
- User wants to regenerate ${PROJECT_NAME_DISPLAY}'s own docs site — use ${PROJECT_NAME}-dev-docs-manager
- User wants to humanize AI-sounding text — use ${PROJECT_NAME}-humanizer after this skill

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

## Co-Authoring Workflow

For substantial documents (proposals, specs, decision docs), offer this 3-stage workflow:

### Stage 1 — Context Gathering

**Goal:** Close the gap between what the user knows and what the agent knows.

1. Ask meta-context: document type, audience, desired impact, format/template, constraints
2. Encourage an info dump: background, related discussions, alternative solutions, organizational context, timeline pressures, technical dependencies, stakeholder concerns
3. Ask 5-10 clarifying questions based on gaps
4. Continue until edge cases and trade-offs can be discussed without needing basics explained

### Stage 2 — Refinement & Structure

**Goal:** Build the document section by section through brainstorming, curation, and iteration.

For each section:
1. **Clarify**: Ask what to include in this section
2. **Brainstorm**: Generate 5-20 candidate points (look for forgotten context, new angles)
3. **Curate**: User selects what to keep/remove/combine
4. **Gap check**: Ask if anything important is missing
5. **Draft**: Write the section using \\\`str_replace\\\` or file edits
6. **Refine**: Iterate with surgical edits until the user is satisfied

Start with whichever section has the most unknowns. Leave summary sections for last.

After 80%+ of sections are done, re-read the entire document checking for: flow and consistency, redundancy, filler content, and whether every sentence carries weight.

### Stage 3 — Reader Testing

**Goal:** Test the document with a fresh perspective to catch blind spots.

1. Predict 5-10 reader questions
2. If subagents are available: test each question with a fresh agent (no conversation context)
3. If no subagents: guide the user to test in a fresh conversation
4. Also check for: ambiguity, false assumptions, contradictions
5. Fix any issues found, then loop back to refinement if needed

**Exit condition:** Reader consistently answers questions correctly with no new gaps.

## Quality Checklist

- [ ] Language is clear and concise
- [ ] Classified by Diataxis type (tutorial, how-to, reference, explanation)
- [ ] Code examples are copy-paste ready and tested
- [ ] No outdated references to removed features
- [ ] Links work and point to current resources
- [ ] Diagrams use Mermaid (not ASCII art)

## Available Agents

For specialized analysis, delegate to this agent:
- **${PROJECT_NAME}-docs-lookup** — Research API signatures, verify deprecations, find examples. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/docs-lookup.md]]\\\`

## Related Skills

- **${PROJECT_NAME}-codebase-onboarding** — Understand project structure before writing docs
`;
