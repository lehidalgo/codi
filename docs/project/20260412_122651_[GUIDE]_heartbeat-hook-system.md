# Heartbeat Hook System — Contributor Guide

- **Date**: 2026-04-12 12:26
- **Document**: 20260412_122651_[GUIDE]_heartbeat-hook-system.md
- **Category**: GUIDE

---

## Overview

The heartbeat hook system is a three-layer feedback loop that collects self-improvement data automatically as Codi runs. It replaces the older discipline-based approach that required the agent to write JSON files directly — an approach that agents consistently skipped.

The system has three components:

1. **skill-tracker** — fires when a Codi skill loads (InstructionsLoaded hook)
2. **`[CODI-OBSERVATION: ...]` marker** — emitted inline in the agent's response text
3. **skill-observer** — fires when the agent finishes a turn (Stop hook), reads the transcript, and writes structured feedback

---

## Layer 1: skill-tracker (InstructionsLoaded hook)

**File**: `.codi/hooks/codi-skill-tracker.cjs`
**Trigger**: `InstructionsLoaded` event — fires when Claude Code loads any skill's `SKILL.md`
**Mode**: Async (non-blocking)

The tracker script:
1. Reads a JSON payload from stdin containing `file_path` and `session_id`
2. Checks whether `file_path` matches `.claude/skills/codi-*/SKILL.md`
3. If it matches, appends an entry to `.codi/.session/active-skills.json`

The session file records which Codi skills were active in the current session. The observer reads this file to decide whether to run.

### Session file format

```json
{
  "session_id": "abc-123",
  "skills": [
    { "name": "codi-commit", "loaded_at": "2026-04-12T10:00:00.000Z" },
    { "name": "codi-tdd",    "loaded_at": "2026-04-12T10:01:00.000Z" }
  ]
}
```

---

## Layer 2: CODI-OBSERVATION marker

The agent emits this marker anywhere in its response text when it notices a gap in a rule or skill:

```
[CODI-OBSERVATION: <artifact-name> | <category> | <observation text, max 200 chars>]
```

**Valid categories**: `trigger-miss`, `trigger-false`, `missing-step`, `outdated-rule`, `missing-example`, `user-correction`, `wrong-output`

The agent never writes files. The Stop hook collects the marker automatically.

---

## Layer 3: skill-observer (Stop hook)

**File**: `.codi/hooks/codi-skill-observer.cjs`
**Trigger**: `Stop` event — fires when Claude Code finishes generating a response
**Mode**: Synchronous (stdout is parsed as JSON by Claude Code for `additionalContext`)

The observer script:
1. Reads a JSON payload from stdin containing `transcript_path`
2. Checks if `.codi/.session/active-skills.json` exists — exits immediately if not (non-Codi session)
3. Verifies the session has at least one loaded Codi skill — exits if empty
4. Reads the transcript JSONL at `transcript_path`
5. Scans all `assistant` message text blocks for `[CODI-OBSERVATION: ...]` markers using `matchAll()`
6. Writes one JSON feedback file per marker to `.codi/feedback/`
7. Deletes the session file (cleanup)
8. If total feedback count is >= 5, outputs `additionalContext` JSON to prompt the user to run `/codi-refine-rules`

### Feedback file format

```json
{
  "id": "uuid-v4",
  "skillName": "codi-commit",
  "timestamp": "2026-04-12T10:05:00.000Z",
  "session_id": "abc-123",
  "category": "missing-step",
  "observation": "no check for empty staged files before committing",
  "severity": "low",
  "source": "hook-transcript-scan",
  "resolved": false
}
```

### Severity mapping

| Category | Severity |
|----------|----------|
| `user-correction` | high |
| `trigger-miss` | medium |
| `trigger-false` | medium |
| All other categories | low |

---

## Hook registration

### Claude Code

Hooks are written to `.claude/settings.json` during `codi generate`:

```json
{
  "hooks": {
    "InstructionsLoaded": [
      {
        "type": "command",
        "command": ".codi/hooks/codi-skill-tracker.cjs",
        "timeout": 5,
        "async": true
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": ".codi/hooks/codi-skill-observer.cjs",
        "timeout": 15
      }
    ]
  }
}
```

`settings.json` is always generated, even when no permission flags are set. Users who need personal hooks must use `.claude/settings.local.json`, which Claude Code auto-merges with `settings.json`.

### Codex

Codex has no `InstructionsLoaded` event. Only the Stop observer is wired. The configuration is written to `.codex/hooks.json` during `codi generate`:

```json
{
  "Stop": [
    {
      "type": "command",
      "command": ".codi/hooks/codi-skill-observer.cjs",
      "timeout": 15
    }
  ]
}
```

---

## Source files

| Component | Source file |
|-----------|-------------|
| Script builders | `src/core/hooks/heartbeat-hooks.ts` |
| Claude Code wiring | `src/adapters/claude-code.ts` — `buildSettingsJson()` |
| Codex wiring | `src/adapters/codex.ts` |
| Core platform constants | `src/templates/presets/core-platform.ts` |

All hook scripts are generated from TypeScript builder functions in `heartbeat-hooks.ts`. After modifying the builders, run `pnpm build && codi generate` in a test project to verify the output.

---

## File extension: .cjs not .mjs

The scripts use CommonJS (`require()`). They must use the `.cjs` extension so Node.js treats them as CommonJS regardless of the project's `package.json` `"type"` field. Using `.mjs` would force ESM mode and break `require()`.

---

## Running the feedback loop

1. Work on a project with Codi installed
2. Skills load → tracker records active-skills
3. Agent notices a rule gap → emits `[CODI-OBSERVATION: ...]` in its response
4. Agent finishes turn → observer reads transcript, writes feedback to `.codi/feedback/`
5. When 5+ observations accumulate, the observer emits an `additionalContext` hint
6. User runs `/codi-skill-feedback-reporter` to review the summary
7. User runs `/codi-refine-rules` to propose and apply improvements

---

## Testing

| Test file | Coverage |
|-----------|----------|
| `tests/unit/hooks/heartbeat-hooks.test.ts` | Builder function output, constants, determinism |
| `tests/unit/adapters/claude-code.test.ts` | Hook script files in generated output, settings.json hook wiring |
| `tests/unit/adapters/codex.test.ts` | Observer script file, `.codex/hooks.json` wiring |
| `tests/unit/presets/core-platform.test.ts` | CORE_PLATFORM_RULES, CORE_PLATFORM_SKILLS, preset inclusion |
| `tests/integration/heartbeat-pipeline.test.ts` | Full observer pipeline: no session, no markers, single marker, threshold hint, cleanup |
