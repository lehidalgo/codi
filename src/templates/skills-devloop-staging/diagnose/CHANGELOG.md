# Changelog — diagnose skill

## [0.1.0] — 2026-05-02

### Added

- 4-phase systematic debugging discipline: investigation → pattern recognition → hypothesis → fix-and-verification.
- Iron rule: read actual code, do NOT skim. Trace the failing path before proposing anything.
- Falsifiable hypothesis format: "If X is the cause, then changing Y will make the bug disappear."
- 3-strikes rule: after 3 failed hypotheses, stop and reconsider whether the architecture itself is the problem (escalate to architecture-review).
- Anti-anchoring discipline — generate 3-5 ranked hypotheses before testing any.

### Composition

- bug-fix-workflow phase reproduce → invokes diagnose for the systematic flow
- Standalone via `/devloop:diagnose` for any unexpected behavior, test failure, or regression
- Hands off to architecture-review when 3-strikes triggers structural concerns

### Boundaries

- Produces the diagnosis (root cause + falsifiable hypothesis). Does NOT produce the fix — that is the workflow's execute phase.
- Does NOT replace verify-evidence — diagnose finds the cause; verify-evidence confirms the fix.
