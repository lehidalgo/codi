# The devloop skill standard (full reference)

This document expands the at-a-glance checklist in `SKILL.md` with rationale. Synthesizes the conventions from Anthropic's skill-authoring best practices, codi's `skill-creator`, and devloop's earlier `write-a-skill`.

## Frontmatter — devloop standard (codi-aligned)

Devloop converges on codi's `.claude/skills` pattern: `name` + `description` + `user-invocable` only. Other Anthropic-permitted fields are tolerated but not encouraged. Tool-restriction fields are forbidden in SKILL.md.

### Required (every skill)

| Field         | Purpose                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `name`        | Kebab-case identifier, ≤64 chars                                         |
| `description` | Discovery field, ≤1024 chars; pack triggers + symptoms + call sites here |

### Devloop-preferred optional

| Field            | Values                     | Use when                                                     |
| ---------------- | -------------------------- | ------------------------------------------------------------ |
| `user-invocable` | `true` (default) / `false` | `false` for internal/programmatic-only skills (codi pattern) |

### Devloop-forbidden (validator HIGH violation)

| Field           | Reason                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `allowed-tools` | Tool restrictions belong in `plugin.json` or `contract.json`, not SKILL.md. Codi pattern excludes it. |
| `when_to_use`   | Invented field; fold its content into `description`.                                                  |
| `context`       | Invented field; declare fork policy in `contract.json`.                                               |

### Anthropic-permitted but tolerated

| Field                      | Purpose                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `metadata`                 | Block with `version`, `priority`, `docs`, `sitemap`, `pathPatterns`, `bashPatterns` |
| `retrieval`                | Block with `aliases`, `intents`, `entities`                                         |
| `validate`                 | Array of `pattern`/`message`/`severity`/`upgradeToSkill` rules                      |
| `license`                  | License identifier (e.g., "Apache-2.0")                                             |
| `category`                 | Taxonomy bucket                                                                     |
| `parent`                   | Parent skill name (hierarchical)                                                    |
| `summary`                  | Short summary                                                                       |
| `disable-model-invocation` | Equivalent to `user-invocable: false`; devloop prefers `user-invocable`             |
| `role`                     | Role-specific skill                                                                 |
| `argument-hint`            | For slash commands                                                                  |
| `chainTo`                  | Pattern-based auto-chain                                                            |

### Discovery rationale

Codi's `.claude/skills` (15 sampled) all use exactly `name` + `description` + `user-invocable: true`. Anthropic-bundled plugins (206 sampled across sentry, stripe, vercel, codex, marketing-skills) use a richer field set including `metadata`, `retrieval`, `validate`, etc.

Devloop converges on the minimal codi pattern because:

1. The discovery story is the description — additional fields like `retrieval` add complexity without clear benefit at our scale.
2. Tool restrictions in SKILL.md (`allowed-tools`) duplicate plugin-level config and create drift.
3. `user-invocable` is the cleaner field name vs `disable-model-invocation` (codi's choice).

### `name`

- Lowercase kebab-case (`feature-workflow`, `code-review`).
- Letters, digits, hyphens only. No parentheses, special characters, or capitals.
- ≤64 characters.
- Avoid generic names ("helper", "utils", "tools").
- Prefer gerund or imperative form: `creating-skills`, `reviewing-code`, `writing-plans`.

### `description`

The single most important field for skill discovery. Claude uses it to choose among 100+ skills. Pack triggers, symptoms, and call-site context here — there is no second discovery field.

**Rules:**

1. **Starts with `Use when …`.**
2. **Third person only.** "I", "my", "you", "we", "our" are forbidden. The description is injected into the system prompt; first/second person breaks discovery.
3. **No workflow summary.** Do NOT describe the modes, phases, or steps inline. Doing so creates a shortcut Claude follows instead of reading the body, and produces incomplete behavior.
4. **Lists triggers and symptoms.** Concrete phrases the user might say or contexts that signal this skill applies.
5. **Names call sites.** Workflow phases that invoke this skill, plus the standalone slash-command, all in one paragraph.
6. **Body pointer.** End with one short sentence pointing to what the body documents.
7. **≤1024 chars.**

**Example — bad:**

> Code review discipline — both directions. Two modes — request (dispatch reviewer subagent, package context, act on feedback) and receive (handle feedback without sycophancy, verify before implementing).

Reasons it is bad: not "Use when", workflow summary forces Claude to skip the body, names modes inline.

**Example — good:**

> Use when code needs review or when external review feedback has just arrived. Triggers on "request review", "review the code", "review feedback came in", after a major feature lands, before merge to main. Phase verify of any workflow opt-in. Standalone via `/devloop:code-review`. Body documents the two modes and the severity ladder.

### `allowed-tools`

Explicit list. Match the tools the skill actually uses. Constrain Bash to specific commands (`Bash(git log:*)` not `Bash(*)`).

### `disable-model-invocation`

Set `true` for user-invoked-only skills (like `zoom-out`, `caveman`). Omit otherwise.

## Body structure

### Required sections

| Section                            | Purpose                                             |
| ---------------------------------- | --------------------------------------------------- |
| Hook / hard gate (when applicable) | Single-paragraph statement of the load-bearing rule |
| Pick-a-mode table or When-to-use   | How to enter the skill                              |
| Core principle / Process           | The actual technique                                |
| Anti-patterns / Common mistakes    | What goes wrong + counters                          |
| References                         | Links to detailed `references/*.md`                 |
| Termination / Events               | When the skill is done; what manifest events fire   |
| Boundaries                         | What this skill does NOT do; sibling-skill pointers |

### Word-count targets

| Skill type                                       | Target                                                    |
| ------------------------------------------------ | --------------------------------------------------------- |
| Frequently loaded (workflow phase prerequisites) | <200 words                                                |
| Discipline skill (TDD, verify-evidence)          | <300 words                                                |
| Multi-mode skill                                 | <500 words in SKILL.md, more in references                |
| Reference skill                                  | <500 words; reference docs in `references/` can be larger |

### Voice

Third person only. "The agent", "the orchestrator", "the user", "the workflow". Never "I", "my", "you", "we".

### Cross-references

- `devloop:<skill-name>` for sibling skills.
- `references/<file>.md` for in-skill detail.
- Never `@` paths — those force-load and burn context.

## Directory layout

```
skill-name/
├── SKILL.md          # Required. The index.
├── contract.json     # Required. Skill metadata.
├── CHANGELOG.md      # Required. Per-skill version history.
├── references/       # Optional. Detail offloaded from SKILL.md.
│   └── *.md
├── evals/            # Required. Test cases.
│   └── evals.json
├── scripts/          # Optional. Helper scripts.
└── assets/           # Optional. Diagrams, fixtures.
```

### `contract.json` minimum schema

```json
{
  "skill_name": "<name>",
  "skill_type": "single" | "mode",
  "version": "0.1.0",
  "manifest_required": false,
  "modes": [{ "id": "...", "purpose": "...", "reference": "references/mode-X.md" }],
  "events_emitted": ["..."],
  "human_approval_required_for": ["..."],
  "boundaries": { "produces": "...", "does_not_produce": "..." }
}
```

### `CHANGELOG.md`

Per-skill version history. Standard sections: Added / Changed / Deprecated / Removed / Fixed. Keep it terse.

## Multi-mode skills

When two skills would cover the same concern, consolidate into a single skill with modes. Parallel skills are forbidden — they duplicate maintenance.

Body structure for multi-mode:

1. Pick-a-mode table (id / shape / when).
2. Universal principles shared across modes.
3. References list with one `mode-<id>.md` per mode.

Modes inherit the same standard: same anti-patterns, same termination discipline.

## What the validator enforces

Run `scripts/validate-skills.py`. Severity levels:

| Severity | Examples                                                                                                                | CI behavior               |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| HIGH     | Frontmatter > 1024 chars, description does not start "Use when", first/second person in description, missing evals.json | Exit 1 in `--strict` mode |
| MEDIUM   | Workflow-summary anti-pattern, body > 500 words, missing standard section                                               | Reported, no exit         |
| LOW      | Origin attribution leakage, `@` path references                                                                         | Reported, no exit         |

## When to deviate from the standard

Don't. If a new shape is genuinely needed, propose updating the standard first (this document) and bump `skill-creator`'s version. The standard is the contract; one-off deviations rot.
