# PLAN — Skill dependency declaration system

- **Date:** 2026-05-17
- **Category:** PLAN
- **Branch base:** `feature/codi-v3-harness`
- **Authoritative decisions:** ADR-0011
- **Status:** Ready to execute (pending user go-ahead)

## Goal

Ship the formal Skill `depends_on` system end-to-end on the v3 codebase with **minimal code change** + **clean cutover (no backwards-compat)**. After this plan executes:

- Every Skill in source and user installs has a validated `depends_on` field.
- A pre-commit hook (`skill-dependency-check`) enforces bidirectional consistency in both source and user contexts.
- The `codi init` wizard cascade-deselects dependents when the user removes a required upstream.
- New skills created by `dev-skill-creator` scaffold the field automatically.

## Phase overview

| # | Phase | Files touched | LOC est. | Effort |
|---|---|---|---|---|
| A | Schema | `src/schemas/skill.ts` | ~50 | 30 min |
| B | Hook implementation | `src/core/hooks/hook-templates.ts` + new helper module | ~400 | 1 day |
| C | Wire hook in both contexts | `.husky/pre-commit` (CODI) + `src/core/hooks/hook-installer.ts` (user) | ~30 | 2-3h |
| D | Migration: populate source skills | 73 × `template.ts` files | ~150 net (mostly `depends_on: []`) + 5 real deps | 4-5h |
| E | Metaskill update | `src/templates/skills/dev-skill-creator/template.ts` | ~40 | 1h |
| F | Wizard cascade-deselect | `src/cli/init-wizard.ts` + helpers | ~150 | 0.5-1 day |
| G | Tests | `tests/unit/schemas/`, `tests/unit/hooks/`, `tests/integration/`, `tests/e2e/` | ~500 LOC across ~8 new test files | 1 day |
| H | Docs + CONTRIBUTING update | `CONTRIBUTING.md`, `CONTEXT.md` (already updated), README mention | ~80 LOC docs | 30 min |
| **TOTAL** | | | **~1400 LOC** | **~3-4 days focal** |

---

## Phase A — Schema (Zod)

**Files:**
- `src/schemas/skill.ts` (modify)

**Changes:**

```ts
// New types
export const SkillDependencyKindSchema = z.enum(["skill", "rule", "agent"]);
export const SkillDependencyRoleSchema = z.enum([
  "prerequisite",
  "required",
  "optional",
  "fallback",
  "orchestration",
]);

export const SkillDependencySchema = z.object({
  kind: SkillDependencyKindSchema,
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase kebab-case bare name"),
  role: SkillDependencyRoleSchema,
  when: z.string().optional(),
  hint: z.string().optional(),
});

// Extend existing SkillFrontmatterSchema
export const SkillFrontmatterSchema = z.object({
  // ... existing fields ...
  depends_on: z.array(SkillDependencySchema),        // REQUIRED, may be empty
  iterative: z.boolean().default(false),
});

export type SkillDependency = z.infer<typeof SkillDependencySchema>;
```

**Validation rules in Zod:**
- `depends_on` is required (no `.optional()`); empty array allowed.
- Each entry's `name` must match kebab-case regex.
- `kind` and `role` are enums (compile-time exhaustive).

**Acceptance:** `npm run lint` passes (tsc + eslint). Existing skill parser does not crash on skills without the field yet (Phase D populates them).

---

## Phase B — Hook implementation

**Files:**
- `src/core/hooks/hook-templates.ts` — add `SKILL_DEPENDENCY_CHECK_TEMPLATE` constant
- `src/core/hooks/skill-dependency-detector.ts` — NEW module (the algorithm itself, importable + testable)

**Algorithm (`skill-dependency-detector.ts`):**

```ts
interface DetectorContext {
  mode: "src" | "user";
  skillsRoot: string;          // src/templates/skills OR .codi/skills
  rulesRoot: string;           // src/templates/rules OR .codi/rules
  agentsRoot: string;          // src/templates/agents OR .codi/agents
  projectPrefix: string;       // "codi" by default, read dynamically
}

function detectContext(cwd: string): DetectorContext | null {
  // Detect by presence of src/templates/skills/ vs .codi/skills/
}

interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

function validateSkill(skillDir: string, ctx: DetectorContext, catalogue: Catalogue): ValidationResult {
  // 1. Parse frontmatter, extract depends_on + iterative + name
  // 2. Read body, strip fenced code blocks (`````...`````) and inline-backtick spans (`...`)
  // 3. Extract body refs: regex /\$\{PROJECT_NAME\}-([a-z0-9-]+)/g in src, /\bcodi-([a-z0-9-]+)/g in user
  // 4. Detect bundled subagents: list <skillDir>/agents/*.md (exempt set)
  // 5. Apply rules:
  //    - Body ref X NOT in (depends_on ∪ bundled-exempt ∪ self+iterative) → ERROR "undeclared dependency"
  //    - depends_on entry Y not appearing as body ref → ERROR "dead declaration"
  //    - depends_on entry whose (kind, name) doesn't resolve in catalogue → ERROR "target does not exist"
  //    - self-ref in body or depends_on without iterative:true → ERROR
  // 6. Build cycle graph: edges with role ∈ {required, prerequisite}, run Tarjan SCC
  //    - Any multi-node SCC → ERROR "cycle detected"
  // 7. Workflows: union depends_on with derive_from_chains(chains)
  //    - Apply same body-vs-effective-deps rule
}
```

**Hook template (`SKILL_DEPENDENCY_CHECK_TEMPLATE`):**

Mirrors `SKILL_RESOURCE_CHECK_TEMPLATE` structure. Generated at install time, written to user `.git/hooks/codi-skill-dependency-check.mjs`. Calls into the detector module via either:
- Compiled bundle (`node /path/to/codi/dist/core/hooks/skill-dependency-detector.js`)
- Or inline template literal (preferred — no path dependency, matches existing hook pattern)

**Output format (matches existing CODI hook conventions):**

```
[skill-dependency-check] ERRORS:

  skill: code-review
    ✗ body mentions ${PROJECT_NAME}-some-skill at line 42 but not in depends_on
    ✗ depends_on[2] declares { kind: skill, name: tdd } but body never references it
    ✗ depends_on[3] declares { kind: agent, name: nonexistent } — agent not found in catalogue

  skill: feature-workflow
    ✗ required-cycle detected: feature-workflow → tdd → feature-workflow
      (refactor one of the roles to fallback/optional to break the cycle)

To fix: edit the listed skills' frontmatter and body. See ADR-0011 for the rule.
```

**Acceptance:** unit tests cover all error classes + happy path; pass on isolated fixtures.

---

## Phase C — Wire hook into both contexts

**Files:**
- `.husky/pre-commit` (CODI repo's own husky) — append call to skill-dependency-check
- `src/core/hooks/hook-installer.ts` — register the new hook in the install plan so `codi generate` writes it to user `.git/hooks/`

**Changes:**

In `.husky/pre-commit`:
```sh
# After existing hooks, before lint:
node scripts/hooks/skill-dependency-check.mjs --mode=src || exit 1
```

In `hook-installer.ts`, alongside existing `skill-resource-check` registration:
```ts
{
  name: "skill-dependency-check",
  filename: "codi-skill-dependency-check.mjs",
  template: SKILL_DEPENDENCY_CHECK_TEMPLATE,
  scope: "always-on",
  blocking: true,
}
```

**Acceptance:** committing in CODI source with a broken dep fails pre-commit. Running `codi init` + `codi generate` in a sandbox installs the hook into `.git/hooks/`.

---

## Phase D — Migration of 73 source skills

**Strategy:** add `depends_on: []` to every skill's frontmatter, then add the 3 real deps + 2 backtick conversions identified in grilling Q9.

**Approach (mechanical):**

1. **Script**: `scripts/migrate-skills-depends-on.mjs` walks `src/templates/skills/*/template.ts`, parses each via the existing frontmatter parser, appends `depends_on: []` and `iterative: false` if missing.
2. **Manual edits** (3 deps + 2 backticks):

   **plan-execution/template.ts** — add to frontmatter `depends_on`:
   ```yaml
   - kind: agent
     name: code-reviewer
     role: required
     when: "SUBAGENT mode review (per-task quality gate)"
   ```

   **brainstorming/template.ts** — add to frontmatter `depends_on`:
   ```yaml
   - kind: rule
     name: workflow
     role: required
     when: "exploring project context per workflow rule"
   - kind: rule
     name: documentation
     role: required
     when: "naming output docs per documentation rule"
   ```

   **receiving-code-review/template.ts** — line 39, convert prose:
   ```diff
   - A subagent (e.g. ${PROJECT_NAME}-pr-reviewer or ${PROJECT_NAME}-code-reviewer) returned findings
   + A subagent (e.g. `pr-reviewer` or `code-reviewer`) returned findings
   ```

3. **Validation pass**: run the new hook in `--mode=src` against all 73 skills. Expect zero errors. Fix any false positives discovered.

**Acceptance:** all 73 skills pass `skill-dependency-check`. Git diff shows additions only (no semantic body changes except the 2 backtick lines in receiving-code-review).

---

## Phase E — Metaskill update (`dev-skill-creator`)

**Files:**
- `src/templates/skills/dev-skill-creator/template.ts` (modify)
- `src/templates/skills/dev-skill-creator/references/depends-on-guide.md` (NEW, ~50 LOC)

**Changes to template.ts:**

1. **Scaffold update:** when generating a new SKILL.md, include `depends_on: []` and `iterative: false` in the frontmatter template.
2. **Prompt update:** add a section to the skill's own body instructing the author to declare deps:

   > "After scaffolding the skill, identify which other skills/rules/agents this skill invokes during its execution. For each one, add an entry to `depends_on:`. See `[[/references/depends-on-guide.md]]` for the role taxonomy (prerequisite / required / optional / fallback / orchestration)."

3. **Body-ref check:** the metaskill's own body instructs the author to use `${PROJECT_NAME}-X` for dep mentions and backticks for "see also" mentions.

**Files in references/depends-on-guide.md:**
Short authoring guide that mirrors ADR-0011 §Q2 + Q4. Concrete examples.

**Acceptance:** running `codi-dev-skill-creator` in CODI source generates a scaffold that passes the new hook on first commit.

---

## Phase F — Wizard cascade-deselect

**Files:**
- `src/cli/init-wizard.ts` (modify the artifact-selection step)
- `src/cli/init-wizard-paths.ts` or new helper `src/cli/dep-graph.ts` (NEW, ~100 LOC)

**Algorithm:**

```ts
function buildDependencyGraph(catalogue: Catalogue): DepGraph {
  // For each skill in catalogue:
  //   for each entry in depends_on:
  //     graph.addEdge(skillName → entry.name, kind: entry.kind, role: entry.role)
  //   for workflows: also add chains as orchestration edges
  // Returns indexed-by-target reverse-lookup map.
}

function computeCascade(deselected: ArtifactRef, currentSelection: Set<ArtifactRef>, graph: DepGraph): CascadePlan {
  // BFS from deselected, following reverse edges:
  //   - role=required or workflow chain → also cascade-remove
  //   - role=optional/fallback → keep but mark as "loses capability"
  // Iterate until no new removals.
  // Returns { mustRemove: [...], willWeaken: [...] }
}

// In the wizard step:
async function onDeselect(item, state) {
  const cascade = computeCascade(item, state.selected, state.graph);
  if (cascade.mustRemove.length === 0 && cascade.willWeaken.length === 0) {
    // No dependents — apply deselect immediately
    state.selected.delete(item);
    return;
  }
  const confirmed = await ctx.prompt.confirm({
    message: renderCascadePrompt(item, cascade),
    initial: false,
  });
  if (confirmed) {
    state.selected.delete(item);
    cascade.mustRemove.forEach(r => state.selected.delete(r));
    // willWeaken stays in selection but UI marks them
  }
}
```

**UI rendering (Clack):**

```
You deselected: codi-tdd

This will cascade-remove 3 artifacts that REQUIRE tdd:
  • codi-feature-workflow (workflow)
  • codi-bug-fix-workflow (workflow)
  • codi-refactor-workflow (workflow)

And weaken 2 artifacts (lose optional/fallback to tdd):
  • codi-code-review (loses fallback)
  • codi-debugging (loses optional)

? Confirm cascade removal? [y/N]
```

**Acceptance:** `codi init --customize` opens the wizard; deselecting `tdd` shows the cascade prompt; confirming removes the 3 workflows; cancelling leaves tdd checked.

---

## Phase G — Tests

**New test files (~8):**

1. `tests/unit/schemas/skill-depends-on.test.ts` — schema validation (5-7 cases per error class)
2. `tests/unit/hooks/skill-dependency-detector.test.ts` — algorithm tests (body parsing, bidirectional rule, fenced-block exclusion, backtick exclusion, bundled exemption, cycle detection, workflow chains union)
3. `tests/unit/hooks/skill-dependency-context-detect.test.ts` — bi-level mode detection (src vs user)
4. `tests/integration/skill-dependency-hook-src.test.ts` — runs hook against CODI's own source after migration
5. `tests/integration/skill-dependency-hook-user.test.ts` — sandbox `.codi/` install, validates user-installed skills
6. `tests/unit/cli/wizard-cascade-deselect.test.ts` — wizard logic with mocked graph
7. `tests/e2e/dep-system-end-to-end.test.ts` — full flow: init wizard → cascade → generate → hook validates → commit
8. `tests/unit/scripts/migrate-skills-depends-on.test.ts` — migration script idempotency + correctness

**Acceptance:** all tests pass; `npm test` count grows by ~50-80; existing tests stay green.

---

## Phase H — Docs

**Files:**
- `CONTRIBUTING.md` — add section "Writing a skill with dependencies" referencing ADR-0011 + the metaskill guide
- `CONTEXT.md` — already updated during grilling
- `README.md` — brief mention in the Skills section (~3 lines)

---

## Rollout sequence

1. **PR 1: Schema + hook + migration** (Phases A + B + D)
   - Adds field, ships hook, migrates all skills in single commit
   - Pre-commit blocks the PR until 73 skills are clean
2. **PR 2: Hook wiring + metaskill update** (Phases C + E)
   - Installs hook in user generate flow, updates dev-skill-creator
3. **PR 3: Wizard cascade-deselect** (Phase F)
   - Builds dep graph at wizard time, implements cascade UX
4. **PR 4: Tests + docs** (Phases G + H)
   - Comprehensive tests + author documentation

Each PR is independently shippable. PR 1 is the load-bearing change.

## Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Migration breaks edge-case skills | Medium | Run hook in `--dry-run` mode first; fix outliers manually; only commit after zero errors |
| Hook false positives on existing valid skills | Medium | Phase D includes a validation pass; tune detector regex iteratively |
| Performance regression on `codi generate` (hook runs per-skill) | Low | Catalogue lookup cached per invocation; O(n) where n=staged skills |
| Wizard cascade UX confusing on large dep sets | Medium | Cap rendered list to 10 items per category with "+N more"; full list shown via `--verbose` |
| Cycle detection false-positives on legitimate fallback loops | Low | Algorithm explicitly excludes fallback/optional/orchestration edges (ADR-0011 §Q8) |
| Bundled-subagent rename breaks intra-bundle ref | Low | Hook detects by filesystem; rename triggers same-PR rename of body ref |

## Definition of done

- All 73 source skills declare `depends_on` (may be empty).
- `npm run lint` + `npm test` + `npm run build` green.
- `codi-dev-skill-creator` scaffold includes the field by default.
- `codi init --customize` cascade-deselects correctly.
- ADR-0011 status: Accepted.
- Hook installed in CODI's husky pre-commit AND in user `.git/hooks/` via `codi generate`.
- CONTRIBUTING.md updated.
