# Skill anti-patterns (full catalog)

Each anti-pattern is enforced by `scripts/validate-skills.py` at the listed severity.

## HIGH severity

### A1. Description does not start with `Use when …`

**Why bad:** Anthropic discovery research shows Claude uses the first phrase of the description to gate skill loading. Verb-form openings ("Dispatch subagents…", "Find deepening…") read as commands rather than situational triggers, reducing match accuracy.

**Bad:**

```yaml
description: Dispatch subagents with isolated context — two modes...
```

**Good:**

```yaml
description: Use when ≥2 problems are independent and parallelism saves wall-clock time, or when executing a structured plan with discrete tasks...
```

### A2. First or second person in description

**Why bad:** The description is injected into the system prompt. First/second person ("I", "my", "you", "we") creates voice mismatch and breaks discovery.

**Bad:**

- `description: I help review your code...`
- `description: You can use this when starting a feature...`
- `description: Tell the agent to step back...` (imperative reads as second person)

**Good:**

- `description: Use when the user wants to...`
- `description: Use when code needs review...`

### A3. Description > 1024 chars

**Why bad:** Hard limit imposed by Claude Code's plugin parser. Skills exceeding this fail to load.

**Fix:** Move detail from `description` to the body or to `references/`. Keep description focused on triggers.

### A3b. Non-standard frontmatter fields (HIGH for `when_to_use`, MEDIUM for others)

**Why bad:** Devloop converges on codi's pattern: `name`, `description`, `user-invocable`. Unknown fields drift the catalog away from codi/Anthropic standards and confuse downstream tooling. The most common offender is `when_to_use` — invented as a "second description" but redundant since `description` already covers triggers and call sites.

**Bad:**

```yaml
description: Use when starting a feature with no plan...
when_to_use: Phase intent of feature workflows. Standalone via /devloop:discover.
```

**Good:**

```yaml
description: Use when starting a feature with no plan... Phase intent of feature workflows. Standalone via /devloop:discover.
```

**Fix:** Fold `when_to_use` content into `description` (the migration script does this). Remove `context`, `category`, `version`, `tags`, etc. — those belong in `contract.json`.

### A3c. `allowed-tools` in SKILL.md (HIGH — devloop forbidden)

**Why bad:** Codi's `.claude/skills` (15 sampled) never use `allowed-tools` in SKILL.md. Tool restrictions belong in `plugin.json` (plugin-level) or `contract.json` (skill metadata). Putting them in SKILL.md duplicates the restriction and creates drift between the two locations.

**Bad:**

```yaml
---
name: my-skill
description: Use when ...
allowed-tools:
  - Read
  - Edit
  - Bash(git log:*)
---
```

**Good:**

```yaml
---
name: my-skill
description: Use when ...
---
```

Tool restrictions, if needed, declare in `contract.json`:

```json
{
  "skill_name": "my-skill",
  "allowed_tools": ["Read", "Edit", "Bash(git log:*)"]
}
```

**Fix:** Run the migration script `/tmp/strip-allowed-tools.py` to strip the block. Validator flags this HIGH.

### A4. Missing `evals/evals.json`

**Why bad:** No way to verify the skill works. Silent failures in production.

**Fix:** Write at least one case before writing SKILL.md.

## MEDIUM severity

### A5. Description summarizes workflow / modes inline

**Why bad:** Causes Claude to follow the description as a shortcut and skip the body. Documented case from obra: a `code-review` description saying "code review between tasks" caused Claude to do ONE review when the body specified TWO. Removing the workflow summary made Claude correctly follow the body.

**Bad:**

```yaml
description: Two modes — request (dispatch subagent, parse feedback, act per severity) and receive (verify, push back, no sycophancy).
```

**Good:**

```yaml
description: Use when code needs review or when external review feedback has just arrived. Triggers on "review my code", "got code review feedback". Body documents the two modes and the severity ladder.
```

### A6. Body > 500 words

**Why bad:** SKILL.md is loaded fully into context once the skill is selected. Long bodies bloat context and bury the load-bearing rules. Anthropic's word-count target is <500 for non-frequently-loaded skills.

**Fix:** Move details to `references/<topic>.md`. Keep SKILL.md as the index.

### A7. Missing required body sections

**Why bad:** Discoverability and predictability suffer when the structure varies skill-to-skill. Required sections are documented in `references/standard.md`.

Required: When-to-use, Process / Core principle, Anti-patterns / Common mistakes, Termination / Output, Boundaries.

### A8. Parallel skills covering the same concern

**Why bad:** Duplicate maintenance, split discoverability, contradictory updates. If you find yourself writing skill B that does mostly what skill A does, consolidate.

**Fix:** Merge into a single skill with modes. See `multi-mode-skills.md`.

## LOW severity

### A9. Origin attribution in skill content

**Why bad:** Attribution belongs in commit messages and git history, not in user-facing skill content. Phrases like "ported from obra/X" or "from matt/Y" pollute the skill body, leak through to the agent's runtime context, and decay as upstream sources move.

**Fix:** Remove attribution from SKILL.md, references, CHANGELOG.md, and contract.json. Preserve in the original commit message.

### A10. `@` path references

**Why bad:** `@`-prefixed paths force-load the file immediately, burning 200k+ tokens before the skill is even invoked. Use plain markdown links or `references/` pointers instead.

**Bad:** `@graphviz-conventions.dot`, `@~/skills/testing/test-driven-development/SKILL.md`

**Good:** `references/graphviz.md`, `devloop:tdd`

### A11. Multi-language code examples

**Why bad:** One excellent example beats N mediocre ones. Multi-language examples trade depth for breadth and create maintenance burden.

**Fix:** Pick the most relevant language for the skill's domain. Devloop conventions:

- Tooling/scripts → bash + Python
- TS/JS skills → TypeScript
- Python skills → Python
- Mixed plugin code → TypeScript (devloop's primary language)

### A12. Code in flowcharts

**Why bad:** Can't copy-paste, hard to read, doesn't render well across renderers.

**Fix:** Flowcharts for non-obvious decision trees only. Code goes in fenced blocks.

### A13. Generic labels in flowcharts

**Why bad:** `step1`, `helper2`, `pattern3` carry no semantic meaning. Reader has to map labels to behavior every time.

**Fix:** Use behavior-naming labels: `read-context`, `dispatch-reviewer`, `verify-baseline`.

## Enforcement

The validator script runs all of these checks. To run:

```bash
python3 skills/skill-creator/scripts/validate-skills.py
python3 skills/skill-creator/scripts/validate-skills.py --skill <name>
python3 skills/skill-creator/scripts/validate-skills.py --strict   # exit 1 on HIGH violations
```

CI must run with `--strict` on every PR that touches `skills/`.
