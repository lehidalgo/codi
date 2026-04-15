import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Design exploration before implementation. Use before starting any non-trivial feature,
  change, or document. Explores context, asks clarifying questions, proposes approaches,
  and produces an approved design spec before invoking any implementation skill.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 9
---

# {{name}}

## HARD GATE

> **DO NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has explicitly approved it. This applies to ALL requests regardless of perceived simplicity.**

## Anti-Pattern: This Is Too Simple To Need A Design

Every project goes through this process. A single-function utility, a config change, a refactor - all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be three sentences for truly simple things. But it MUST be presented and approved before any implementation action is taken.

Skipping the design for "simple" tasks is the most common way to waste an hour rebuilding something that was already done, or building the wrong thing with the right implementation.

## When to Activate

- User asks to design, build, create, or implement any non-trivial feature
- User wants to explore approaches before coding
- User mentions a new requirement that needs design decisions
- Another skill detects a complex multi-step task that needs design before execution
- User says "let's brainstorm", "help me think through", "what's the best way to"

**Skip this skill for:**
- Pure quality tasks (security scan, code review, test coverage) - these have their own activation criteria
- Pure content tasks where requirements are already fully specified with zero ambiguity
- One-liner fixes with absolutely zero design ambiguity (e.g., "fix this typo")

## The Checklist

Execute these steps in order. Do not skip steps.

1. **Explore project context** - check code graph (per ${PROJECT_NAME}-workflow), recent commits, relevant files, existing patterns
2. **Ask clarifying questions** - one at a time, understand purpose, constraints, success criteria
3. **Propose 2-3 approaches** - with trade-offs and recommendation
4. **Present design sections** - get approval after each major section
5. **Detect task type and pipeline** - determine which pipeline applies (see Pipeline Detection below)
6. **Write design spec** - save to \\\`docs/\\\` using codi naming convention
7. **Spec self-review** - placeholder scan, consistency check, ambiguity check
8. **User review gate** - ask user to review the written spec
9. **Invoke next skill** - based on detected pipeline

## Process: Exploring Context

Before asking any questions:

- Check code graph (MCP \\\`graph-code\\\` if available) - understand structure, callers, dependencies
- Read related files and existing patterns
- Check recent commits: \\\`git log --oneline -10\\\`
- Look for the same pattern already solved elsewhere in the codebase

Understand existing patterns BEFORE proposing anything. Follow existing patterns unless there is a good reason not to. State explicitly which existing patterns you found and which you are following.

**For large requests:** If the request describes multiple independent subsystems, decompose first. Help the user identify independent pieces, their order, and their scope. Each sub-project gets its own brainstorm → design → implementation cycle.

## Process: Clarifying Questions

- One question per message - never multiple at once
- Prefer multiple choice when possible (easier to answer than open-ended)
- Focus on: purpose, constraints, success criteria, scale, edge cases
- Ask only what you cannot infer from the codebase
- Stop asking when you can confidently propose 2-3 approaches

BAD: "What do you want it to do, who will use it, what's the performance target, and should it be async?"
GOOD: "What is the primary purpose - is this for (a) end users, (b) internal tooling, or (c) a library API?"

## Process: Proposing Approaches

- Always propose exactly 2-3 approaches (never just one)
- Lead with your recommended option and explain why
- Include trade-offs for each: simplicity, performance, maintainability, risk
- Apply YAGNI ruthlessly - remove features from designs that are not needed yet
- Design for isolation: each component has one purpose, communicates through defined interfaces, and can be understood and tested independently

## Process: Presenting Design

Scale each section to its complexity:
- Three sentences if the task is simple
- Up to 300 words if the section is genuinely nuanced

Sections to cover (omit any that do not apply):
- Architecture: overall structure and boundaries
- Components: what each piece does and how it connects
- Data flow: how data moves through the system
- Error handling: how failures are detected and surfaced
- Testing approach: what tests are needed and at what level

Ask after each major section: "Does this section look right before I continue?"

Be ready to revise any section before proceeding.

## Pipeline Detection

After design is approved, identify the pipeline and tell the user which one was detected:

| Task Type | Detection Signals | Next Skill |
|-----------|-------------------|------------|
| **Implementation** | New feature, bug fix, refactor, API change, database change | \\\`${PROJECT_NAME}-plan-writer\\\` |
| **Content** | Blog post, report, deck, documentation, README | Appropriate content skill (\\\`${PROJECT_NAME}-content-factory\\\` / \\\`${PROJECT_NAME}-doc-engine\\\` / \\\`${PROJECT_NAME}-project-documentation\\\`) |
| **Quality** | Security audit, code review, test coverage | Skip brainstorming entirely - go directly to quality skill |

Say explicitly: "This is an [implementation / content / quality] task. I will invoke [skill name] next."

## Writing the Design Spec

After design approval, save the spec:

- Path: \\\`docs/YYYYMMDD_HHMMSS_[PLAN]_<feature-name>.md\\\`
- Follow codi's doc naming convention (from ${PROJECT_NAME}-documentation rule)
- Use Mermaid for all diagrams - no ASCII art, no custom colors, no \\\`\\\\n\\\` in labels (codi convention)
- Commit the spec to git before invoking any next skill

**Spec self-review** (fix inline before presenting to user - no need to re-review these):

1. **Placeholder scan**: any "TBD", "TODO", incomplete sections? Fix them.
2. **Consistency check**: do sections contradict each other?
3. **Scope check**: is this one implementation plan or does it need decomposition into sub-projects?
4. **Ambiguity check**: could any requirement be interpreted two ways? Pick one interpretation explicitly.

## User Review Gate

After writing and self-reviewing the spec, present this message:

> "Spec written to \\\`<path>\\\`. Please review it and let me know if you want changes before we start implementation."

Wait for explicit approval. If changes are requested: make them, re-run the self-review, then ask again. Only proceed on explicit "looks good", "approved", "go ahead", or equivalent.

## Invoking the Next Skill

For implementation tasks:
> "Invoking ${PROJECT_NAME}-plan-writer to create the implementation plan."

For content tasks:
> "Invoking [skill name] to generate the content."

Do NOT skip to writing code or calling any other skill before the user has approved the spec.

## Key Principles

- One question at a time
- YAGNI ruthlessly - solve the current problem, not hypothetical future ones
- Always 2-3 approaches before settling on one
- Incremental validation - present a section, get approval, continue
- Check existing patterns before proposing new ones (use code graph)
- Design for clarity: can someone understand a component without reading its internals?
- Never invent file paths, function names, or API shapes - verify they exist before referencing them

## Visual Companion

A browser-based companion for showing mockups, diagrams, and visual options during brainstorming. Available as a tool - not a mode. Accepting the companion means it is available for questions that benefit from visual treatment; it does NOT mean every question goes through the browser.

**Offering the companion:** When you anticipate that upcoming questions will involve visual content (mockups, layouts, diagrams), offer it once for consent - in its OWN message with no other content:
> "Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. Want to try it? (Requires opening a local URL)"

Wait for the user's response before continuing. If they decline, proceed with text-only brainstorming.

**Per-question decision:** Even after the user accepts, decide FOR EACH QUESTION whether to use the browser or the terminal. The test: would the user understand this better by seeing it than reading it?

- Use the browser for content that IS visual: mockups, wireframes, layout comparisons, architecture diagrams, side-by-side visual designs
- Use the terminal for content that is text: requirements questions, conceptual choices, tradeoff lists, scope decisions

A question about a UI topic is not automatically a visual question. "What does personality mean in this context?" is a conceptual question - use the terminal. "Which wizard layout works better?" is a visual question - use the browser.

If the user agrees to the companion, read the detailed guide before proceeding: \\\`\${CLAUDE_SKILL_DIR}[[/references/visual-companion.md]]\\\`

## Spec Review Subagent

Before presenting the spec to the user, dispatch a subagent with \\\`\${CLAUDE_SKILL_DIR}[[/references/spec-document-reviewer-prompt.md]]\\\` to review for completeness, consistency, and clarity. Fix any issues the subagent reports inline before asking the user to review.
`;
