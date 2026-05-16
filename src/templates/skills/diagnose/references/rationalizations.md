# Rationalization counter table for diagnose

| Excuse                                         | Reality                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| "Issue is simple, don't need process"          | Simple issues have root causes too. Process is fast for simple bugs.    |
| "Emergency, no time for process"               | Systematic debugging is FASTER than guess-and-check thrashing.          |
| "Just try this first, then investigate"        | First fix sets the pattern. Do it right from the start.                 |
| "I'll write test after confirming fix works"   | Untested fixes don't stick. Test first proves it.                       |
| "Multiple fixes at once saves time"            | Cannot isolate what worked. Causes new bugs.                            |
| "Reference too long, I'll adapt the pattern"   | Partial understanding guarantees bugs. Read it completely.              |
| "I see the problem, let me fix it"             | Seeing symptoms ≠ understanding root cause.                             |
| "One more fix attempt" (after 2+ failures)     | 3+ failures = architectural problem. Question pattern, don't fix again. |
| "I don't fully understand but this might work" | Pretending to know wastes hours. Admit and research.                    |

## Real-world impact

From debugging sessions:

- Systematic approach: 15–30 minutes to fix.
- Random fixes approach: 2–3 hours of thrashing.
- First-time fix rate: 95% vs 40%.
- New bugs introduced: near zero vs common.

The discipline is faster.
