import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  End-to-end pull request review workflow. Use when the user asks to review
  a PR, audit a pull request, comment on a PR, post a review on GitHub, or
  document PR findings. Also activate for phrases like "review PR #N",
  "review this pull request", "review my PR", "audit the PR", "post review
  on PR", "PR review doc", "check PR against claims", "review before merge",
  "pre-merge review for the PR". Produces a severity-ranked findings
  document (OWASP-aligned Critical/High/Medium/Low + Conventional Comments
  labels), saves it under docs/, and posts it to the PR via gh CLI. Do NOT
  activate for reviewing a single file or uncommitted diff (use
  ${PROJECT_NAME}-code-review), fixing issues already found (use
  ${PROJECT_NAME}-debugging), running a dedicated security audit on the
  whole codebase (use ${PROJECT_NAME}-security-scan), or writing general
  project documentation (use ${PROJECT_NAME}-project-documentation).
category: ${SKILL_CATEGORY.CODE_QUALITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
argument-hint: [pr-number]
version: 2
---

# {{name}} — Pull Request Review

## When to Activate

- User asks to review a GitHub pull request by number, URL, or branch
- User asks to audit or comment on a PR before merge
- User wants to publish a structured review (approve / request changes / comment) on a PR
- User asks to produce a PR-review document that can be shared with the team
- User invokes the /{{name}} slash command, optionally with a PR number argument

## Skip When

- User wants a review of uncommitted / local changes (no PR yet) — use ${PROJECT_NAME}-code-review
- User wants to fix issues already surfaced in a review — use ${PROJECT_NAME}-debugging
- User wants a deep OWASP security audit across the codebase — use ${PROJECT_NAME}-security-scan
- User wants general project docs (README, ADR, API) — use ${PROJECT_NAME}-project-documentation
- User wants to create, rebase, or land a PR — use ${PROJECT_NAME}-branch-finish

## Review Process — 5 Phases

The workflow is deliberately phased so each step is verifiable before the next. Do not skip phases.

### Phase 1 — Discover

**[CODING AGENT]** Gather the PR surface area before reviewing anything.

1. Resolve the PR identifier:
   - If the user passed \\\`$ARGUMENTS\\\`, treat it as the PR number
   - Otherwise run \\\`gh pr list --state open --limit 20\\\` and ask the user to confirm
2. Pull metadata and scope:
   \\\`\\\`\\\`bash
   gh pr view $PR_NUMBER                       # description, author, reviewers, labels
   gh pr diff $PR_NUMBER --name-only | wc -l   # total file count
   gh pr diff $PR_NUMBER --stat                # per-file additions/deletions
   gh pr checks $PR_NUMBER                     # CI status
   \\\`\\\`\\\`
3. Record:
   - Target branch (usually \\\`main\\\` or \\\`development\\\`)
   - Author
   - Total additions / deletions / file count
   - CI state (green / red / pending)
   - Labels and milestone
4. Decide review scale based on scope:
   - **< 200 lines changed** → inline review in main context
   - **200 – 1000 lines** → delegate to a code-review agent (see Phase 2)
   - **> 1000 lines** → delegate, and warn the user the PR exceeds healthy review size

### Phase 2 — Review

**[CODING AGENT]** Produce findings, not opinions. Prefer evidence over intuition.

**For small PRs**, read \\\`gh pr diff $PR_NUMBER\\\` yourself and generate findings directly.

**For medium / large PRs**, delegate to the code-review agent:

- Agent prompt: \\\`\${CLAUDE_SKILL_DIR}[[/agents/pr-reviewer.md]]\\\`
- Provide the agent with: PR number, PR description, file list, target branch, any specific focus areas the user mentioned

**Finding taxonomy** — every finding must include:

1. **Severity** — one of \\\`CRITICAL / HIGH / MEDIUM / LOW\\\` (OWASP Risk Rating-aligned)
2. **Label** — Conventional Comments label (\\\`issue\\\`, \\\`suggestion\\\`, \\\`nitpick\\\`, \\\`question\\\`, \\\`thought\\\`, \\\`chore\\\`, \\\`praise\\\`)
3. **Decorator** — \\\`blocking\\\` (must fix), \\\`non-blocking\\\` (should consider), or \\\`if-minor\\\` (fix only if the change is small)
4. **Evidence** — \\\`file_path:line_number\\\` citation, not inference from naming
5. **Rationale** — why it matters (one sentence)
6. **Fix** — minimal change or code snippet (skip if obvious)

Full severity / label / decorator table: \\\`\${CLAUDE_SKILL_DIR}[[/references/severity-mapping.md]]\\\`

**Focus areas** — apply these checks at minimum:

- **Security**: secrets, authn/authz, input validation, injection, OWASP Top 10 — reference CWE where relevant
- **Correctness**: logic errors, null/edge cases, state transitions, API contract drift
- **Reliability**: error handling, timeouts, retries, race conditions, transactional boundaries
- **Performance**: N+1 queries, unbounded lists, missing indexes, unnecessary re-renders
- **Testing**: new behavior without tests, tests that assert the wrong thing
- **Architecture**: file size limits, circular deps, wrong abstraction level
- **Project rules**: whatever lives in \\\`.${PROJECT_NAME}/rules/\\\` — check every change against every rule that applies

### Phase 3 — Verify (Two-Pass)

**[CODING AGENT]** Before writing the review document, critique your own findings. This cuts false positives.

**Pass 1 — Claims vs. reality**

Read the PR description. For every claim the author makes (e.g. "added rate limiting", "webhook signature verification", "GDPR purge removes all PII"), verify it against the diff:

- Is the feature actually present?
- Does a dead-code search (\\\`gh pr diff $PR_NUMBER | grep -n <symbol>\\\`) show call sites?
- Do the tests cover the behavior the claim promises?

Any claim that is not supported by the diff becomes a \\\`CRITICAL\\\` or \\\`HIGH\\\` finding under "Claims vs. reality", depending on whether it is security-relevant.

**Pass 2 — Self-critique**

Walk through your finding list and remove any finding that:

- Lacks a file:line citation
- Relies on a framework behavior you did not actually verify
- Is a style preference, not a defect (downgrade to \\\`nitpick (non-blocking)\\\` or drop)
- Contradicts an explicit project rule you did not read

Keep only findings you are confident about. A short list of real issues beats a long list of noise.

### Phase 4 — Document

**[CODING AGENT]** Produce a single markdown file that stands alone.

**Filename convention** (matches the project-documentation naming rule):

\\\`\\\`\\\`
docs/YYYYMMDD_HHMMSS_[PR_REVIEW]_pr-<N>-<slug>.md
\\\`\\\`\\\`

- Timestamp: \\\`date +"%Y%m%d_%H%M%S"\\\`
- Slug: kebab-case summary of the PR title, max 6 words
- Category tag: \\\`[PR_REVIEW]\\\` (add to the project's allowed-category list if it uses a closed set)

**Document structure** — follow the template at \\\`\${CLAUDE_SKILL_DIR}[[/references/pr-review-template.md]]\\\`. Required sections:

1. Header metadata (date, PR URL, branch, author, scope, reviewer)
2. Recommendation (approve / request changes / comment) with one-paragraph rationale
3. Severity summary table (counts per severity)
4. Findings grouped by severity, then by theme (security / correctness / reliability / performance / tests / style)
5. Claims vs. reality table from Phase 3 Pass 1
6. Minimum fixes before merge (numbered, actionable)
7. Follow-up work (can land in a later PR if tracked)
8. What is ship-worthy already (explicitly call out the solid parts)

Write the file with the \\\`Write\\\` tool. Do not attempt to shorten — the document is the durable record.

### Phase 5 — Publish

**[CODING AGENT]** Post the review to GitHub. Ask the user to confirm the verdict before posting — this is a shared-state action.

**Pick the right gh command based on the verdict:**

| Verdict | Command | When to use |
|---------|---------|-------------|
| Request changes | \\\`gh pr review $N --request-changes --body-file <doc>\\\` | Any CRITICAL or blocking HIGH finding |
| Approve | \\\`gh pr review $N --approve --body-file <doc>\\\` | No blocking findings; only nitpicks or questions |
| Comment | \\\`gh pr review $N --comment --body-file <doc>\\\` | Advisory review, author is not ready for approval decision, or you are not in the reviewer list |
| Plain comment | \\\`gh pr comment $N --body-file <doc>\\\` | Fallback if \\\`gh pr review\\\` is not available (external contributors, no review permission) |

Prefer \\\`gh pr review\\\` over \\\`gh pr comment\\\` — a review object attaches to GitHub's merge semantics (blocks merge on request-changes), a comment does not.

**Inline comments** (optional, for large reviews): if the gh-pr-review extension is installed, post individual findings as inline review comments so authors see them on the right lines. Fall back to the single-body review if the extension is missing.

After posting, return the review URL to the user (e.g. \\\`https://github.com/org/repo/pull/N#pullrequestreview-<id>\\\`).

## Output Format

When the skill completes, emit a terse summary:

\\\`\\\`\\\`
PR #<N> review complete
  doc:      <path-to-doc>
  verdict:  request-changes | approve | comment
  findings: <CRITICAL>/<HIGH>/<MEDIUM>/<LOW>
  posted:   <review-url>
\\\`\\\`\\\`

## Constraints

- Do NOT post the review to GitHub without explicit user confirmation of the verdict
- Do NOT include praise padding or sycophantic openers in the document
- Do NOT use severity inflation — HIGH is not the default, CRITICAL is rare
- Do NOT emit findings without a file:line citation
- Do NOT mix types of documents — this skill produces a PR-review report, nothing else
- Do NOT skip Phase 3 (verification) — unverified findings waste the author's time
- Do NOT paste the full diff back to the user — reference it by file and line

## Receiving a PR Review (for the author side)

If the user asks you to act on a review posted by this skill (or any PR review), apply the same verification bar in reverse:

- Read each finding and check it against the actual code before changing anything
- Push back with evidence when the reviewer is wrong ("This is intentional — see design doc section 3")
- Fix real issues tersely: "Fixed at file:line" — no "You're absolutely right!" padding

## Available Agents

- **${PROJECT_NAME}-pr-reviewer** — severity-ranked PR-aware review. Prompt at \\\`\${CLAUDE_SKILL_DIR}[[/agents/pr-reviewer.md]]\\\`

## Related Skills

- **${PROJECT_NAME}-code-review** — review code without a PR (uncommitted diff, single file, local branch)
- **${PROJECT_NAME}-security-scan** — deep OWASP scan across the whole codebase, not just the PR
- **${PROJECT_NAME}-project-documentation** — general documentation (README, ADR, API) outside PR context
- **${PROJECT_NAME}-branch-finish** — complete a feature branch; triggers this skill before merge
`;
