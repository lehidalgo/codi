# Codex vs Claude Code Hook Probe - Empirical Results

- **Date**: 2026-04-21 12:22
- **Document**: 20260421_122241_[REPORT]_codex-vs-claude-hook-probe-results.md
- **Category**: REPORT

## Summary

Built a minimal probe harness at `~/codi-hook-probe/` that registers every
candidate hook event against both CLIs and logs every invocation to
`logs/probe.ndjson`. Ran the same driver prompt against Claude Code 2.1.116
and Codex 0.118.0 in non-interactive mode. Results below replace the
"unverified" rows in the earlier research doc with hard evidence.

## Headline findings

1. **Codex hooks are gated behind a feature flag.** `codex_hooks` is listed
   by `codex features list` as `under development, false`. Without
   `-c features.codex_hooks=true` (or the equivalent `config.toml` entry),
   `.codex/hooks.json` is a silent no-op. Codi's codex adapter today writes
   the hook file but does not set the flag, so the heartbeat observer
   never runs for users on stock configuration.

2. **Codex `apply patch` bypasses PreToolUse and PostToolUse.** File
   mutations (the Codex equivalent of Write and Edit) do not fire tool
   hooks. Only Bash (`exec`) triggers PreToolUse and PostToolUse. This is a
   major gap for any guardrail that wants to scrub or block edits before
   they land.

3. **Codex does not fire SessionEnd.** Claude fires it. Any cleanup logic
   that Codi wires to SessionEnd today will never run on Codex.

4. **Payload envelopes are near-identical** after the hook fires. Both
   agents emit `session_id`, `cwd`, `transcript_path`, `hook_event_name`,
   `tool_name`, `tool_input`, `tool_use_id`. Codex enriches with `turn_id`,
   `model`, and `permission_mode`.

5. **`tool_response` shape diverges.** Claude returns an object with
   `stdout`, `stderr`, `interrupted`, `isImage`. Codex returns a raw string.
   PostToolUse guardrails that parse tool output need adapter-specific
   handling.

6. **Env var `CLAUDE_PROJECT_DIR` has no Codex equivalent.** Codex sets
   `CODEX_MANAGED_BY_NPM` but nothing that names the project root. Hook
   scripts must read `cwd` from the stdin JSON or fall back to
   `git rev-parse --show-toplevel` (already the pattern in Codi's codex
   adapter).

## Probe setup

- Dir: `~/codi-hook-probe/`
- Probe script: `hook-probe.cjs` (Node.js, stdlib only, logs NDJSON,
  redacts env and payload keys matching secret patterns)
- Driver prompt: identical verbatim for both agents. Asks for one Bash
  echo, one Write, one Edit, one Read, one more Bash, then "DONE".
- Agent invocation:
  - Claude: `claude -p "<prompt>" --permission-mode bypassPermissions --max-turns 15`
  - Codex: `codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox -c features.codex_hooks=true "<prompt>" < /dev/null`

## Event coverage (actual)

| Event | Claude fired | Codex fired | Notes |
|---|---|---|---|
| SessionStart | yes (1) | yes (1) | Same payload shape + `source: "startup"` |
| UserPromptSubmit | yes (1) | yes (1) | Codex adds `turn_id`, `model` |
| PreToolUse (Bash) | yes (2) | yes (3) | Codex fired per `exec` call |
| PreToolUse (Write) | yes (1) | **no** | Codex apply_patch does not emit hooks |
| PreToolUse (Edit) | yes (1) | **no** | Same reason |
| PreToolUse (Read) | yes (1) | n/a | Codex Read tool did not fire PreToolUse in this run |
| PostToolUse (Bash) | yes (2) | yes (3) | |
| PostToolUse (Write) | yes (1) | **no** | |
| PostToolUse (Edit) | yes (1) | **no** | |
| PostToolUse (Read) | yes (1) | n/a | |
| Stop | yes (1) | yes (1) | Both include `stop_hook_active`, `last_assistant_message` |
| SessionEnd | yes (1) | **no** | Codex does not fire SessionEnd |
| Notification | not tested | not tested | Requires interactive; skipped |
| SubagentStop | not tested | not tested | No subagents in this run |
| PreCompact | not tested | not tested | No compaction triggered |

## Payload comparison

### SessionStart

Claude:
```json
{ "session_id": "...", "transcript_path": "...", "cwd": "...",
  "hook_event_name": "SessionStart", "source": "startup" }
```

Codex:
```json
{ "session_id": "...", "transcript_path": "...", "cwd": "...",
  "hook_event_name": "SessionStart", "model": "gpt-5.4",
  "permission_mode": "bypassPermissions", "source": "startup" }
```

Codex is a superset. No breaking differences.

### PreToolUse (Bash)

Claude:
```json
{ "session_id": "...", "transcript_path": "...", "cwd": "...",
  "permission_mode": "bypassPermissions", "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "echo hello-from-agent",
                  "description": "Print hello message" },
  "tool_use_id": "toolu_..." }
```

Codex:
```json
{ "session_id": "...", "turn_id": "...", "transcript_path": "...",
  "cwd": "...", "hook_event_name": "PreToolUse", "model": "gpt-5.4",
  "permission_mode": "bypassPermissions", "tool_name": "Bash",
  "tool_input": { "command": "echo hello-from-agent" },
  "tool_use_id": "call_..." }
```

Differences:
- Codex adds `turn_id`, `model`.
- Claude adds `description` inside `tool_input` (LLM-authored rationale).
- `tool_use_id` prefix differs (`toolu_` vs `call_`). Neither should be
  treated as opaque string parsers.

### PostToolUse - tool_response shape (breaking)

Claude:
```json
"tool_response": { "stdout": "hello-from-agent", "stderr": "",
                   "interrupted": false, "isImage": false,
                   "sandbox": false }
```

Codex:
```json
"tool_response": "hello-from-agent\n"
```

A guardrail that parses tool output must check `typeof tool_response` and
branch. Cleanest adapter: normalize to `{ stdout, stderr }` inside the Codi
hook runtime before dispatching to user-written guardrails.

### Stop

Both:
```json
{ "session_id": "...", "transcript_path": "...", "cwd": "...",
  "permission_mode": "...", "hook_event_name": "Stop",
  "stop_hook_active": false, "last_assistant_message": "DONE" }
```

Codex adds `turn_id` and `model`. Otherwise identical.

### SessionEnd (Claude only)

```json
{ "session_id": "...", "transcript_path": "...", "cwd": "...",
  "hook_event_name": "SessionEnd", "reason": "other" }
```

Codex does not fire this event in 0.118.0.

## Env vars observed

Claude:
- `CLAUDE_PROJECT_DIR` - absolute path to project root
- `CLAUDE_ENV_FILE` - path to a session-specific env file
- `CLAUDE_PLUGIN_DATA`, `CLAUDE_CODE_SSE_PORT`, `CLAUDE_CODE_EXECPATH`,
  `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`

Codex:
- `CODEX_MANAGED_BY_NPM` - install provenance flag
- `CODEX_COMPANION_SESSION_ID` - present in both runs, inherited from the
  outer Claude session (not a Codex-first-party variable)
- **No project-dir equivalent.** Use `cwd` from stdin JSON or
  `git rev-parse --show-toplevel`.

## Chronological ordering observed

### Claude

```
SessionStart -> UserPromptSubmit -> PreToolUse:Bash -> PostToolUse:Bash ->
PreToolUse:Write -> PostToolUse:Write -> PreToolUse:Edit ->
PostToolUse:Edit -> PreToolUse:Read -> PostToolUse:Read ->
PreToolUse:Bash -> PostToolUse:Bash -> Stop -> SessionEnd
```

Clean Pre/Post pairing around every tool call. Stop fires before SessionEnd.

### Codex

```
SessionStart -> UserPromptSubmit -> PreToolUse -> PostToolUse ->
PreToolUse -> PostToolUse -> PreToolUse -> PostToolUse -> Stop
```

Only three Pre/Post pairs despite five tool operations in the driver
(1 Bash, 1 Write, 1 Edit, 1 Read, 1 Bash). The missing pairs are Write,
Edit, and Read - all non-exec tool invocations. Confirms that Codex hooks
fire only for shell exec commands in 0.118.0.

## Codex feature flag detail

```
$ codex features list | grep hooks
codex_hooks                      under development  false
```

To enable for a single run:
```
codex exec -c features.codex_hooks=true ...
```

To persist:
```
codex features enable codex_hooks
```
(writes to `~/.codex/config.toml`)

Other feature flags that may affect hook behavior once stable:
- `exec_permission_approvals` (under development) - may affect
  PreToolUse gating semantics
- `guardian_approval` (experimental) - adjacent security model
- `request_permissions_tool` (under development) - could expose a new
  tool with its own hook surface

## What the probe did not cover

- **Interactive sessions.** Only non-interactive (`claude -p`,
  `codex exec`). Notification, some SessionEnd reasons, and compaction
  likely fire only in interactive mode.
- **Blocking semantics.** The probe always exited 0. We did not verify
  whether exit code 2 + stderr blocks tool execution on both agents, or
  whether Codex honors the JSON `decision` output protocol.
- **Matcher syntax.** The `matcher: "Write|Edit"` field was present in
  the Codex hooks.json but fired zero events - unclear whether matchers
  are ignored, syntax differs, or the underlying events never fire in
  0.118.0.
- **SessionEnd, Notification, SubagentStop, PreCompact on either agent.**
  None of these events fired during the probe because the driver scenario
  did not trigger them.

## Implications for Codi guardrails design

These findings constrain the A1 - A3 proposals in
`20260421_103122_[RESEARCH]_claude-plugins-marketplace-learnings.md`.

### Must-haves for the guardrails engine

1. **Feature-flag awareness.** Codi's codex adapter must set
   `features.codex_hooks=true` in generated `.codex/config.toml` (or warn
   the user explicitly) whenever it writes `.codex/hooks.json`. Otherwise
   hooks silently do nothing on Codex.

2. **Payload normalization layer.** Before dispatching a hook payload to
   user-written guardrails, Codi should normalize `tool_response` (string
   vs object), merge `turn_id` / `model` when missing, and expose a
   single shape that works across agents.

3. **Project-root resolver.** `CLAUDE_PROJECT_DIR` works for Claude.
   Codex has nothing. The shared hook scripts must read `cwd` from stdin
   or fall back to `git rev-parse`.

4. **apply_patch blindspot handling.** Codex hooks cannot intercept
   file mutations on 0.118.0. Codi's options for Codex file-mutation
   enforcement:
   - Use the Codex `prefix_rule` DSL at `~/.codex/rules/` where it fits
     (this enforces on shell commands, not apply_patch).
   - Rely on Codex sandbox modes (`read-only`, `workspace-write`) for
     macro-level filesystem control.
   - Emit a mirrored pre-commit hook / CI check so enforcement happens
     at git commit time even if the in-session edit was not hook-able.
   - Watch the Codex feature flags - `exec_permission_approvals` landing
     as stable may close this gap.

5. **SessionEnd logic must have a Stop-hook fallback on Codex.** Any
   session-finalization work (flushing feedback, writing reports) should
   trigger on `Stop` for Codex and either `Stop` or `SessionEnd` for
   Claude.

### Revised event support matrix for A1

| Event | Claude | Codex | Codi engine decision |
|---|---|---|---|
| SessionStart | yes | yes | Dispatch on both |
| UserPromptSubmit | yes | yes | Dispatch on both |
| PreToolUse | yes (all tools) | yes (Bash only) | Dispatch on both; document Codex blindspot |
| PostToolUse | yes (all tools) | yes (Bash only) | Same |
| Stop | yes | yes | Dispatch on both; primary cleanup trigger on Codex |
| SessionEnd | yes | no | Claude-only; do not promise this to users |
| Notification, SubagentStop, PreCompact | untested | untested | Claude-only for now, revisit with interactive probe |

### Revised dependencies

- Codi guardrails cannot claim "same behavior on both agents" without
  caveats for file mutations on Codex.
- The codex adapter should be updated to enable `features.codex_hooks` when
  it generates `.codex/hooks.json`, otherwise the heartbeat observer is
  already a silent no-op today.

## Next steps

1. Re-run probe with blocking mode (exit code 2 plus stderr on
   PreToolUse:Bash) on both agents to verify block semantics match the
   documented behavior.
2. Interactive follow-up (5 min each agent) to confirm Notification,
   PreCompact, SubagentStop coverage.
3. Open question: is `codex_hooks` expected to ship as stable in 0.121.x
   or later? Check the Codex repo changelog before designing A1 to avoid
   coupling to a deprecated event surface.
4. Fold these findings into the A1 PLAN doc and ship codex-adapter update
   (enable `features.codex_hooks`) as a standalone small fix now.

## Artifacts

- Probe harness: `~/codi-hook-probe/`
- Raw NDJSON log: `~/codi-hook-probe/logs/probe.ndjson` (23 records)
- Claude stderr and stdout: `~/codi-hook-probe/logs/claude-*.txt`
- Codex stderr and stdout: `~/codi-hook-probe/logs/codex-*.txt`
- Driver prompt: `~/codi-hook-probe/driver-prompts/driver.txt`

The probe dir is throwaway and not committed. Re-run anytime with
`bash ~/codi-hook-probe/run-probes.sh`.
