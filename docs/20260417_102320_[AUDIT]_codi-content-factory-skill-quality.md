# Content Factory Skill — Quality & Design Audit
- **Date**: 2026-04-17 10:23 UTC
- **Document**: 20260417_102320_[AUDIT]_codi-content-factory-skill-quality.md
- **Category**: AUDIT
- **Scope**: `src/templates/skills/content-factory/` — SKILL.md template, references, scripts, generators, app-UI, server, tests, evals, vendor bundles, integration wiring.
- **Evidence**: `/tmp/codi-content-factory-map.md` (830-line forensic inventory).

---

## Executive Summary

`codi-content-factory` is the largest and most architecturally sophisticated skill in the repo. It ships a full stack: a Node HTTP/WebSocket server, a browser-side interactive app, 12 brandable HTML templates, 5 export formats (PNG/PDF/PPTX/DOCX/HTML/ZIP), 15 progressive-disclosure reference docs, a box-layout validator, element-level persistence, and 16 tests. The design is generally coherent — clean route→lib dependency graph, self-contained, no leaky inbound refs from other skills — and two prior audit remediation commits show active maintenance.

However, **it carries ~3 MB of committed bloat (3,047 files under `scripts/node_modules/`), 416 KB of orphan vendor code, a missing rule-numbering gap, an undocumented runtime API surface, and a handful of legacy naming artifacts**. Nothing is broken, but the skill is heavier and less self-consistent than it needs to be.

**Severity at a glance**

| # | Finding | Severity | Fix cost |
|---|---------|----------|----------|
| 1 | `scripts/node_modules/` (3,047 tracked files) committed despite `.gitignore:1` | CRITICAL | Low |
| 2 | `scripts/package-lock.json` (994 lines) committed despite `.gitignore:2` | HIGH | Low |
| 3 | `scripts/vendor/html-docx.js` (416 KB) is orphan — no consumer | HIGH | Low |
| 4 | Box-layout rules r5/r6 missing from sequence (r1–r4, r7–r10 present) | HIGH | Low (doc) / Medium (fix) |
| 5 | `evals/evals.json` (12 cases) has no runner — pure documentation today | HIGH | Medium |
| 6 | SKILL.md calls server "no dependencies" but `scripts/package.json` declares 3 | HIGH | Low |
| 7 | `campaign-pipeline.md` is a self-declared redirect "to be deleted" — still present | MEDIUM | Low |
| 8 | `BRAINSTORM_*` env var prefix is legacy naming (pre-rename) | MEDIUM | Low |
| 9 | `/__inspect/*` endpoints + inspector.js are undocumented runtime surface | MEDIUM | Medium |
| 10 | `skill.test.json` manifest under-describes the logic surface | MEDIUM | Low |
| 11 | `start-server.sh --name` flag kept for backward-compat but unused | MEDIUM | Low |
| 12 | Cross-runtime filename collisions (`validation-config.{cjs,js}`, `content-types.{cjs,js}`) | LOW | Medium |
| 13 | DOCX class-naming rules duplicated between `docx-export.md` and `template.ts` | LOW | Low |
| 14 | `overflow:hidden` discipline duplicated between `html-clipping.md` and `slide-deck-engine.md` | LOW | Low |
| 15 | `scripts/.gitignore` is effectively a no-op given what's tracked | LOW | Low |
| 16 | README (924 lines), `design-system.md` (613), `slide-deck-engine.md` (472) are large | LOW | Medium |

---

## 1. Scale at a glance

| Metric | Value |
|--------|------:|
| Total files (incl. `node_modules/`) | ~3,171 |
| Total files excl. `node_modules/` | **124** |
| Total bytes (full) | 3.3 MB |
| Total bytes excl. `node_modules/` + `vendor/` | **876 KB** |
| Total lines excl. `node_modules/` + `vendor/` | **25,098** |
| References | 15 markdown (+ 1 `.gitkeep`) |
| Scripts (lib + routes + box-layout + shell + vendor) | 45 (excl. node_modules) |
| Generators (app shell + templates + lib modules) | 34 |
| Tests | 11 unit + 5 integration |
| Evals | 12 cases |
| Template version | 65 (matches baseline) |
| SKILL.md size | 575 lines / ~29 KB |

The skill has 56 commits on the current branch history, including 2 explicit "audit remediation" commits (`bcc3157`, `a275ae6`). Recent work has been disciplined.

---

## 2. Findings

### CRITICAL — F1. `scripts/node_modules/` is committed (3,047 files)

**Evidence.**
- `scripts/.gitignore:1` declares `node_modules/` as ignored.
- `find .../scripts/node_modules -type f | wc -l` → **3,047 files tracked anyway**.
- `scripts/copy-skill-assets.mjs:48` filters `node_modules/` out of the build copy — so the tracked tree is NOT even needed at runtime; the consumer project will `npm install` from `scripts/package.json`.

**Why it matters.** This is ~80% of the skill's on-disk footprint. It:
- Bloats every clone, codi-install, codi-contribute, and git operation on the repo.
- Guarantees merge conflicts any time a transitive dep is bumped.
- Defeats the `.gitignore` intent — i.e., it's a bug, not a choice.
- Triples the ZIP export size when a user contributes the skill upstream.

**Fix.**
1. `git rm -r --cached src/templates/skills/content-factory/scripts/node_modules`
2. Verify `scripts/.gitignore:1` still lists `node_modules/` (it does).
3. Ensure consumers get deps via a `postinstall` hook on the scripts package OR via `start-server.sh` auto-running `npm install` once on first run (check if it already does — the shell script is 126 lines).

Risk: very low. The directory is explicitly filtered out of `dist/` so no consumer depends on the tracked copy.

---

### HIGH — F2. `scripts/package-lock.json` committed despite ignore

**Evidence.** `scripts/.gitignore:2` lists `package-lock.json` → tracked 994-line lockfile exists.

**Why it matters.** Either the `.gitignore` is wrong or the lockfile was committed by mistake. Two contradictory signals of intent for the same file.

**Fix.** Decide which way:
- **Track it** (recommended for reproducible installs) → remove line 2 from `scripts/.gitignore`.
- **Don't track it** → `git rm --cached` the lockfile.

Pick one and commit the decision. I'd keep the lockfile and fix the `.gitignore`.

---

### HIGH — F3. `scripts/vendor/html-docx.js` is 416 KB of dead weight

**Evidence.**
- File size: 416,073 B (`vendor/html-docx.js`).
- `grep -rn "html-docx" src/templates/skills/content-factory/` excluding the file itself → **zero hits**.
- DOCX export is done server-side via the `docx` npm package at `scripts/lib/exports.cjs:131`.

**Why it matters.** `vendor/` bundles are supposed to be the browser fallback path. If nothing loads it, it's shipped to every consumer for nothing. 416 KB × every install.

**Fix.** Delete the file. If a future browser-side DOCX path is planned, resurrect from git history when needed.

---

### HIGH — F4. Box-layout rules r5 and r6 are missing

**Evidence.** `scripts/lib/box-layout/rules/` contains `r1, r2, r3, r4, r7, r8, r9, r10` — **no r5, no r6**.

**Why it matters.** Non-sequential rule numbering is a red flag. Two possibilities, both bad:
- Rules were deleted without renumbering → the rest of the numbering is now lying about its history.
- Rules were planned but never implemented → dangling numbering inviting confusion.

Either way: developers reading `rule-engine.cjs` will wonder where r5/r6 went.

**Fix options.**
- **(a)** If r5/r6 were intentionally dropped: renumber r7→r5, r8→r6, r9→r7, r10→r8 so the sequence is contiguous. Update `rule-engine.cjs` imports.
- **(b)** If they were intended to exist: either restore them or add a brief comment at the top of `rules/` stating why the gap exists.

Recommendation: **(a)**. Gaps in sequences are a smell.

---

### HIGH — F5. `evals.json` has no runner

**Evidence.**
- `evals/evals.json` contains 12 cases (7 positive triggers + 3 negative + 2 guardrails).
- `grep -r "evals.json" src/ tests/ scripts/` → **zero consumers** in the repo.

**Why it matters.** The skill-creator conventions call for evals with a runner (per codi's own skill authoring guidance). Evals that nothing runs are aspirational documentation, not a quality gate.

**Fix.** One of:
- **(a)** Wire evals into the integration test suite — e.g., a new `tests/evals/trigger-eval.test.js` that asserts each case's trigger matches the skill description via the same routing heuristic Claude Code would use. Requires a routing-match helper, which doesn't exist yet.
- **(b)** Delete `evals.json` until a runner lands. Don't ship quality claims without quality checks.

Recommendation: **(a)** — the cases are well-constructed and would catch real regressions. But this is a new feature, not a fix.

---

### HIGH — F6. Doc-to-code inconsistency: "no dependencies" claim

**Evidence.**
- `template.ts:55`: "Node.js HTTP + WebSocket server (no dependencies)".
- `scripts/package.json:7-11`: declares `docx`, `html-to-docx` as dependencies + `playwright` as optional dependency.

**Why it matters.** The claim is stale — it was true before DOCX export and Playwright-based validation landed. Future agents reading the SKILL.md will get the wrong mental model.

**Fix.** Update `template.ts:55` to something accurate: "Node.js HTTP + WebSocket server (minimal deps: `docx` for DOCX export, `playwright` optional for box-layout validation via headless browser)". Bump version.

---

### MEDIUM — F7. `campaign-pipeline.md` is a living tombstone

**Evidence.**
- `references/campaign-pipeline.md:3-9`: self-describes as a redirect ("The anchor-first flow is the default methodology; there is no separate 'campaign pipeline' to opt in to.").
- Line 54: "This redirect will be deleted in a future release."
- Still cross-linked from 4 other reference files.
- NOT cited by `template.ts` (the only orphan among the 15 references from the SKILL.md body perspective — Section C.1 of the map).

**Why it matters.** It's 57 lines of documentation telling readers "this file shouldn't exist". Meanwhile, incoming links from 4 peers keep the zombie alive.

**Fix.** Two options:
- **(a)** Delete the file now. Update the 4 cross-links to point to the successor refs (`methodology.md`, `distillation-principles.md`). Low risk.
- **(b)** Wait for the future release mentioned. But that release is unspecified.

Recommendation: **(a)**.

---

### MEDIUM — F8. `BRAINSTORM_*` env vars are legacy naming

**Evidence.** `scripts/server.cjs` uses `BRAINSTORM_PORT`, `BRAINSTORM_HOST`, `BRAINSTORM_URL_HOST`, `BRAINSTORM_WORKSPACE`, `BRAINSTORM_OWNER_PID` (per evidence map D.2). These predate the rename to "content-factory".

**Why it matters.**
- Confuses users who try `CONTENT_FACTORY_PORT=9000 codi <...>` and get nothing.
- `CONTENT_FACTORY_ALLOW_EVAL` uses the NEW prefix — inconsistent within the same file.
- Makes documentation harder to keep coherent.

**Fix.** Rename to `CODI_CF_*` (or `CONTENT_FACTORY_*`) with a one-version backward-compat shim that reads `BRAINSTORM_*` and logs a deprecation warning. Delete the shim after the next minor version. Update `references/server-api.md` accordingly.

---

### MEDIUM — F9. `/__inspect/*` + inspector.js are undocumented runtime surface

**Evidence.**
- `scripts/client/inspector.js` — 612 lines injected into every content HTML via `lib/injector.cjs:6`.
- Adds `/__inspect/eval-pull`, `/__inspect/eval-push`, `/__inspect/inspector.js` endpoints (per `inspect-routes.cjs`).
- `/api/eval` executes arbitrary JS in the iframe unless `CONTENT_FACTORY_ALLOW_EVAL=0`.
- Only `/api/eval` is mentioned in `references/server-api.md:67` (1 line).
- Not mentioned in SKILL.md body at all.

**Why it matters.** This is a non-trivial runtime capability (persistent DOM eval, element pinning, deictic edits) that:
- Has real security implications — arbitrary JS execution, enabled by default.
- Is how the "live DOM editing" feature works (per commit `2323d28`).
- An agent using the skill has no discoverability for it other than reading the server source.

**Fix.**
- Add a subsection to `references/server-api.md` covering `/__inspect/*` + the `/api/eval` gate flag explicitly.
- Document the default-on behavior of `/api/eval` and justify it or change the default to opt-in.
- Mention in `template.ts:144-146` "Optional live preview" block that the feature requires the inspector injection and is what "live DOM editing" depends on.

---

### MEDIUM — F10. `skill.test.json` under-describes the logic surface

**Evidence.**
- `skill.test.json` declares `tiers.logic.lib = "generators/lib/"` only.
- Actual unit tests: **8 of 11** target `scripts/lib/*.cjs` (server-side), **3 of 11** target `generators/lib/*.js` (browser).

**Why it matters.** The manifest is a quality signal for test coverage tooling. It currently implies 0 server-side coverage when there's plenty. Anyone reading the manifest concludes "this skill only tests browser code".

**Fix.** Either:
- Update `skill.test.json` to declare both `scripts/lib/` and `generators/lib/` as logic tiers.
- If the manifest's schema only supports one path, split into `tiers.logic.server` and `tiers.logic.browser` (requires schema update).

---

### MEDIUM — F11. `start-server.sh --name` is dead CLI surface

**Evidence.** Per map section H.3: "`--name` (kept for backward-compat, unused per line 36)".

**Why it matters.** Dead flags mislead users — they'll pass `--name foo` expecting something to happen. Since nothing happens, they'll file bugs about why their named instance doesn't appear in logs.

**Fix.** Either remove the flag (breaking change for any script that still passes it) or wire it up to something meaningful (e.g., override the default workspace dir suffix). If keeping: add a line in `--help` that says "(deprecated, no-op)".

---

### LOW — F12. Cross-runtime filename collisions

**Evidence.**
- `scripts/lib/validation-config.cjs` (server, 266 LOC) vs `generators/lib/validation-config.js` (browser, 144 LOC).
- `scripts/lib/content-types.cjs` (70 LOC) vs `generators/lib/content-types.js` (21 LOC).

**Why it matters.** Grep noise. A developer searching for "where is `validation-config` defined" gets two results with the same name on the same topic but different runtimes. It's intentional but confusable.

**Fix.** Rename with a runtime suffix: `validation-config.server.cjs` and `validation-config.browser.js`. Or move browser-side to `generators/lib/browser/*.js` so the path itself disambiguates. Cost: update ~10 import sites.

This is LOW — it works. But it's a latent maintenance papercut.

---

### LOW — F13. DOCX class-naming rules duplicated

**Evidence.** `references/docx-export.md` §"Document page discipline" (lines 165-205) and `template.ts:400-413` both cover the same DOCX class-naming rules at different granularities.

**Why it matters.** When one gets updated, the other drifts silently. `template.ts` is always-loaded; `docx-export.md` is progressive-disclosure — the worst drift shape is when the disclosed file is wrong while the loaded one is right, because agents check the disclosed file for authority.

**Fix.** Keep the canonical rules in `docx-export.md`. Reduce `template.ts:400-413` to a one-line pointer: "See `[[/references/docx-export.md]]` for DOCX class-naming discipline."

---

### LOW — F14. `overflow:hidden` duplication

**Evidence.** Small factual overlap between `html-clipping.md` and `slide-deck-engine.md` on the `overflow: hidden` rule.

**Fix.** Same pattern as F13 — canonical in one reference (`html-clipping.md`), pointer in the other.

---

### LOW — F15. `.gitignore` is effectively a no-op

**Evidence.** `scripts/.gitignore` has 2 lines. Both (`node_modules/`, `package-lock.json`) are tracked anyway.

**Fix.** Fixed automatically when F1 + F2 are resolved.

---

### LOW — F16. Large documents

**Evidence.**
- `README.md` — 924 lines.
- `references/design-system.md` — 613 lines.
- `references/slide-deck-engine.md` — 472 lines.
- `template.ts` — 575 lines.

Anthropic's skill guidance (https://code.claude.com/docs/en/skills) says skill descriptions and always-loaded content should be concise. The `template.ts` body is the always-loaded content.

**Why it matters.**
- README 924 lines is long for a user-facing doc but acceptable — it's not loaded into context.
- `template.ts` at 575 lines is larger than ideal. The Skill itself is progressive-disclosure to references — the main body should shrink to what's needed for agent routing + the common path.
- `design-system.md` and `slide-deck-engine.md` are progressive-disclosure — fine, but if they contain 2+ distinct topics, splitting improves on-demand loading cost.

**Fix.**
- `template.ts`: a pass to move any rules-like content (persist-style details, validation subsections) into references and keep the template body focused on the workflow. Target ~400 lines.
- `design-system.md`: consider splitting into `design-system-rules.md` (the 13 numbered rules) + `design-system-origin.md`. Optional.
- No change needed for README.

---

## 3. What the skill gets right

Don't break what works. Worth preserving:

- **Self-containment.** No code outside the skill references its internals (`grep` confirmed zero hits in map G.6). Other skills reference it by name only, which is the correct boundary.
- **Route → lib graph is clean.** 8 routes, 19 libs, one canonical `server.cjs` dispatcher. No circular imports. Box-layout subtree is a clear tree rooted at `validator.cjs`.
- **All SKILL.md references exist on disk.** Nothing dangling in the progressive-disclosure markers.
- **All referenced scripts exist on disk.** 4/4 from SKILL.md, all present.
- **Unit + integration coverage is real.** 16 tests, 1:1 module-to-test mapping for most `lib/` modules.
- **Version matches baseline** (65/65) — the hash integrity check passes.
- **Cross-skill references use names, not paths.** 7 other skills reference `codi-content-factory` by name, none reach into its internals.
- **No secrets or credentials.** `grep -E "api_key|secret|password|token"` (excluding node_modules + vendor) → zero hits.
- **Loopback-only server by default.** `127.0.0.1` unless `BRAINSTORM_HOST` overrides. Sane security posture.
- **Recent "audit remediation" commits** (`bcc3157`, `a275ae6`) prove the skill is actively maintained, not abandoned.
- **Progressive disclosure convention is consistent.** `${CLAUDE_SKILL_DIR}[[/path]]` everywhere. No accidental deviations.

---

## 4. Suggested patch plan

Ordered by risk and independence:

| # | Step | Risk | Files touched |
|---|------|------|---------------|
| 1 | **F1** — `git rm -r --cached scripts/node_modules/` | Very low | 3,047 (all untracked) |
| 2 | **F2** — Decide + remove `package-lock.json` OR update `.gitignore` | Very low | 1 |
| 3 | **F3** — Delete `scripts/vendor/html-docx.js` | Very low | 1 |
| 4 | **F6** — Fix "no dependencies" claim in `template.ts:55`; bump version | Very low | 1 |
| 5 | **F7** — Delete `campaign-pipeline.md`; update 4 cross-links | Low | 5 |
| 6 | **F11** — Delete `--name` flag from `start-server.sh` | Low | 1 |
| 7 | **F4** — Renumber box-layout rules r7–r10 → r5–r8; update `rule-engine.cjs` | Medium | 5–9 |
| 8 | **F8** — `BRAINSTORM_*` → `CODI_CF_*` with backward-compat shim | Medium | 3–4 |
| 9 | **F9** — Document `/__inspect/*` + `/api/eval` gate in `server-api.md` | Low | 1 |
| 10 | **F10** — Fix `skill.test.json` logic tier to include `scripts/lib/` | Low | 1 |
| 11 | **F13, F14** — Remove in-template duplication; point to references | Low | 2–3 |
| 12 | **F12** — Rename cross-runtime duplicates with suffix (optional) | Medium | 10+ |
| 13 | **F16** — Shrink `template.ts` to ~400 lines (optional) | Medium | 1 |
| 14 | **F5** — Wire `evals.json` to a real runner (new feature, not a fix) | High | new files |

Steps 1–6 are "clean up obvious junk" and can all happen in one session at zero risk.
Steps 7–11 are "make the skill honest about what it is" — medium-effort but each independent.
Steps 12–14 are "nice to have, not urgent".

### Expected result after steps 1–6

- Skill on-disk footprint drops from ~3.3 MB to ~460 KB (excluding remaining vendor bundles).
- ZIP export size drops correspondingly.
- `.gitignore` intent matches reality.
- No orphan 416 KB vendor bundle.
- No self-describing-tombstone reference file.
- SKILL.md matches what the server actually ships.

---

## 5. References

Evidence:
- `/tmp/codi-content-factory-map.md` (830-line forensic inventory)

Anthropic skill authoring:
- https://code.claude.com/docs/en/skills

Codi artifacts touched in this skill:
- `src/templates/skills/content-factory/template.ts` (SKILL.md template, v65)
- `src/templates/skills/content-factory/references/*.md` (15 files)
- `src/templates/skills/content-factory/scripts/*.cjs` + `*.sh`
- `src/templates/skills/content-factory/scripts/lib/box-layout/rules/r{1..4,7..10}.cjs`
- `src/templates/skills/content-factory/generators/app.{html,css,js}` + `lib/`
- `src/templates/skills/content-factory/tests/{unit,integration}/*.test.js`
- `src/templates/skills/content-factory/evals/evals.json`
- `src/core/version/artifact-version-baseline.json:258-261`
- `src/templates/skills/index.ts:88-91`
- `src/core/scaffolder/skill-template-loader.ts:51, 102`
- `scripts/copy-skill-assets.mjs:19, 48`
