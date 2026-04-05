# Output Discipline Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `codi-output-discipline` builtin rule for token-efficient, anti-sycophantic output and enrich `codi-workflow` with hallucination guardrails.

**Architecture:** New rule template follows the same pattern as all existing rules (single `.ts` file exporting a template string). The rule is registered in the template index and added to 4 preset definitions. The workflow template gets a new section appended after "Self-Evaluation Before Action".

**Tech Stack:** TypeScript, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/templates/rules/output-discipline.ts` | Create | New rule template with 4 sections: Response Structure, Scope Discipline, Code-First Output, Formatting Safety |
| `src/templates/rules/index.ts` | Modify | Add `outputDiscipline` export |
| `src/templates/rules/workflow.ts` | Modify | Add "Accuracy Guardrails" section after "Self-Evaluation Before Action" |
| `src/templates/presets/development.ts` | Modify | Add `output-discipline` to rules array |
| `src/templates/presets/power-user.ts` | Modify | Add `output-discipline` to rules array |
| `src/templates/presets/strict.ts` | Modify | Add `output-discipline` to rules array |
| `src/templates/presets/fullstack.ts` | Modify | Add `output-discipline` to rules array |
| `tests/unit/scaffolder/rule-scaffolder.test.ts` | Modify | Add test for scaffolding the new template |

---

### Task 1: Create the output-discipline rule template

**Files:**
- Create: `src/templates/rules/output-discipline.ts`

- [ ] **Step 1: Create the rule template file**

```typescript
// src/templates/rules/output-discipline.ts
import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Token-efficient output — anti-sycophancy, concise responses, formatting safety, scope discipline
priority: high
alwaysApply: true
managed_by: ${PROJECT_NAME}
---

# Output Discipline

## Response Structure
- Lead with the answer, code, or finding — context and reasoning after, only if non-obvious
- No sycophantic openers ("Sure!", "Great question!", "Absolutely!")
- No closing fluff ("I hope this helps!", "Let me know if you need anything!")
- No restating or paraphrasing the question before answering
- One-pass answers — do not circle back to rephrase what was already said

## Scope Discipline
- Answer exactly what was asked — no unsolicited suggestions, improvements, or "you might also want..."
- No docstrings, comments, or type annotations on code that is not being changed
- No error handling for scenarios that cannot happen in the current context
- No boilerplate unless explicitly requested

## Code-First Output
- Return code first when the task is a code change — explanation after, only if the logic is non-obvious
- Bug reports: state the bug, show the fix, stop
- Code review: state the finding, show the correction, stop

## Formatting Safety
- Use plain hyphens (-) not em dashes
- Use straight quotes (" ') not smart/curly quotes
- No decorative Unicode symbols in technical output
- Natural language characters (accented letters, CJK, etc.) are allowed when the content requires them
- All output must be copy-paste safe into terminals, editors, and CI logs

BAD: "The function's parameter --- which isn't validated --- causes an issue"
GOOD: "The function parameter - which is not validated - causes an issue"`;
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm exec tsc --noEmit src/templates/rules/output-discipline.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/templates/rules/output-discipline.ts
git commit -m "feat(rules): add output-discipline rule template"
```

---

### Task 2: Register the template in the rules index

**Files:**
- Modify: `src/templates/rules/index.ts:27` (add new export after `improvement`)

- [ ] **Step 1: Add the export to index.ts**

Add this line at the end of the exports (before the closing newline):

```typescript
export { template as outputDiscipline } from "./output-discipline.js";
```

The full file should end with:

```typescript
export { template as agentUsage } from "./agent-usage.js";
export { template as improvement } from "./improvement.js";
export { template as outputDiscipline } from "./output-discipline.js";
```

- [ ] **Step 2: Verify the template is loadable**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/templates/rules/index.ts
git commit -m "feat(rules): register output-discipline in template index"
```

---

### Task 3: Add hallucination guardrails to workflow template

**Files:**
- Modify: `src/templates/rules/workflow.ts:31` (insert new section after "Self-Evaluation Before Action" block, before "MCP Usage Strategy")

- [ ] **Step 1: Insert the Accuracy Guardrails section**

In `src/templates/rules/workflow.ts`, find this text:

```
Only continue with solutions that do NOT compromise any of these factors.

## MCP Usage Strategy
```

Replace with:

```
Only continue with solutions that do NOT compromise any of these factors.

## Accuracy Guardrails
- Never invent file paths, function names, API endpoints, or field names — verify they exist before referencing them
- When information is unavailable or uncertain, say so explicitly — never fabricate data, statistics, or citations
- Distinguish between what the code or data shows and what is inferred — label inferences explicitly
- If a claim cannot be grounded in provided context or code, do not make it
- Prefer "I don't know" or "I need to check" over a confident wrong answer

BAD: "The function \\\`processPayment()\\\` in \\\`src/billing/handler.ts\\\` handles this" (never verified)
GOOD: "Let me check where payment processing is handled" (then reads the code)

## MCP Usage Strategy
```

- [ ] **Step 2: Verify the template compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/templates/rules/workflow.ts
git commit -m "feat(rules): add accuracy guardrails to workflow rule"
```

---

### Task 4: Add output-discipline to preset definitions

**Files:**
- Modify: `src/templates/presets/development.ts:52` (add to rules array)
- Modify: `src/templates/presets/power-user.ts:40` (add to rules array)
- Modify: `src/templates/presets/strict.ts:41` (add to rules array)
- Modify: `src/templates/presets/fullstack.ts:43` (add to rules array)

- [ ] **Step 1: Add to development preset**

In `src/templates/presets/development.ts`, find:

```typescript
    prefixedName("api-design"),
    devArtifactName("improvement"),
  ],
```

Replace with:

```typescript
    prefixedName("api-design"),
    prefixedName("output-discipline"),
    devArtifactName("improvement"),
  ],
```

- [ ] **Step 2: Add to power-user preset**

In `src/templates/presets/power-user.ts`, find:

```typescript
    prefixedName("testing"),
    devArtifactName("improvement"),
  ],
```

Replace with:

```typescript
    prefixedName("testing"),
    prefixedName("output-discipline"),
    devArtifactName("improvement"),
  ],
```

- [ ] **Step 3: Add to strict preset**

In `src/templates/presets/strict.ts`, find:

```typescript
    prefixedName("documentation"),
    devArtifactName("improvement"),
  ],
```

Replace with:

```typescript
    prefixedName("documentation"),
    prefixedName("output-discipline"),
    devArtifactName("improvement"),
  ],
```

- [ ] **Step 4: Add to fullstack preset**

In `src/templates/presets/fullstack.ts`, find:

```typescript
    prefixedName("git-workflow"),
    devArtifactName("improvement"),
  ],
```

Replace with:

```typescript
    prefixedName("git-workflow"),
    prefixedName("output-discipline"),
    devArtifactName("improvement"),
  ],
```

- [ ] **Step 5: Verify all presets compile**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/templates/presets/development.ts src/templates/presets/power-user.ts src/templates/presets/strict.ts src/templates/presets/fullstack.ts
git commit -m "feat(presets): add output-discipline rule to dev, power-user, strict, fullstack"
```

---

### Task 5: Add scaffolding test for the new template

**Files:**
- Modify: `tests/unit/scaffolder/rule-scaffolder.test.ts` (add test case)

- [ ] **Step 1: Add test for scaffolding from the output-discipline template**

Add this test after the existing "replaces {{name}} placeholder in template content" test (after line 62):

```typescript
  it("creates a rule from the output-discipline template", async () => {
    const result = await createRule({
      name: "my-output-discipline",
      configDir,
      template: prefixedName("output-discipline"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, "utf-8");
    expect(content).toContain("my-output-discipline");
    expect(content).toContain("# Output Discipline");
    expect(content).toContain("## Response Structure");
    expect(content).toContain("## Formatting Safety");
    expect(content).not.toContain("{{name}}");
  });
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/scaffolder/rule-scaffolder.test.ts`
Expected: All tests PASS (including the new one)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/scaffolder/rule-scaffolder.test.ts
git commit -m "test(rules): add scaffolding test for output-discipline template"
```

---

### Task 6: Build and run full test suite

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (note: 3 pre-existing failures in `rule-scaffolder-guard.test.ts` are unrelated)

- [ ] **Step 3: Verify template hash registry is up to date**

If the project has a template hash registry that needs regeneration after adding a new template, run the appropriate command. Check if `src/core/version/template-hash-registry.ts` references rule templates and needs updating.

---

## Verification Checklist

After all tasks are complete:

1. `pnpm build` succeeds
2. `pnpm test` passes (excluding pre-existing failures)
3. `pnpm dev init` on a test project shows `output-discipline` in rule selection for development, power-user, strict, and fullstack presets
4. `pnpm dev generate` scaffolds `.codi/rules/codi-output-discipline.md` with all 4 sections
5. `.codi/rules/codi-workflow.md` contains the new "Accuracy Guardrails" section
