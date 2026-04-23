# pr-review — Developer Documentation

## What This Skill Does

`codi-pr-review` is a built-in skill that takes a GitHub pull request through a five-phase review: discover (gh pr view / diff / checks), review (delegated to a PR-aware reviewer agent), verify (two-pass: claims vs. reality, then self-critique), document (persists a structured markdown report under `docs/` using the `[PR_REVIEW]` category tag), and publish (posts via `gh pr review --request-changes|--approve|--comment`). Output follows OWASP-aligned severity (Critical/High/Medium/Low), Conventional Comments labels, and the Google eng-practices spirit of balancing code health vs. forward progress.

## Directory Structure

```
pr-review/
├── template.ts                          TypeScript template literal with SKILL.md content + frontmatter
├── index.ts                             Exports template and staticDir (required by skill-template-loader)
├── README.md                            This file — developer documentation
├── evals/
│   └── evals.json                       10 test cases (5 positive, 1 slash-command, 4 negative)
├── references/
│   ├── severity-mapping.md              OWASP × Conventional Comments × decorator table with worked examples
│   └── pr-review-template.md            The markdown skeleton the skill emits in Phase 4
└── agents/
    └── pr-reviewer.md                   PR-aware reviewer agent prompt (3-pass: find → verify claims → self-critique)
```

## Workflow

1. **Phase 1 — Discover.** The agent resolves the PR number (from `$ARGUMENTS` or `gh pr list`), then pulls metadata, file inventory, and CI state. Review scale is decided from LOC changed: inline for small PRs, delegate to `pr-reviewer` agent for medium/large PRs.
2. **Phase 2 — Review.** Either inline or via `agents/pr-reviewer.md`. Every finding carries severity + Conventional Comments label + decorator + file:line citation + CWE for security findings.
3. **Phase 3 — Verify.** Two passes. Pass 1 walks every claim in the PR description and greps the diff for the claimed symbols — defined-but-unused is flagged CRITICAL for security-sensitive claims. Pass 2 drops unverifiable or opinion-only findings.
4. **Phase 4 — Document.** Writes `docs/YYYYMMDD_HHMMSS_[PR_REVIEW]_pr-N-slug.md` following the skeleton in `references/pr-review-template.md`. The skill does not commit the file.
5. **Phase 5 — Publish.** Asks the user to confirm the verdict, then posts via `gh pr review` (preferred — attaches to merge semantics) or falls back to `gh pr comment` for contributors without review permission. Returns the review URL.

## Configuration

No configurable values. The skill reads project rules from `.${PROJECT_NAME}/rules/` (resolved at runtime via `PROJECT_NAME` constant) and project docs directory conventions (`docs/` with `[CATEGORY]` tag) from the repo itself. If the host project uses a closed category set that does not include `[PR_REVIEW]`, the skill instructs the user to add it or falls back to `[REVIEW]`.

## Output Conventions

### Document file naming

```
docs/YYYYMMDD_HHMMSS_[PR_REVIEW]_pr-<N>-<slug>.md
```

- Timestamp from `date +"%Y%m%d_%H%M%S"`
- `[PR_REVIEW]` is the category tag
- `<slug>` is a kebab-case summary of the PR title, max 6 words

### Document structure

The markdown follows `references/pr-review-template.md`. Required sections:

1. Header metadata (PR URL, branch, author, scope, reviewer)
2. Recommendation with one-paragraph rationale
3. Severity summary table
4. Findings grouped by severity (CRITICAL → LOW), then by theme
5. Claims vs. reality table (from Phase 3 Pass 1)
6. Minimum fixes before merge (numbered, actionable)
7. Follow-up work that can land in a separate PR
8. Ship-worthy callouts (what's already solid)

### GitHub post shape

The skill posts one body-level review via `gh pr review` with the full markdown doc as body. Inline comments are optional — they require the `gh-pr-review` extension and are only used for CRITICAL / HIGH findings when the reviewer wants them anchored to specific lines.

## Installed Requirements

- `gh` CLI (GitHub CLI) — required for all phases. The skill expects the user to be authenticated (`gh auth login`).
- Optional: [`gh-pr-review`](https://github.com/agynio/gh-pr-review) extension for inline threaded comments. Skill falls back to body-level review if absent.

No Node or Python scripts ship with this skill — it is SKILL.md + references + agent prompt only. This is a deliberate deviation from the skill-creator default (Python+TS helper scripts); there is no deterministic logic to extract beyond the gh CLI calls that live directly in SKILL.md.

## Design Decisions

- **Separate from `codi-code-review`.** Code review and PR review share primitives (severity, evidence, findings) but differ in orchestration: PR review must handle gh CLI, the PR description claim-check, the published doc, and the posted review. Keeping them separate avoids bloating `codi-code-review` with PR-only concerns, and lets `pr-review` call `code-review` internally if the host project later factors that out.
- **OWASP-aligned severity instead of the legacy `Critical / Warning / Suggestion`.** OWASP's scale maps cleanly to CVSS and CWE, which is what automated tooling and compliance review expect. Conventional Comments labels carry the author-intent signal that OWASP severity alone lacks.
- **Two-pass verification is non-negotiable.** This is the single biggest lever for review precision. Claude Code's own [Code Review docs](https://code.claude.com/docs/en/code-review) document the same pattern (verification bar + self-critique) and report large reductions in false positives in production usage.
- **`gh pr review` over `gh pr comment` as the default.** Review objects attach to GitHub's merge semantics (request-changes blocks merge). Plain comments do not. The skill keeps `gh pr comment` as a fallback for contributors without review permission.
- **No scripts.** Anything the skill does can be expressed as a gh CLI call or a Write. Adding a Python/TypeScript wrapper would add a maintenance burden without deterministic payoff.

## Adapting for Similar Use Cases

To build a GitLab or Bitbucket variant:

1. Copy this directory to `src/templates/skills/mr-review/` (or similar)
2. Swap `gh pr` commands in `template.ts` for `glab mr` or `bb pr`
3. Adjust the review-object semantics — GitLab's `--request-changes` equivalent is `glab mr approve` / `glab mr unapprove`, Bitbucket uses `bb pr approve`
4. Keep the severity / label / decorator taxonomy unchanged — these are VCS-agnostic
5. Update evals to use the new CLI tool and re-run

## Testing

Run the evals:

```bash
npm run test:skills -- pr-review     # if a harness exists
```

Manual validation:

```bash
# 1. Install the skill locally
npm run build
codi add skill codi-pr-review --template codi-pr-review

# 2. Validate frontmatter and schema
codi validate

# 3. Generate agent configs
codi generate

# 4. Exercise the skill on a real PR
# In a repo with an open PR:
# /codi-pr-review <pr-number>
```

Check that the skill:

- Reads the PR via `gh pr view` and `gh pr diff`
- Produces the document under `docs/` with the correct filename convention
- Asks for confirmation before posting to GitHub
- Uses `gh pr review --request-changes` when findings include CRITICAL or blocking HIGH

## Related

- `codi-code-review` — review code that is not yet in a PR (uncommitted, single file, local branch)
- `codi-security-scan` — deep OWASP audit across the whole codebase, not scoped to one PR
- `codi-project-documentation` — general docs (README, ADR, API) outside PR context
- `codi-branch-finish` — feature-branch lifecycle; can trigger this skill before proposing the merge
