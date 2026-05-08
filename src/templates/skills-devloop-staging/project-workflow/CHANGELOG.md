# Changelog — project-workflow skill

## [0.1.9] — 2026-05-02

### Changed — Auth-mode is now a TOP-LEVEL elicitation question

- **`elicitation-questions.md`** — added Step 0 "Auth mode question" before any setup paths. The agent asks the user which authentication mode this project uses (`service_account` or `oauth_user`). Recommends based on detected gcloud account domain (gmail.com → oauth_user; Workspace → service_account) but the user always picks. Both are first-class; neither is the default.
- **Setup paths now branch by auth mode:**
  - `service_account` → existing A / B / C paths (manual / guided / gcloud-walkthrough).
  - `oauth_user` → new Path D (`gcloud auth application-default login` once, ~30s).
- **`phase-intent.md`** Step 3 — branches on `auth_mode` first, then on Personal-vs-Workspace within service_account mode.

### Why

Web research + dogfood testing confirmed: service accounts on personal Google accounts have zero Drive quota and cannot own files. OAuth user-acting auth is the canonical workaround. Both modes are valid for different scenarios — neither replaces the other. The skill makes the choice explicit: ask the user, recommend based on context, but never pick silently.

### Versions

- contract.json bumped 0.1.8 → 0.1.9.

## [0.1.8] — 2026-05-02

### Changed

- **`phase-discover.md` + `phase-decompose.md`** rewritten to use the **draft+sync** pattern:
  1. Agent writes `.devloop/draft/<phase>.json` with all rows in one Write tool call.
  2. Agent runs `devloop sheets sync-draft .devloop/draft/<phase>.json` in one Bash call.
  3. User reviews in Sheet, approves OR edits the local draft and asks for resync.
- **`SKILL.md` anti-pattern**: "Per-row `devloop sheets upsert` for batches. Use `devloop sheets sync-draft <path>`."
- **Hook-logic**: `.devloop/draft/*.json` (nested paths) are now permitted writes any phase. `.gitignore` is also a workflow-config artifact and writable any phase.

### Why

Token economy. Per-row upsert calls for ~13 rows = ~11,500 tokens. Draft+sync = ~2,000 tokens. Plus the user can edit the local draft directly to redirect — no need to redo the conversation.

### Versions

- contract.json bumped 0.1.7 → 0.1.8.

## [0.1.7] — 2026-05-02

### Changed

- **Path C now discovers existing devloop infrastructure first.** Before creating a new Cloud project, the agent runs `gcloud projects list --filter="projectId:devloop-sheets-*"` and lists existing service accounts. Branches on result: 0 → create new, 1 → propose reuse (default), 2+ → ask user to pick. Avoids project sprawl across retries.
- **`elicitation-questions.md` Step 7 (Path C)** has a new explicit "DISCOVER existing devloop infrastructure first" sub-step before project/SA creation questions. When reusing, skips Q3 (project ID) + Q4 (SA name) entirely — just regenerates the JSON key.
- **`phase-intent.md` Step 4** adds the discovery cue (`c2`) so the agent surfaces existing infra in the A/B/C offer.
- **"Just defaults" fast-path is smarter:** if exactly 1 `devloop-sheets-*` project exists, silently reuses it. 0 → create new. 2+ → ask.

### Why

Dogfood testing showed every Path C run created a new project + SA. Wasteful (12-project soft quota), and the SA-owned 'test' folder + project from each run hangs around. Discover-first-then-decide eliminates the sprawl.

### Versions

- contract.json bumped 0.1.6 → 0.1.7.

## [0.1.6] — 2026-05-02

### Changed

- **"Sheet is the canvas" principle promoted to the Iron Law.** The agent now writes Goals / Requirements / Stories DIRECTLY to the Sheet during `discover` and `decompose` — no longer dumps the proposed rows in chat as a markdown table BEFORE writing. The user reviews in the Sheet (its native tabular UI is the better review surface) and approves with one word.
- **`phase-discover.md`** rewritten: "canvas rule" section + step ordering changes. Agent extracts internally, writes to Sheet via `devloop sheets upsert ... --bootstrap`, then surfaces ONE summary message with row IDs and the Sheet URL.
- **`phase-decompose.md`** same treatment. Refined Stories upsert to Sheet; one summary message in chat (IDs + counts + non-obvious decisions only).
- **`SKILL.md` anti-patterns** add explicit entry: "Dumping proposed rows in chat as a markdown table BEFORE writing to the Sheet."

### Why

In dogfood testing the agent printed a 13-row markdown table of Goals + Requirements (~600 tokens) in chat, asked the user to review, then immediately wrote the same rows to the Sheet (~600 more tokens of CLI output). Same content emitted twice, and the chat table was less reviewable than the Sheet's native format. New rule: write to Sheet first, surface a one-sentence summary, ask for approval.

### Versions

- contract.json bumped 0.1.5 → 0.1.6.

## [0.1.5] — 2026-05-02

### Changed

- **`elicitation-questions.md` Step 8 is now account-type-aware.** After credentials are in place, the agent detects whether the user is on a Personal Google account or a Workspace account (via `gcloud auth list` domain check), then branches:
  - **Personal:** walks user through creating a blank Sheet in their own Drive, sharing with SA email, then runs `devloop sheets create-project --name "X" --sheet-id "<id>"`.
  - **Workspace:** asks for a Shared Drive ID (preferred) or user-owned folder, then runs `devloop sheets create-project --name "X" --folder-id "<id>"`.
  - **Failure-mode dispatch:** documents specific 403 errors (`storageQuotaExceeded`, `not a member of Shared Drive`, `caller does not have permission`) and the right corrective action for each.
- **`phase-intent.md` Step 3** now explicitly branches on account type with the same Personal-vs-Workspace logic.

### Why

Web research + dogfood testing showed that service accounts on personal Google accounts cannot create files anywhere (zero Drive quota, even in folders shared TO them on post-April-2025 SAs). The skill must recognize this and switch to the "user creates the Sheet, agent populates it" pattern. Workspace users with Shared Drives don't hit the quota issue and can use the full automation.

### Versions

- contract.json bumped 0.1.4 → 0.1.5.

## [0.1.4] — 2026-05-02

### Changed

- **Path C is now interactive.** Instead of just running the script, the agent walks the user through 5 gcloud decisions ONE per turn (active account → existing-or-new project → project ID → service-account name → Drive folder), then runs the gcloud commands. Users can say _"just defaults"_ any time to fast-path via the script. Same elicitation discipline (propose-and-confirm) applies.
- **`phase-intent.md` Step 3** now uses `devloop sheets create-project --name ...` (the new CLI added in sheets-sync 0.1.3) instead of pointing at a TypeScript function the agent can't invoke.
- **`elicitation-questions.md` Step 8** added: after Path A/B/C provisions credentials, the agent runs `devloop sheets create-project` to create the Sheet AND write `.devloop/project.json` in one step.

### Fixed

- Plugin hook (lib/hook-logic.ts) now allows writes to `.devloop/*.json` and `.devloop/*.jsonl` in any phase. Previously the hook treated `.devloop/project.json` as "source code" and blocked it during `intent`, making the intent gate impossible to clear. The hook fix lives outside the skill but is documented here because it unblocks project-workflow's intent phase.

### Why

In dogfood testing the agent (a) couldn't write `.devloop/project.json` due to the hook block, (b) had no CLI to invoke `createProjectSheet`, (c) had a Path C that ran the script with zero user input — couldn't pick a different gcloud account or project ID. All three are fixed.

### Versions

- contract.json bumped 0.1.3 → 0.1.4.

## [0.1.3] — 2026-05-02

### Changed

- Cross-cutting Google-setup trigger now detects `gcloud` and offers **A / B / C** when available (C = automated via `sheets-sync/scripts/gcloud-setup.sh`). When gcloud is missing, falls back to **A / B** as before. Recommendation logic: **C** when available, **B** for first-timers without gcloud, **A** for experienced users.
- `phase-intent.md` Step 4: detect-gcloud sub-step added; honor-the-choice block extended for Path C (verify `gcloud auth list`, run script via Bash, fall back to B on failure).
- `elicitation-questions.md` cross-cutting trigger: full Path C section added with trigger phrases, verbatim labels, and the script invocation.
- `SKILL.md` Google-setup-discipline line updated to A/B/C.

### Versions

- contract.json bumped 0.1.2 → 0.1.3.

## [0.1.2] — 2026-05-02

### Changed

- **SKILL.md body** — promoted the propose-defaults discipline to a top-level Iron Law (3 rules: propose-not-interrogate / one-question-per-turn / use-existing-references). Added explicit "Google setup discipline" section pointing at the canonical guide. Added anti-patterns: "Asking 2+ questions in one turn" and "Authoring a new `[GUIDE]_*.md` for Google setup".
- **`references/phase-intent.md`** — Step 0 now mandates reading `references/elicitation-questions.md` before asking anything. Step 4 (credentials check) explicitly mandates `Read`-ing the canonical guide and offering the A/B walkthrough; explicitly forbids authoring a new guide doc.
- **`references/elicitation-questions.md`** — cross-cutting trigger reworded to be unambiguous: "Invoke `Read` tool on canonical guide", "DO NOT write a new guide", "Offer A or B verbatim", "Wait for choice".

### Why

In dogfood testing, the agent (a) asked 4 questions in one turn, (b) detected missing credentials and proposed `scope expansion` to AUTHOR a NEW `[GUIDE]_gcp-service-account-credentials.md`, instead of reading the canonical guide that ships in `sheets-sync/references/google-sheets-setup.md`. The previous wording ("Surface the setup guide. Read … and offer to walk through") was too soft. The new wording is procedural and verbatim.

### Versions

- contract.json bumped 0.1.1 → 0.1.2.

## [0.1.1] — 2026-05-02

### Changed

- `references/elicitation-questions.md` — when the user signals they need Google setup (at Q2, Q3, or Q4), the agent now offers a clear two-option choice instead of just naming the guide file:
  - **Option A — self-service:** agent prints the file path, user reads on their own time, replies `ready` to resume.
  - **Option B — guided:** agent invokes `Read` on the guide and walks the user step-by-step, confirming each step before moving to the next.
- Cross-cutting trigger documented at the top of the file so all three questions (Q2/Q3/Q4) share the same UX — no matter where the user signals the gap, the agent surfaces the same A/B choice.
- contract.json bumped 0.1.0 → 0.1.1.

### Why

In dogfood testing, when a user said "ok, I have to configure that" at Q3, the agent only NAMED the setup guide instead of reading and presenting its content. The previous instruction "Surface the setup guide. Read … and offer to walk through" was too soft — got interpreted as "mention the path". The new A/B choice is unambiguous: pick one, the agent does it.

## [0.1.0] — 2026-05-02

### Added

- Initial skill (P2 of project-workflow + Google Sheets layer).
- 5-phase workflow: intent → discover → decompose → sync → done.
- contract.json declaring 4 gate clusters with deterministic + agent checks; 2 HARD GATES (strategic-layer approval after discover; decomposition-readiness approval after decompose).
- evals/evals.json with 7 RED cases — bootstrap trigger, one-question-per-turn elicitation, both HARD GATES, refuse-on-empty-sources, re-runnable update mode, skip-prefilled elicitation.
- references/phase-{intent,discover,decompose,sync}.md per-phase flow.
- references/elicitation-questions.md — canonical question set for the intent phase.

### Notes

P2 ships the bootstrap path. Sheet creation via Drive/Sheets API is implemented by the new lib/sheets/bootstrap.ts helper. `--update` mode for incremental absorption of new sources is included.

Existing workflow integration (`devloop run feature --from-story US-NNN`) ships in P3.
