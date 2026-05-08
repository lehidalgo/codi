# Changelog — code-review skill

## [0.1.0] — 2026-05-01

### Added

- Initial consolidated skill replacing the standalone `receive-review` (which only covered the receiving side).
- Two modes cover both sides of the review process:
  - `request` — dispatch a reviewer subagent with crisp context (no session history), parse structured JSON feedback, act per severity (Critical → Important → Minor).
  - `receive` — process review feedback without sycophancy. Forbidden phrases (no "you're absolutely right", no gratitude), source-specific handling (human partner trusted, external skeptical), YAGNI check, implementation order, pushback patterns.
- Universal rules unified across both modes: verify against codebase before acting, one item at a time, no performative agreement, push back with technical reasoning when wrong, context preservation (mode request never passes session history to subagent).
- Severity ladder shared (Critical / Important / Minor) — same definition both directions.
- Subagent prompt template (`references/reviewer-prompt.md`) — strict JSON output validated against `schemas/gate-result.schema.json`.
- Concrete feedback patterns (`references/feedback-patterns.md`) — bad-vs-good examples for the most common failure modes.

### Replaces

- `skills/receive-review/` (removed) — only covered one direction. The consolidated `code-review` skill covers both.

### Integration

- feature-workflow phase verify → `code-review` (mode `request`) opt-in when `.devloop/config.yaml` declares `auto_review: true`
- bug-fix-workflow phase verify → same
- refactor-workflow phase verify → same
- migration-workflow phase data-validation → same (especially valuable for migrations because review catches data shape regressions)
- Standalone via `/devloop:code-review` (mode `receive`) when user pastes external review feedback at any time

### Boundaries

- `code-review` does NOT replace `verify-evidence`. Verify-evidence checks behavior against the plan; code-review checks code quality against another reviewer's eyes. Both are useful before claiming done.
- Mode `request` works with `subagent-orchestration` (after-implementer review).
- Mode `receive` works with `gh pr` flow (in-thread replies via `gh api ...comments/replies`).
