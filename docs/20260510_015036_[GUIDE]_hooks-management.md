# Managing Codi Hooks

- **Date**: 2026-05-10 01:50
- **Document**: 20260510*015036*[GUIDE]\_hooks-management.md
- **Category**: GUIDE

## Overview

Codi hooks live in two buckets:

| Bucket    | When they fire                                  | Examples                                                     |
| --------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `git`     | git events (pre-commit / pre-push / commit-msg) | `eslint`, `prettier`, `tsc`, `gitleaks`, `bandit`            |
| `runtime` | agent events (PreToolUse, Stop, …)              | `iron-laws-enforcer`, `security-reminder`, `capture-markers` |

Both are first-class artifacts — same lifecycle as rules / skills / agents.

## List installed hooks

```bash
codi hooks list                # both buckets
codi hooks list --git          # git-bucket only
codi hooks list --runtime      # runtime-bucket only
codi hooks list --enabled      # only currently enabled
```

Output legend: `* required`, `+ default-on`, `- default-off`, `✓ currently enabled`.

## Enable or disable a hook

```bash
codi hooks add runtime security-reminder
codi hooks remove runtime skill-tracker
codi hooks add git biome
```

`required: true` hooks (`iron-laws-enforcer`, `workflow-classifier`, `capture-markers`, `tsc`, `gitleaks`, `bandit`, etc.) cannot be removed.

## Reselect via wizard

```bash
codi init                # full wizard, includes hook selection at the end
codi update --hooks      # show next-step commands for hook management
```

After changes, run `codi generate` so the adapter outputs (`.claude/settings.json`, `.codex/hooks.json`, `.pre-commit-config.yaml`) reflect the new selection.

## The security-reminder hook

A new runtime hook that flags risky code patterns before the agent writes them. Pattern set: command injection (`exec`, `child_process.exec`), code injection (`eval`, `new Function`), unsafe HTML (`dangerouslySetInnerHTML`, `document.write`, `.innerHTML =`), unsafe deserialisation (`pickle.load`), shell calls in Python (`os.system`), and GitHub Actions workflow injection.

Default: enabled. Behaviour: when a pattern matches, the agent receives a clear reminder + a suggested-action and the tool call is blocked once. Subsequent attempts on the same `(session, file, rule)` triple proceed silently — the agent has been informed.

To opt out per-project:

```bash
codi hooks remove runtime security-reminder
codi generate
```

To opt out only specific rules, edit `.codi/preferences.json`:

```json
{
  "hooks": {
    "security-reminder": {
      "extraSkipExtensions": [".liquid"],
      "extraSkipPaths": ["scripts/legacy/"]
    }
  }
}
```

## phaseFilter and dispatchSkill (advanced)

Each hook can opt into workflow-phase awareness:

| Field                                 | Effect                                                         |
| ------------------------------------- | -------------------------------------------------------------- |
| `phaseFilter: ["execute"]`            | hook only fires when the active workflow is in `execute` phase |
| `dispatchSkill: "codi-quality-gates"` | hook delegates to the named skill as an agent-check            |

Both are optional. Hooks without these fields fire regardless of phase, including in no-workflow sessions. Use these when a hook should only enforce during a specific phase, or when the actual logic lives in a skill (gate-runner integration).

## Where state lives

| File                                        | Purpose                                                        |
| ------------------------------------------- | -------------------------------------------------------------- |
| `.codi/.state/state.json` → `selectedHooks` | Per-project hook selection                                     |
| `.codi/preferences.json` → `hooks`          | Per-hook preference overrides (extra skip lists, enabled flag) |
| `~/.codi/security/state-<sessionId>.json`   | Per-user-global dedupe state for the security-reminder hook    |

Cleanup of stale dedupe files (>30 days) runs lazily.
