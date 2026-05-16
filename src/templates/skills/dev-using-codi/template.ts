import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Anchor skill loaded by the codi SessionStart hook. Establishes how to find and
  use codi skills. Required reading before ANY response, including clarifying
  questions. The 1% rule: if there is even a 1% chance a skill applies, you
  MUST invoke it. Triggers on session start, on conversation /clear, after
  /compact. Not for direct user invocation — codi loads this skill into
  context automatically; never re-read the file with the Read tool.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: false
disable-model-invocation: true
internal: true
version: 2
maintainers: ["@lehidalgo"]
---

# {{name}}

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this
skill — you already have your scoped instructions. This anchor applies to
the primary session only.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are
doing, you ABSOLUTELY MUST invoke the skill via the \`Skill\` tool.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your
way out of this.
</EXTREMELY-IMPORTANT>

## The Iron Law

**Invoke relevant or requested skills BEFORE any response or action.** Even
a 1% chance a skill might apply means you MUST invoke the skill to check.
If the invoked skill turns out to be wrong for the situation, you can
discard it and pick another — but the invocation comes first, the response
second.

## Instruction priority

User instructions always take precedence:

1. **User's explicit instructions** (CLAUDE.md, AGENTS.md, direct requests) — highest priority
2. **${PROJECT_NAME} skills** — override default system behaviour where they conflict
3. **Default system prompt** — lowest priority

If CLAUDE.md says "don't use TDD" and a skill says "always use TDD", follow
the user's instructions. The user is in control.

## How to access skills

**In Claude Code:** Use the \`Skill\` tool. When you invoke a skill its content
is loaded and presented to you — follow it directly. NEVER use the Read
tool on skill files.

**In Codex / OpenCode / Cursor:** Use the \`skill\` tool (lowercase). The
behaviour is the same.

**In other environments:** Check the platform's documentation for how
skills are loaded. ${PROJECT_NAME} ships compatibility metadata per skill
under the \`compatibility:\` frontmatter field.

## Workflow discipline

Beyond per-skill invocation, ${PROJECT_NAME} ships **6 workflows** that
turn ad-hoc dev work into a manifest-tracked pipeline:

| Workflow      | Use when                                         |
| ------------- | ------------------------------------------------ |
| \`feature\`     | building new functionality                       |
| \`bug-fix\`     | reproducing + fixing a defect                    |
| \`refactor\`    | restructuring without behaviour change           |
| \`migration\`   | schema or data change with rollback path         |
| \`project\`     | bootstrapping a project from stakeholder inputs  |
| \`quick\`       | trivial edit (typo / comment / dep-bump / format / doc-tweak) |

**Every code edit goes through one of these.** Ad-hoc edits without a
workflow row are forbidden. The shape:

\\\`\\\`\\\`bash
${PROJECT_NAME} workflow run <type> "<one-line task>" [--profile X] [--interactive]
${PROJECT_NAME} workflow advance [--as-agent]    # single-command transition
${PROJECT_NAME} workflow status --json --slim    # current phase + adaptation
${PROJECT_NAME} workflow phase-ref               # phase-ref + adaptation header
${PROJECT_NAME} quick "<task>" --category <cat>  # trivial-edit fast path
\\\`\\\`\\\`

## Decision rule for the first turn

\\\`\\\`\\\`dot
digraph anchor_flow {
    "User message received" [shape=doublecircle];
    "Active workflow?" [shape=diamond];
    "Skill might apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Read phase-ref" [shape=box];
    "Continue workflow" [shape=box];
    "Ad-hoc edit?" [shape=diamond];
    "Refuse — propose codi run / codi quick" [shape=box];
    "Respond" [shape=doublecircle];

    "User message received" -> "Active workflow?";
    "Active workflow?" -> "Read phase-ref" [label="yes"];
    "Read phase-ref" -> "Continue workflow";
    "Continue workflow" -> "Respond";
    "Active workflow?" -> "Skill might apply?" [label="no"];
    "Skill might apply?" -> "Invoke Skill tool" [label="yes (≥1% chance)"];
    "Invoke Skill tool" -> "Respond";
    "Skill might apply?" -> "Ad-hoc edit?" [label="no"];
    "Ad-hoc edit?" -> "Refuse — propose codi run / codi quick" [label="yes"];
    "Refuse — propose codi run / codi quick" -> "Respond";
    "Ad-hoc edit?" -> "Respond" [label="no"];
}
\\\`\\\`\\\`

## Red Flags (rationalization killers)

These thoughts mean you are about to break the Iron Law. STOP.

| If you find yourself thinking…                              | The truth is…                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| "This is just a clarifying question, no skill needed."     | Questions are tasks too — \`discover\`, \`brainstorming\` may apply.            |
| "The user just wants a quick answer."                       | Quick answers built on wrong assumptions are worse than slower correct ones. |
| "I'll invoke the skill if the answer turns out to need it." | Invocation comes BEFORE the answer. After is too late.                       |
| "It's a one-line edit, why bother with a workflow?"         | \`codi quick\` is the workflow for one-line edits. Use it.                     |
| "I already know what to do, the skill would slow me down."  | The skill captures what you would forget. Use it.                            |
| "Reading the skill file is the same as invoking it."        | NO. \`Read\` does not put the skill in your active instruction stack.          |

## Boundaries

- This skill is an anchor. It does NOT replace per-workflow phase-refs;
  read those via \`codi workflow phase-ref\` once a workflow is active.
- This skill is loaded via SessionStart hook. Do not invoke it manually
  (\`disable-model-invocation: true\`).
- This skill does not enforce workflow discipline at runtime — that lives
  in the gate runner and pre-tool-use hook. This skill establishes the
  cognitive priors.
`;
