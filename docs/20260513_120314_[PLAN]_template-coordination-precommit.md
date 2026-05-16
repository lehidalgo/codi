# Pre-Commit Coordination Between Codi and rl3-templates

**Date**: 2026-05-13 12:03
**Document**: 20260513*120314*[PLAN]\_template-coordination-precommit.md
**Category**: PLAN
**Status**: draft — awaiting prioritisation
**Authors**: codi-brainstorming session (sapphira-clinic incident)

## 1. Summary

Codi's `.pre-commit-config.yaml` emitter duplicates hooks already installed by rl3-templates (the project Copier baseline) in every repo that uses both tools. The result is doubled execution time, version drift between two `gitleaks` entries, conflicting tool invocations (codi runs `ruff` from repo root, the template runs `cd backend && uv run ruff` — different configs), and broken commits when codi entries reference `.git/hooks/codi-*.mjs` scripts that no install step ever wrote.

This plan delivers two phases. **Phase A** (priority: high) teaches codi to detect rl3-templates-managed repos and default `selectedHooks.git = []` so the template owns the git bucket alone. **Phase B** (priority: medium) adds a generic semantic-dedupe layer in the yaml renderer so codi coexists with any external pre-commit emitter, not just rl3-templates.

The first concrete delivery (Phase A) is roughly 50 LoC plus tests; Phase B is roughly 200 LoC plus a role taxonomy and tests. Both keep codi's runtime bucket (`.claude/settings.json` and `.codex/hooks.json`) and its meta-hook scripts under `.git/hooks/codi-*.mjs` unchanged.

## 2. Goals

- Stop emitting duplicate pre-commit entries in repos already managed by rl3-templates.
- Make the dedupe behaviour generic so future external emitters (devloop, capellai-templates, custom Copier templates) do not require new special cases in codi.
- Keep the runtime bucket and codi-meta scripts untouched.
- Preserve codi's existing `selectedHooks.git` opt-in / opt-out path for repos that explicitly want both layers.
- Surface the detection result to the user with a clear one-line banner — no silent behaviour changes.

## 3. Non-Goals

- Refactoring the codi git-bucket registry contents (per-language hook lists stay as-is).
- Replacing the rl3-templates baseline. The template stays canonical for the consumers it targets.
- Cross-emitter `rev:` reconciliation (e.g. picking the newer of two gitleaks versions). When dedupe drops codi's copy, the template's `rev:` wins by virtue of remaining in the file.
- Codi-managed `.git/hooks/codi-*.mjs` install drift. That is a separate plan and the missing-script crash in sapphira-clinic is tracked separately.

## 4. Architecture

### 4.1 Phase A — rl3-templates detection

A single detection step runs once per `codi init` and once per `codi generate`:

1. Look for `.copier-answers.yml` at repo root.
2. Parse the `_src_path:` field (Copier writes this on every render).
3. If `_src_path` matches one of the known rl3-templates URIs (allowlist: `gh:rl3aiboutique-cpu/rl3-templates`, `https://github.com/rl3aiboutique-cpu/rl3-templates`, local clone path under `/Users/laht/projects/AIAgency/rl3-templates`), set `selectedHooks.git = []` as the **initial default** in `.codi/state.json`.
4. Print a single banner line on the next CLI surface action:

```
detected rl3-templates baseline; codi git-bucket hooks deferred to template.
override with: codi hooks add git <name>
```

Detection is one-shot. After the first write to `.codi/state.json`, the field is persistent — subsequent runs respect whatever the user has manually toggled with `codi hooks add/remove git <name>`. The detection only seeds the initial value; it never overrides explicit user choice.

### 4.2 Phase B — generic semantic-dedupe in yaml-renderer

When codi prepares to emit a new repo entry into `.pre-commit-config.yaml`, it computes the entry's **role** (e.g. `python-security`, `python-lint`, `python-format`, `python-typecheck`, `ts-format-lint`, `ts-typecheck`, `secrets-scan`, `commit-msg-convention`, `shell-lint`, `yaml-lint`, `actions-lint`, `spellcheck`). The role taxonomy is closed — every hook in the codi registry maps to exactly one role.

Before appending the entry, the renderer scans the **non-codi-marked** entries already in the document, classifies them with the same role taxonomy via two signals:

- **upstream entries**: `repo:` URL + hook `id:` map to a role via a lookup table (e.g. `astral-sh/ruff-pre-commit + id=ruff` → `python-lint`).
- **local entries**: the `entry:` string is matched against known-tool regexes (e.g. `\\bruff\\s+check\\b` → `python-lint`; `\\bbiome\\s+check\\b` → `ts-format-lint`).

If a role match is found, codi skips its own emission for that role and writes a one-line comment in the file recording the skip:

```yaml
# codi: skipped python-lint (covered by local 'ruff-check-fix' above)
```

The comment is informational — `pre-commit` ignores it. The skip is also recorded in `.codi/state.json` under `dedupedRolesByExternalHook` so subsequent `codi generate` runs are deterministic without re-scanning every time.

### 4.3 Where logic lives

| Path                                                   | Phase | Role                                                                                                                                       |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/hooks/detection/copier-answers.ts` (new)     | A     | Parse `.copier-answers.yml`; resolve `_src_path` against allowlist.                                                                        |
| `src/cli/init-wizard.ts` (edit)                        | A     | Call detection; seed `selectedHooks.git = []` when matched.                                                                                |
| `src/cli/generate.ts` (edit)                           | A     | Print the banner on the first generate after detection.                                                                                    |
| `src/core/hooks/dedupe/role-taxonomy.ts` (new)         | B     | Closed enum + mapping from registry entries to roles.                                                                                      |
| `src/core/hooks/dedupe/local-tool-regex.ts` (new)      | B     | Regex table for classifying `entry:` strings in local hooks.                                                                               |
| `src/core/hooks/renderers/yaml-renderer.ts` (edit)     | B     | Pre-emission scan + skip + comment emission.                                                                                               |
| `src/core/config/state.ts` (edit)                      | B     | Add `dedupedRolesByExternalHook` to state schema.                                                                                          |
| `tests/unit/hooks/detection/*.test.ts` (new)           | A     | Detection unit tests against fixture `.copier-answers.yml`.                                                                                |
| `tests/unit/hooks/dedupe/*.test.ts` (new)              | B     | Role classification tests for every entry in the registry.                                                                                 |
| `tests/integration/template-coexistence.test.ts` (new) | B     | End-to-end: render against a fixture template config, verify zero duplicates and zero codi-skipped roles that have no template equivalent. |

### 4.4 Phase mapping convergence

```mermaid
flowchart LR
    A[codi init / generate] --> B{Copier answers?}
    B -- "rl3-templates _src_path" --> C[seed selectedHooks.git = []]
    B -- other or none --> D[selectedHooks.git defaults from registry]
    C --> E[Phase B: dedupe scan]
    D --> E
    E --> F{Existing role covered?}
    F -- yes --> G[skip emission + comment]
    F -- no --> H[emit codi entry]
    G --> I[.pre-commit-config.yaml]
    H --> I
```

## 5. Risks

| Risk                                                                  | Mitigation                                                                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase A false negative (`_src_path` rewritten by hand)                | Allowlist matches by substring, not exact URL. Banner prints what was matched so the user can sanity-check.                                                   |
| Phase A false positive (user wants both layers)                       | `codi hooks add git <name>` re-adds individual hooks. The seed is one-shot — manual edits persist.                                                            |
| Phase B role classification miss                                      | Closed taxonomy + 100% registry coverage in unit tests. Unknown roles fall through to the current emit-always behaviour, never block.                         |
| Local-entry regex matches the wrong tool                              | Per-role regexes anchored on tool binary names (`ruff`, `bandit`, `biome`, etc.). False matches log a warning in `codi generate -v` and fall through to emit. |
| Template hook ships an older `rev:` than codi                         | Out of scope for this plan. Template owns its bumps; codi never overrides existing `rev:` on non-codi-marked entries.                                         |
| Codi-meta hooks (`.git/hooks/codi-*.mjs`) still missing after install | Tracked separately — those scripts need a guaranteed install step. This plan does not depend on it.                                                           |

## 6. Acceptance Criteria

### Phase A

- [ ] Running `codi init` in a fresh `copier copy gh:rl3aiboutique-cpu/rl3-templates` repo produces `.codi/state.json` with `selectedHooks.git = []`.
- [ ] Banner prints once on the next `codi init` or `codi generate` run after detection: `detected rl3-templates baseline; codi git-bucket hooks deferred to template.`
- [ ] `codi hooks add git biome` re-adds `biome` and removes the detection-seeded empty value from state.
- [ ] Subsequent `codi generate` runs do not re-add the seeded empty value once the user has touched it.
- [ ] Existing non-rl3 repos (no `.copier-answers.yml`) behave identically to today.

### Phase B

- [ ] Every entry in `src/core/hooks/registry/<lang>.ts` has a `role:` field of a closed enum type.
- [ ] Local-tool regex table covers every codi-emitted role (round-trip test: emit a codi config, parse it as if it were external, classify back to the same role).
- [ ] `renderPreCommitConfig` skips emitting a role when a non-codi-marked entry of the same role is present.
- [ ] Skip is recorded as `# codi: skipped <role> (covered by ...)` comment.
- [ ] Integration test: render against the rl3-templates baseline fixture, verify zero codi-marked duplicates and verify the user sees the expected list of skip comments.

## 7. Implementation Phases

### Phase A — rl3-templates detection (1 day)

1. Add `src/core/hooks/detection/copier-answers.ts` with `detectCopierTemplate(projectRoot)`.
2. Add allowlist constants (gh URI, https URI, local clone path).
3. Wire into `src/cli/init-wizard.ts` between the language detection step and the artifact-selection step.
4. Wire banner into `src/cli/generate.ts` (gated by a one-shot flag in `.codi/state.json` so it prints once, not every generate).
5. Add `tests/unit/hooks/detection/copier-answers.test.ts` covering: match by gh URI, match by https URI, no `.copier-answers.yml`, malformed file, non-matching `_src_path`.
6. Update `docs/20260510_015036_[GUIDE]_hooks-management.md` with the new banner and the override command.

### Phase B — generic dedupe (3–4 days)

1. Define `Role` enum in `src/core/hooks/dedupe/role-taxonomy.ts` (closed set, ~12 values).
2. Add `role: Role` to `HookSpec` in `src/core/hooks/hook-spec.ts`; backfill every entry in `src/core/hooks/registry/<lang>.ts`.
3. Build the local-tool regex table in `src/core/hooks/dedupe/local-tool-regex.ts` (one regex per role).
4. Add the upstream-repo-ID-to-role lookup table in the same module (`{ "astral-sh/ruff-pre-commit": { "ruff": "python-lint", "ruff-format": "python-format" } }`, etc.).
5. Extend `yaml-renderer.ts`: before `repos.items.push(node)`, classify the spec's role, scan existing non-codi-marked entries for the same role, skip + comment if found.
6. Record skip in `state.json` under `dedupedRolesByExternalHook` so deterministic regeneration without rescanning.
7. Unit tests covering every (role, upstream-repo, local-tool) combination.
8. Integration test against a fixture template config.

## 8. Open Questions

- Should the role enum include `python-import-sorting` separately from `python-lint`? ruff covers both, but isort + ruff is a legitimate combo in legacy repos.
- For the banner, do we want a `--quiet` flag that suppresses it for CI? Probably yes — the banner is a one-shot anyway but CI logs benefit from less noise.
- Where does the local clone path of rl3-templates live? Hardcoded `/Users/laht/...` is wrong; we want an env var `RL3_TEMPLATES_PATH` or a config field.
- Should Phase B emit a summary at the end of `codi generate` of all skips, or only inline comments? Inline is enough; the comments tell the story when the user reads the file.

## 9. Out of Scope (Future Plans)

- Bidirectional sync: detecting that codi already added something the template wants to add, and skipping in the template side. The template uses Copier's text-marker block, which is rendered atomically; it does not scan or skip. If the user wants the template not to ship a hook, the answer is `_excluded:` in `.copier-answers.yml` (existing Copier feature, not a template change).
- Codi-meta hook install drift (`.git/hooks/codi-*.mjs` files missing). Tracked separately. The likely fix is a `codi install` post-step that copies the scripts from `node_modules/codi/dist/hooks/` to `.git/hooks/` and a `codi doctor` check that verifies them.
- Cross-tool semantic equivalence beyond pre-commit (e.g. detecting that the template runs `pyright` via the pre-push tier and that codi's `basedpyright` would be redundant). Out of scope; pre-push tier dedupe is its own plan.

## 10. Background Context (sapphira-clinic incident, 2026-05-13)

A PR from `ljr-new-data-model` to `development` on the sapphira-clinic repo failed CI initially because the branch was in conflict-state vs `development`; GitHub deferred running CI until the conflict was resolved. After rebase, CI ran and surfaced 30 mypy errors plus a ruff B904 plus biome formatting that had accumulated on the branch because every prior commit had been forced through `--no-verify` to escape duplicate pre-commit hooks. The duplicates were:

- `bandit (security)` (local, from rl3-templates) plus `PyCQA/bandit` upstream (from codi) — different repo keys, both ran, only the local one pointed at the correct `.bandit.yaml`.
- `ruff-check-fix` (local) plus `astral-sh/ruff-pre-commit ruff-check` (upstream from codi) — different repo keys, both ran, the upstream one ran from repo root and ignored `backend/pyproject.toml`'s `per-file-ignores`.
- `gitleaks v8.27.2` (template) and `gitleaks v8.21.0` (codi) — same id, both ran, version drift.
- `prettier` (codi) and `biome-check` (template) — competing formatters, prettier reformatted what biome had already formatted.
- Five codi meta-hooks (`version-bump`, `version-verify`, `doc-naming-check`, `staged-junk-check`, `conflict-marker-check`) referenced `.git/hooks/codi-*.mjs` scripts that no install step had written to that repo.

The user removed 9 hooks by hand (`.pre-commit-config.yaml` commits c9b4873 and b4fefe8 on the sapphira branch) and accepted `--no-verify` for the commits that needed to land while the cleanup happened. This plan exists so the next repo onboarding does not need that cleanup pass.
