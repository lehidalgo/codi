# Phase: intent

Confirm scope, name the project, attach or create the Sheet, capture credentials. Nothing in the Sheet yet — this phase only resolves config.

## Inputs

- Optional: existing `.devloop/project.json` (if so, skip questions whose answers are present).
- Optional: `~/.config/devloop/credentials.json` (Google service-account JSON key).
- Optional: `docs/sources/*.md` (checked at end of phase, not start).

## Steps

0. **READ `references/elicitation-questions.md` BEFORE asking anything.** It is the literal contract for this phase. Don't paraphrase. Don't combine questions. Don't preview the upcoming list to the user.

1. **Read `.devloop/project.json`** if present. Pre-populate any answers already there.

2. **Propose-and-confirm, ONE question per turn.** The agent infers a sensible default from the source material and repo state (project name from repo dir or source filenames; Sheet attachment defaulting to "create new"; etc.) and presents it as a proposal: _"I'll go with X — confirm or redirect."_ NOT as a menu.
   - **One question per turn.** Even when the next 3 are obvious, ask the first only. Stop. Wait. Then the next. NEVER bundle multiple questions into one response ("a few things from intent: 1...2...3...").
   - Every question carries a recommended answer.
   - Skip questions whose answers are already on disk.

3. **Decision point — create or attach (auth-mode + account-type-aware):**

   First branch: which `auth_mode` did the user pick at the auth-mode question (Step 0 of `references/elicitation-questions.md`)?
   - **`local_xlsx`** (no Google access at all): no credentials, no folders, no Sheet ID. Run:

     ```bash
     devloop sheets create-project --name "<project_name>" --auth-mode local_xlsx
     ```

     Workbook lands at `.devloop/sheet.xlsx` with all six canonical tabs + safety columns. To migrate to Google later: `devloop sheets push-to-google --to-auth-mode oauth_user` (atomic, snapshot-first).

   - **`oauth_user`** (any account type): the agent acts as the user via ADC. Sheet ownership = user, user's quota. Run:

     ```bash
     devloop sheets create-project --name "<project_name>" --auth-mode oauth_user [--folder-id "<id>"]
     ```

     `--folder-id` is optional — defaults to user's Drive root. No SA share dance.

   - **`service_account` + Personal Google account** (`@gmail.com`): user creates a blank Sheet in their own Drive, shares with SA email as Editor → agent runs:

     ```bash
     devloop sheets create-project --name "<project_name>" --auth-mode service_account --sheet-id "<id>"
     ```

   - **`service_account` + Workspace** with Shared Drive: user provides a Shared Drive ID where SA has Content Manager role → agent runs:

     ```bash
     devloop sheets create-project --name "<project_name>" --auth-mode service_account --folder-id "<shared-drive-id>"
     ```

   - **User pasted an existing Sheet ID** at Q2 (any Google auth_mode) → use `--sheet-id` form. Bootstraps tabs/headers idempotently into the existing Sheet.

   See `references/elicitation-questions.md` Step 8 for the full branch including the auth-mode top-level question.

4. **Credentials check — IF MISSING, run the Google-setup discipline (do NOT just print a path; do NOT write a new guide):**

   a. **STOP** the current question.

   b. `Read` the canonical guide via the tool: `devloop:sheets-sync references/google-sheets-setup.md`. Read it actually — invoke the Read tool. Don't summarize from memory.

   c. **Detect gcloud first:** `Bash` `command -v gcloud >/dev/null 2>&1 && echo HAS_GCLOUD || echo NO_GCLOUD`.

   c2. **Discover existing devloop infrastructure** (only if HAS_GCLOUD): `Bash` `gcloud projects list --filter="projectId:devloop-sheets-*" --format="value(projectId)" | head -5`. If results exist, surface them in the C-path offer ("found existing project X — would reuse instead of creating new"). Avoids project sprawl.

   d. **Offer the user the paths.** A and B always; C only if `HAS_GCLOUD`:

   > **A — self-service.** I print the full file path. You read on your own time. Reply `ready` to resume.
   >
   > **B — guided walkthrough.** I show you Step 1's content inline (literal markdown from the Read). You do it. You confirm. We do Step 2. Through Step 7 (~10–15 min). I resume when creds are in place.
   >
   > **C — automated via gcloud** _(only when gcloud is detected)._ I run `scripts/gcloud-setup.sh`. It creates a Cloud project, enables APIs, makes a service account, drops the JSON key. ~30 seconds after you run `gcloud auth login`.
   >
   > **Recommended:** **C** if available. Otherwise **B** if first-time, **A** if experienced.

   e. **Wait** for the user to pick. Do NOT proceed to a different question.

   f. Honor the choice:
   - **A:** print the full path. Pause until the user replies `ready`.
   - **B:** present each step's literal content (don't paraphrase). Wait for confirmation between steps.
   - **C:** verify `gcloud auth list` shows an active account; if not, ask the user to run `gcloud auth login` and reply `ready`. Then `Bash` the script: `bash <plugin-root>/skills/sheets-sync/scripts/gcloud-setup.sh`. On success, surface stdout summary; on failure, surface stderr and offer to fall back to **B**.

   g. **NEVER write a new `[GUIDE]_*.md`** for Google setup. The canonical guide already ships in the `sheets-sync` skill. Authoring a duplicate is an anti-pattern recorded in `SKILL.md`.

5. **Sanity check `docs/sources/`** — at least one `*.md` file must exist for `discover` to have anything to read. If empty, surface the message and PAUSE — do NOT proceed and do NOT auto-fabricate sources.

6. **Commit `.devloop/project.json`** to the repo (the agent stages and proposes the commit; the human approves).

## Exit criteria (gate: intent-complete)

- `.devloop/project.json` exists with `project_name` and `sheet_id`.
- Credentials successfully loaded.
- `docs/sources/` has ≥1 `.md` file.
- Human explicitly approves the `intent → discover` transition.

## Anti-patterns

- Inventing a project name from `git remote` without confirming.
- Silently creating the Sheet under the agent's service-account ownership without asking the user about the Drive folder.
- Skipping the source check because "the user said go ahead."
- Asking all questions in one wall — one per turn, always with a recommendation.

## Events emitted

- `init` — workflow started.
- `phase_started phase=intent`.
- `decision_recorded` — for each elicitation answer (so they're auditable).
- `artifact_linked` — for `.devloop/project.json` and the Sheet URL.
- `phase_completed phase=intent`.
- `phase_transition_proposed intent → discover`.
- `phase_transition_approved` (human-authored).
