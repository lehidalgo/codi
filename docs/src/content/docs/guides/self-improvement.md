---
title: How Codi Improves Itself
description: Codi collects observations about its own rules and skills automatically. This guide explains how observations are collected, where they go, and how to act on them.
sidebar:
  order: 10
---

Codi watches itself work and collects observations about its own rules and skills. When it notices a gap, an outdated guideline, or a missing example, it records that observation. You can then review the observations and apply improvements.

---

## How observations are collected

Observations flow through three automatic steps:

1. **When a Codi skill loads** — Codi records which skills are active in the current session.

2. **When the agent notices a gap** — The agent emits a one-line marker in its response:

   ```
   [CODI-OBSERVATION: codi-testing | outdated-rule | rule says use Jest but project migrated to Vitest]
   ```

   You do not see this marker — it appears in the raw response text. The agent does not write any files.

3. **When the agent finishes a turn** — A hook script reads the transcript, extracts all markers, and writes structured JSON to `.codi/feedback/`. Each marker becomes one file.

No action is needed from you. The loop runs automatically every session.

---

## What triggers an observation

The agent emits an observation when it notices one of these patterns:

| Trigger | Category | Example |
|---------|----------|---------|
| A rule recommends something the project no longer does | `outdated-rule` | Rule says ESLint + Prettier but project uses Biome |
| A common pattern has no rule covering it | `missing-step` | Every service uses a Result type but no rule documents it |
| A rule has no example for a pattern you encounter | `missing-example` | Testing rule lacks an example for this project's DI container |
| You correct the agent's behavior | `user-correction` | You say "don't mock the database in these tests" |
| A skill should have activated but didn't | `trigger-miss` | Codi-commit didn't activate when you typed `/codi-commit` |

User corrections always have high severity and are always emitted.

---

## Reviewing accumulated observations

When 5 or more observations accumulate, Codi prompts you at the end of a turn:

> [Codi] 6 observations in .codi/feedback/ — run /codi-refine-rules to review

You can also check at any time by running `/codi-skill-feedback-reporter`. It shows:

```
## Feedback Summary — 6 observations across 3 artifacts

### codi-commit (2 observations)
1. [HIGH] trigger-miss — skill did not activate when user typed /codi-commit directly (2026-04-10)
2. [LOW] missing-step — no step to verify staged files are not empty before committing (2026-04-08)

### codi-testing (3 observations)
3. [MEDIUM] outdated-rule — rule says use Jest but project migrated to Vitest (2026-04-09)
...

---
Run /codi-refine-rules to review these one by one and propose changes.
```

---

## Applying improvements

Run `/codi-refine-rules` to review observations one at a time. For each one, Codi:

1. Shows the current rule or skill content
2. Proposes a specific change with evidence
3. Asks for your approval
4. If you approve, writes the change to `.codi/rules/` or `.codi/skills/`
5. Reminds you to run `codi generate` to apply the change

Changes you approve are saved with `managed_by: user`. They are yours and are not overwritten by preset updates.

---

## Sharing improvements upstream

After validating improvements in your project, run `/codi-compare-preset` to see which changes are unique to your project. You can then share them upstream via `codi contribute`.

---

## Settings

The feedback loop works without any configuration. The hook scripts are generated into `.codi/hooks/` and wired automatically into `.claude/settings.json` (for Claude Code) or `.codex/hooks.json` (for Codex) during `codi generate`.

If you need personal hooks that run alongside Codi's, add them to `.claude/settings.local.json`. Claude Code auto-merges that file with `settings.json`.

---

## Feedback file location

Observations are written to `.codi/feedback/` as individual JSON files. Each file records:

- **skillName** — the artifact the observation is about
- **category** — what kind of gap was noticed
- **observation** — the specific text (max 200 characters)
- **severity** — `high`, `medium`, or `low`
- **timestamp** — when the observation was recorded
- **resolved** — set to `true` by `/codi-refine-rules` after you review it

Files stay in `.codi/feedback/` until you run `/codi-refine-rules` and mark them resolved. They are not deleted automatically.
