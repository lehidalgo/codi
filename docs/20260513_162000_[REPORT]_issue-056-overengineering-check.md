# ISSUE-056 Anti-Overengineering Check

- **Date**: 2026-05-13 16:20
- **Document**: 20260513*162000*[REPORT]\_issue-056-overengineering-check.md
- **Category**: REPORT

## Issue under review

ISSUE-056 — "Sin ownership/CODEOWNERS por artefacto ni RBAC [A3:H-22]"
classified `HIGH-TEAM` in `docs/20260511_220320_[ROADMAP]_codi-core-improvement-iterative-plan.md:174`.
Originally framed as: add a `maintainers:` frontmatter field to each artifact
plus a GitHub Action that cross-validates frontmatter against CODEOWNERS.

## Evidence: maintainer count (real, not aspirational)

`git log --format='%aE' | sort | uniq -c`:

```
 575 le.hidalgot@gmail.com        <- lehidalgo (primary)
 107 leandro.hidalgo@bbva.com     <- lehidalgo (work email, same human)
  21 dependabot[bot]
   4 r.novasvilla@gmail.com       <- single external contributor, 4 commits
   4 github-actions[bot]
```

- Effective human authors: **2** (and one of them has 4 commits, 0.6% of human commits).
- 6-month window: same distribution.
- `package.json` has no `author` / `contributors` field (verified lines 1-40).
- This is a **single-maintainer repo** with one occasional external contributor.

## Evidence: current consumers of artifact ownership

- `grep -rn "maintainers:"` across `src/`, templates, configs → **zero** call
  sites that read a `maintainers:` field. There is no existing consumer.
- `src/core/artifact-types.ts` → no `author` / `owner` / `maintainer` field
  in any artifact schema (`grep "author|owner" → empty`).
- `CODEOWNERS` already exists at repo root (62 bytes, 2 lines):
  ```
  # All files require approval from the repo owner
  * @lehidalgo
  ```
- `.github/PULL_REQUEST_TEMPLATE.md` exists but has no maintainer-approval
  section — it asks for risk level, test plan, CI gates. No per-artifact
  ownership prompt.
- Branch protection on `main` already exists (PR rule from CLAUDE.md +
  `back-merge.yml` workflow); CODEOWNERS rule applies via GitHub natively.

## Evidence: the forward-looking case

- ISSUE-091 (`pending`) — "Publish codi-cli/action GitHub Marketplace" lives
  in the same roadmap (line 214) classified `MED-ADOPT`, not HIGH. It is
  itself deferred.
- Until ISSUE-091 ships and external contributions arrive at scale (current
  rate: 4 commits in repo lifetime from outside `@lehidalgo`), per-artifact
  ownership has **no consumer**.
- A global `* @lehidalgo` in CODEOWNERS already gates every PR through the
  sole maintainer. There is no team subset to delegate to.
- Adding `maintainers:` frontmatter to ~120 templates (`src/templates/`)
  without a consumer ships dead metadata that must be maintained, validated,
  and migrated forever. This is the textbook YAGNI violation called out in
  `.claude/rules/codi-simplicity-first.md` ("Delete speculative code —
  version control remembers it").

## Options

| Option | Scope                                                                 | LOC                                                   | Value today                         | Value at 1y                         |
| ------ | --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| A      | CODEOWNERS already exists with `* @lehidalgo` — leave as-is           | 0                                                     | covers single-maintainer reality    | re-evaluate when ISSUE-091 lands    |
| B      | CODEOWNERS + `github/codeowners-validator` action (syntax-only)       | ~30                                                   | catches malformed CODEOWNERS in PRs | same — modest                       |
| C      | `maintainers:` frontmatter on every artifact + cross-validator Action | ~200 + 120-file template migration + schema migration | none (no consumer)                  | speculative until team mode is real |

## Verdict

**DEFER ISSUE-056** (effectively Option A — the CODEOWNERS file that
satisfies the minimum already exists; no new code).

Rationale:

1. **No consumer exists.** Zero source files read a `maintainers:` field.
   Adding the field is dead metadata.
2. **No team exists.** One human author at 99.4% of commits. CODEOWNERS
   `* @lehidalgo` already routes every PR to the sole approver via
   GitHub-native branch protection.
3. **The trigger is downstream.** Per-artifact ownership only becomes
   useful AFTER (a) ISSUE-091 publishes the GitHub Action and external
   contributions scale, AND (b) the team brain aggregation (ISSUE-055)
   establishes a multi-actor model. Both are pending and gate this work.
4. **The ask violates project rules already documented:**
   - `codi-simplicity-first.md` §YAGNI — "do not add configuration until
     a second use case exists"
   - User memory line: "no overengineering — minimal patches, no
     speculative abstractions, prefer delete over refactor"
   - User memory line: "industry-standard solutions — robust + long-term,
     no workarounds" — single `* @lehidalgo` IS the industry standard for
     a single-maintainer repo.
5. **Re-open trigger is concrete:** when ISSUE-091 ships or when a second
   active human maintainer joins (sustained >5% commit share over 3
   months), revisit and choose Option B at that point. Skip Option C
   unless a real per-artifact delegation use case emerges.

## Recommendation

**DEFER.** Mark ISSUE-056 with re-open condition: "external contribution
rate ≥10 PRs/month for 2 consecutive months, OR second maintainer with
sustained activity, OR ISSUE-091 ships." Until then, the existing
2-line CODEOWNERS at repo root is the correct shape.
