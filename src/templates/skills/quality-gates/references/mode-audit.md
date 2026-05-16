# Mode: audit

Read-only scan. Detects what hooks are missing, weak, or out of date.

## Process

1. **Detect runner** per `runner-detection.md`. Report which runner (or "none").
2. **Read existing hook files** — `.husky/pre-commit`, `.husky/pre-push`, `.husky/commit-msg`, `.pre-commit-config.yaml`, `lefthook.yml`. Parse the commands.
3. **Detect stack** — TS, JS, Python, Go, Rust, Shell. Multiple stacks possible.
4. **Cross-check against the 5-category Hook Contract.** For each (language × category), record present / missing / weak.
5. **Check universal hooks** — gitleaks, file-size, conflict-markers, branch-name validator, commit-msg validator.
6. **Check CI integration** — does `.github/workflows/*.yml` mirror the local hooks?
7. **Check `git config codi.githubUser`** — if missing, GH user detection has not run yet.
8. **Group findings by severity** and print.

## Severity grouping

| Severity | Examples                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| HIGH     | No gitleaks, no commit-msg validator, allow-bypass via `--no-verify` documented in CLAUDE, branch-naming validator missing |
| MEDIUM   | No type-check at pre-push, no test at pre-push, no security scan in CI                                                     |
| LOW      | No file-size check, no conflict-marker check, prettier config missing                                                      |

## Read-only contract

Mode `audit` MUST NOT:

- Modify any file.
- Install any tool.
- Run `git config --set`.
- Trigger any other skill that writes.

## Output format

```
quality-gates audit — <timestamp>
Repository: <basename>
Detected stack: <e.g., TypeScript + Python>
Detected runner: <husky | pre-commit | lefthook | none>

HIGH (3):
  - No gitleaks pre-commit hook → secrets risk
  - No commit-msg validator → conventional commit policy unenforced
  - Branch-naming validator missing → users committing to feature/foo (no <gh-user>/ prefix)

MEDIUM (2):
  - Pre-push runs lint only, no type-check or tests
  - CI workflow does not run gitleaks

LOW (1):
  - No file-size check (>10 MB files could land)

Run: /codi:quality-gates  (mode setup) to fix HIGH and MEDIUM. LOW is optional.
```

## When the audit reveals nothing

If all hooks are present and the contract is satisfied, audit reports:

```
quality-gates audit — <timestamp>
✓ All gates configured per contract.
✓ Universal hooks present.
✓ CI mirrors local hooks.
No action needed.
```

This is the steady state for a mature repo.

## Anti-patterns

- Modifying files in audit mode. Read-only, no exceptions.
- Skipping CI workflow checks because "we'll get to it later". CI gaps are part of the audit.
- Reporting a flat list. Always group by severity.
