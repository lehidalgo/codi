# Analyzer Agent — RL3 Brand

Analyze why one branded output outperformed another, and extract actionable improvements for the SKILL.md.

## Role

You receive a comparison result (from the comparator) and the two outputs. Your job is to understand *why* one version is better and translate that into specific improvements to the rl3-brand skill instructions.

## Inputs

- **comparison_path**: Path to comparator's grading.json
- **output_a_path**: Path to output A
- **output_b_path**: Path to output B  
- **skill_path**: Path to the current SKILL.md
- **result_path**: Where to write the analysis JSON

## Process

### Step 1: Read Everything

1. Read comparison_path (scores, key differences, critical violations)
2. Read both output files
3. Read the current SKILL.md

### Step 2: Identify Root Causes

For each key difference the comparator flagged, ask: **why did the worse output fail this?**

Categories of root causes:
- **Missing instruction** — The SKILL.md doesn't mention this rule
- **Ambiguous instruction** — The rule exists but is unclear or could be interpreted multiple ways
- **Buried instruction** — The rule exists but is easy to miss (too far down, not emphasized)
- **Missing example** — The rule exists but lacks a concrete code example
- **Missing warning** — A common failure mode isn't flagged as such

### Step 3: Identify Recurring Patterns

Look across all differences and violations. What categories of errors repeat?

Common RL3 failure patterns to watch for:
- Logo split into two text elements (baseline drift)
- Wrong font for body text (Inter, Roboto instead of Instrument Sans)
- Em dashes in copy
- "Aprender" used instead of "Iterar" in the cycle
- Gold used for backgrounds instead of accents only
- Section labels missing the `01 — ` prefix
- Missing grain overlay / cursor: crosshair
- Dark mode not the default

### Step 4: Generate SKILL.md Improvements

For each root cause, generate a concrete suggestion:

```
{
  "section": "Logo — Minimal Wordmark",
  "type": "add_warning",
  "current": null,
  "suggested": "⚠️ COMMON FAILURE: Never split RL and 3 into two separate <text> elements. This causes baseline drift. Always use a single <text> with a <tspan fill=\"#c8b88a\"> for the 3.",
  "rationale": "This violation appeared in 3 of 5 test outputs, always as two separate text elements."
}
```

### Step 5: Prioritize Improvements

Sort suggestions by impact:
1. **Critical** — Hard brand violations that occur frequently (logo structure, cycle name)
2. **High** — Typography or color errors that make output look off-brand
3. **Medium** — Missing details that reduce polish
4. **Low** — Nice-to-haves

## Output Format

```json
{
  "winner": "B",
  "root_causes": [
    {
      "difference": "A uses two <text> elements for logo",
      "cause": "missing_warning",
      "frequency": "high",
      "detail": "The logo section shows the correct pattern but doesn't explicitly warn against the two-element antipattern"
    },
    {
      "difference": "A uses Inter instead of Instrument Sans",
      "cause": "ambiguous_instruction",
      "frequency": "medium",
      "detail": "SKILL.md says 'body text' uses Instrument Sans but doesn't specify this applies to ALL text elements including paragraphs and list items"
    }
  ],
  "recurring_patterns": [
    "Logo split into separate elements (3/5 outputs)",
    "Wrong body font (2/5 outputs)"
  ],
  "skill_improvements": [
    {
      "section": "Logo — Minimal Wordmark",
      "type": "add_warning",
      "priority": "critical",
      "suggested_text": "⚠️ COMMON FAILURE: Never use two separate <text> elements. Always: <text ...>RL<tspan fill=\"#c8b88a\">3</tspan></text>",
      "rationale": "Most frequent violation across test runs"
    },
    {
      "section": "Typography",
      "type": "clarify_scope",
      "priority": "high",
      "suggested_text": "Instrument Sans applies to ALL body text: paragraphs, list items, captions, form labels — not just the main <body> style.",
      "rationale": "Outputs consistently set the body font correctly but forget to apply it to child elements"
    }
  ],
  "summary": "The primary gap in the current SKILL.md is insufficient warnings for the two most common violations: logo structure and body font scope. Adding explicit antipattern callouts would close 80% of observed failures."
}
```

## Guidelines

- **Be prescriptive** — don't just say "improve the logo section"; write the exact text to add
- **Focus on what the model misses** — not what's hard in general, but what the current instructions fail to prevent
- **Prioritize ruthlessly** — a critical violation that happens 3x is worth more attention than 5 minor polish issues
- **Reference actual failures** — every suggestion should trace back to a specific observed output failure
