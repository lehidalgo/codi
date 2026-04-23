# Severity, Labels, and Decorators — Mapping

This reference defines how the `codi-pr-review` skill classifies findings. It combines three industry standards:

1. **OWASP Risk Rating** — severity scale (Critical / High / Medium / Low)
2. **Conventional Comments** ([conventionalcomments.org](https://conventionalcomments.org/)) — label + decorator format
3. **Google eng-practices** — reviewer principles for balancing code health vs. forward progress

## Severity (OWASP-aligned)

| Severity | Merge action | Examples |
|----------|--------------|----------|
| **CRITICAL** | Block merge | Security vulnerability exploitable in production, data loss, wrong business logic that corrupts state, missing authentication on protected endpoint, secrets in source |
| **HIGH** | Block merge | Broken error handling that silently loses work, race condition likely under normal load, missing test for a new user-facing behavior, API breaking change without version bump |
| **MEDIUM** | Fix before merge, document if deferring | N+1 query not yet problematic, missing index, over-700-line file, missing observability on a new code path, convention drift |
| **LOW** | Note in PR, fix if trivial | Naming clarity, formatting, minor duplication, dead code cleanup |

**Rules:**

- Severity is a property of impact × likelihood, not of how confident the reviewer is
- Security findings default one level up (`HIGH` by default, `CRITICAL` if exploitable)
- Style-only preferences are never HIGH or above — downgrade or drop
- A finding without a file:line citation cannot be CRITICAL or HIGH

## Labels (Conventional Comments)

Every finding carries a label that expresses **intent**:

| Label | Meaning | Typical severity |
|-------|---------|------------------|
| `issue` | A defect the reviewer wants fixed | CRITICAL / HIGH / MEDIUM |
| `suggestion` | A specific, actionable change | MEDIUM / LOW |
| `nitpick` | Minor style or preference | LOW |
| `question` | Asking for clarification, not asserting a defect | n/a |
| `thought` | Non-blocking observation or musing | LOW |
| `chore` | Task the author should do before merge (update changelog, add screenshot) | MEDIUM / LOW |
| `praise` | Explicit recognition of a good choice | n/a |

## Decorators

Stacked after the label to clarify merge impact:

| Decorator | Meaning |
|-----------|---------|
| `blocking` | Must fix before merge. Default for CRITICAL and HIGH `issue`s |
| `non-blocking` | Author should consider, but can merge without addressing |
| `if-minor` | Fix only if the change is small; otherwise defer |

## Full format (per finding)

```
**<label> (<decorator>)** [<SEVERITY>] — <short title>
- File: path/to/file.ext:NN-MM
- Issue: <one-sentence description of what is wrong>
- Why: <rationale — why it matters>
- CWE: CWE-### (for security findings only)
- Fix: <minimal code snippet or prose>
```

## Examples

### CRITICAL — exploitable security issue

```
**issue (blocking)** [CRITICAL] — Metrics endpoints are publicly unauthenticated
- File: backend/app/api/routes/metrics.py:46,80,91,99
- Issue: No `CurrentUser` dependency; `GET /api/metrics/top-contacts` returns raw phone numbers
- Why: Anyone on the internet can enumerate active patient phone numbers
- CWE: CWE-306 (Missing Authentication for Critical Function)
- Fix: Add `_user: CurrentUser` to every metrics handler; update tests to include auth
```

### HIGH — correctness without direct security impact

```
**issue (blocking)** [HIGH] — Timezone handling is inconsistent between availability check and booking
- File: backend/app/calendar/bot_functions.py:147-175
- Issue: `.replace(tzinfo=None)` strips TZ; availability compares Madrid-local-naive vs. UTC-naive
- Why: DST transitions cause bookings outside business hours to be accepted
- Fix: Store UTC-aware, compute slots in Europe/Madrid, convert at boundaries. Test DST boundaries
```

### MEDIUM — quality issue

```
**suggestion (non-blocking)** [MEDIUM] — N+1 query in patient-treatments endpoint
- File: backend/app/api/routes/treatments.py:226-243
- Issue: Loop calls `session.get(Treatment, id)` per row
- Why: 21 queries for 20 treatments; degrades under patient-history growth
- Fix: One `select(Treatment).where(col(Treatment.id).in_(ids))`, build dict, join in Python
```

### LOW — style

```
**nitpick (if-minor)** [LOW] — Bare except silently drops telemetry
- File: backend/app/api/routes/calendar.py:215-216
- Issue: `except Exception: pass`
- Fix: `except Exception: logger.warning("...", exc_info=True)`
```

### Question — not a finding

```
**question** — Is the 7-day JWT lifetime intentional given the new rate limiting?
- File: backend/app/core/config.py:45
- Context: Previous JWT was 1 day; bumping to 7 without MFA widens the window of a leaked token
```

### Praise — worth calling out

```
**praise** — Clean Alembic migration structure with reversible downgrades
- File: backend/alembic/versions/f6a7b8c9d0e1_*.py
- Note: The business_hours migration seeds defaults in a single transaction and is fully reversible
```

## When to compress

For very long reviews (20+ findings), collapse LOW items into a single "LOW nits" section with one line each. CRITICAL and HIGH always get full structure.

## Why this taxonomy

- **Severity** communicates *what happens if we merge* — the dimension the author and release manager need
- **Label** communicates *what the reviewer wants* — question vs. issue vs. nitpick dramatically changes expected response
- **Decorator** communicates *how to triage* — blocking vs. non-blocking is the single most useful signal to avoid author frustration

Keeping all three avoids the two failure modes observed in practice:

1. **All-Critical reviews** (severity inflation, author ignores the list)
2. **Unlabeled reviews** (author cannot tell opinion from defect, responds to nitpicks the same as security holes)

## References

- Conventional Comments: <https://conventionalcomments.org/>
- OWASP Risk Rating: <https://owasp.org/www-community/OWASP_Risk_Rating_Methodology>
- OWASP Secure Code Review Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html>
- Google eng-practices: <https://google.github.io/eng-practices/review/>
