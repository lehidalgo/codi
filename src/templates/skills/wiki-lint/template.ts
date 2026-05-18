import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: >
  Health check the Obsidian wiki vault. Finds orphan pages, dead wikilinks, stale claims,
  missing cross-references, frontmatter gaps, and empty sections. Creates or updates
  Dataview dashboards. Generates canvas maps. Triggers on: "lint", "health check",
  "clean up wiki", "check the wiki", "wiki maintenance", "find orphans", "wiki audit".
category: ${SKILL_CATEGORY.PRODUCTIVITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 1
maintainers: ["@lehidalgo"]
---

# wiki-lint: Wiki Health Check

Run lint after every 10-15 ingests, or weekly. Ask before auto-fixing anything. Output a lint report to \`wiki/meta/lint-report-YYYY-MM-DD.md\`.

---

## Lint Checks

Work through these in order:

1. **Orphan pages**. Wiki pages with no inbound wikilinks. They exist but nothing points to them.
2. **Dead links**. Wikilinks that reference a page that does not exist.
3. **Stale claims**. Assertions on older pages that newer sources have contradicted or updated.
4. **Missing pages**. Concepts or entities mentioned in multiple pages but lacking their own page.
5. **Missing cross-references**. Entities mentioned in a page but not linked.
6. **Frontmatter gaps**. Pages missing required fields (type, status, created, updated, tags).
7. **Empty sections**. Headings with no content underneath.
8. **Stale index entries**. Items in \`wiki/index.md\` pointing to renamed or deleted pages.
9. **Address validity** (DragonScale Mechanism 2). For every page that has an \`address:\` frontmatter field, validate the format. See the **Address Validation** section below.
10. **Semantic tiling** (DragonScale Mechanism 3, opt-in). Flag candidate duplicate pages via embedding cosine similarity. See the **Semantic Tiling** section below.

---

## Lint Report Format

Create at \`wiki/meta/lint-report-YYYY-MM-DD.md\` with frontmatter (type meta, title, created/updated dates, tags, status) and sections for Summary, Orphan Pages, Dead Links, Missing Pages, Frontmatter Gaps, Stale Claims, and Cross-Reference Gaps. Use wikilinks throughout.

---

## Naming Conventions

Enforce these during lint:

| Element | Convention | Example |
|---------|-----------|---------|
| Filenames | Title Case with spaces | \`Machine Learning.md\` |
| Folders | lowercase with dashes | \`wiki/data-models/\` |
| Tags | lowercase, hierarchical | \`#domain/architecture\` |
| Wikilinks | match filename exactly | \`[[Machine Learning]]\` |

Filenames must be unique across the vault. Wikilinks work without paths only if filenames are unique.

---

## Writing Style Check

During lint, flag pages that violate the style guide:

- Not declarative present tense ("X basically does Y" instead of "X does Y")
- Missing source citations where claims are made
- Uncertainty not flagged with \`> [!gap]\`
- Contradictions not flagged with \`> [!contradiction]\`

---

## Dataview Dashboard

Create or update \`wiki/meta/dashboard.md\` with Dataview queries for: Recent Activity (sorted by updated DESC limit 15), Seed Pages Needing Development, Entities Missing Sources, and Open Questions (draft answer-quality).

---

## Canvas Map

Create or update \`wiki/meta/overview.canvas\` for a visual domain map. Add one node per domain page, connect domains that have significant cross-references. Color codes: 1=blue, 2=purple, 3=yellow, 4=orange, 5=green, 6=red.

---

## Address Validation (DragonScale Mechanism 2 MVP)

**Opt-in feature.** Runs only if \`scripts/allocate-address.sh\` is present AND \`.vault-meta/address-counter.txt\` exists.

Rollout baseline: **2026-04-23** unless overridden in \`.vault-meta/legacy-pages.txt\` (header: \`# rollout: YYYY-MM-DD\`). Vaults that adopted DragonScale later should override.

### Classification rule (per page)

| Classification | Criteria |
|---|---|
| **Meta / fold / excluded** | File in \`wiki/folds/\` OR filename in \`{_index.md, index.md, log.md, hot.md, overview.md, dashboard.md, dashboard.base, Wiki Map.md, getting-started.md}\`. Address not required. |
| **Post-rollout (must have address)** | \`type\` not meta/fold AND \`created:\` >= 2026-04-23 AND path NOT in legacy baseline manifest. |
| **Legacy (backfill-eligible)** | \`type\` not meta/fold AND \`created:\` < 2026-04-23 OR path IS in legacy baseline. Address not required until backfill. |

### Validation checks

1. **Format check**: \`^c-[0-9]{6}$\` or \`^l-[0-9]{6}$\`. Fold pages use \`fold_id\`, not \`address\`.
2. **Uniqueness check**: no two pages share the same address value.
3. **Counter consistency**: \`./scripts/allocate-address.sh --peek\` returns next counter. Observed \`c-NNNNNN\` must satisfy \`NNNNNN < peek_value\`.
4. **Post-rollout enforcement**: post-rollout pages WITHOUT \`address:\` are lint **errors**.
5. **Legacy identification**: legacy pages WITHOUT address are informational.
6. **Address-map consistency** (\`.raw/.manifest.json\`): each mapped path must exist and frontmatter must match.

Lint only observes. Do NOT auto-assign missing addresses — assignment is \`wiki-ingest\`'s responsibility.

---

## Semantic Tiling (DragonScale Mechanism 3 MVP, opt-in)

**Opt-in feature.** Flags candidate duplicate pages (across all scanned types) using embedding cosine similarity. Local ollama only by default; remote endpoints require \`--allow-remote-ollama\`.

### Detection and delegation

Run \`./scripts/tiling-check.py --peek\` first. Map exit codes to status:

| Exit | Meaning |
|---|---|
| 0  | ready |
| 2  | usage error |
| 3  | cache corrupt |
| 4  | vault exceeds scale hard-fail (batching required) |
| 10 | ollama not reachable |
| 11 | model missing — run \`ollama pull nomic-embed-text\` |

Inspect \`/tmp/tiling-peek.json\` whenever status is ambiguous. Never collapse unknown exits into "unknown status".

When ready, run \`./scripts/tiling-check.py --report wiki/meta/tiling-report-YYYY-MM-DD.md\` and surface the same exit-code map.

### Scope

- Includes: every \`.md\` under \`wiki/\` except exclusions below.
- Excludes (path): \`wiki/folds/\`, \`wiki/meta/\`.
- Excludes (filename): \`_index.md\`, \`index.md\`, \`log.md\`, \`hot.md\`, \`overview.md\`, \`dashboard.md\`, \`Wiki Map.md\`, \`getting-started.md\`.
- Excludes (frontmatter): \`type: meta\` or \`type: fold\`.
- Excludes (security): symlinks, paths that escape the vault root.

### How the helper works

Embeds via ollama \`nomic-embed-text\` by default. Caches at \`.vault-meta/tiling-cache.json\`, keyed on \`sha256(model + body)\` so model drift auto-invalidates. Frontmatter is NOT part of the hash. Orphans are GC'd on save. Concurrent-safe via exclusive flock on \`.vault-meta/.tiling.lock\`.

### Default bands (conservative, NOT calibrated)

| Band | Similarity | Report section |
|---|---|---|
| Error | \`>= 0.90\` | strong near-duplicate |
| Review | \`0.80 - 0.90\` | possible tile overlap, human judgement |
| Pass | \`< 0.80\` | not emitted |

These are conservative seeds. Reference points: Sentence Transformers \`community_detection\` defaults to 0.75; Quora-duplicate calibrations land 0.7715-0.8352. Expect false negatives until calibrated.

### Calibration procedure (manual, one-time per vault)

1. Run with defaults; capture Review-band pairs.
2. Lower \`bands.review\` to 0.70 in \`.vault-meta/tiling-thresholds.json\`; aim for >=50 pairs spanning 0.70-0.95.
3. Label pairs: \`duplicate\`, \`similar\`, \`distinct\`.
4. Pick bands: \`error\` >= 95% true duplicates; \`review\` captures \`similar\` without swamping with \`distinct\`.
5. Update \`.vault-meta/tiling-thresholds.json\`: new bands, \`calibrated: true\`, \`calibration_pairs_labeled\` count.
6. Re-run lint. Footer now says \`calibrated: true\`.

### Scale

Cold cache: O(N) POSTs to ollama. Warm cache: O(N^2) cosines in pure Python. Warning at > 500 pages, hard-fail (exit 4) at > 5000.

### Invariants

- Read-only. The helper never modifies wiki pages.
- No auto-merge. Duplicates are listed, never resolved.
- Cache is incremental and model-scoped.
- Surface every exit code distinctly — never collapse to "unknown".

---

## Before Auto-Fixing

Always show the lint report first. Ask: "Should I fix these automatically, or do you want to review each one?"

Safe to auto-fix:
- Adding missing frontmatter fields with placeholder values
- Creating stub pages for missing entities
- Adding wikilinks for unlinked mentions

Needs review before fixing:
- Deleting orphan pages (they might be intentionally isolated)
- Resolving contradictions (requires human judgment)
- Merging duplicate pages
`;
