# Elicitation questions — intent phase

Canonical question set for `project-workflow.intent`. ONE question per turn. Every question carries a **recommended answer**. Skip any whose answer is already present in `.devloop/project.json`.

## Cross-cutting trigger — Google Sheets setup needed

**Trigger phrases (any of these from the user, at any question):** "I need to set this up", "I don't have credentials yet", "I haven't done the Google config", "I have to configure that", "I have not configured Drive", "I don't have a service account yet". Also fires automatically if the agent detects `~/.config/devloop/credentials.json` is missing AND `~/.config/gcloud/application_default_credentials.json` is missing.

### Step 0 — Auth mode question (TOP-LEVEL, asked first)

Before any setup path, the agent asks the user which authentication mode this project uses. **Three are first-class.** None is a default. The agent **recommends** based on the active gcloud account's domain (or `local_xlsx` if no Google credentials are present), but the user always picks.

```
Three methods, all fully supported. Pick one for THIS project:

  service_account  — agent acts as a non-human Google identity (a "service
                     account") that the project owns. Files are owned by
                     the SA (or by a Shared Drive on Workspace). Works in
                     CI, shared team identity, key managed via secret
                     manager. SAs have ZERO Drive quota — Drive ops require
                     a Shared Drive (Workspace) or a folder/Sheet shared
                     with the SA email.

  oauth_user       — agent acts as YOU via Google OAuth. Files are owned
                     by you, use your Drive quota. Setup is one
                     `gcloud auth application-default login` (~30s, browser).
                     Best for personal Google accounts (no SA quota dance).
                     Per-developer auth (each dev runs the gcloud command
                     once on each machine).

  local_xlsx       — no Google access at all. State persists to a local
                     `.xlsx` file under `.devloop/sheet.xlsx`. All workflow
                     features (atomic sync, snapshot, OCC `_rev`,
                     soft-delete, restore) work transparently against the
                     local file. Best for offline work, corp firewalls,
                     OAuth blocked, fast trial. Switch to a Google backend
                     later via `devloop sheets push-to-google`.

Recommended for your environment:
  - active gcloud is <email>@gmail.com / @googlemail.com  → oauth_user RECOMMENDED
  - active gcloud is <email>@<workspace-domain>           → service_account RECOMMENDED
  - no gcloud, no SA creds, OR offline-first preference   → local_xlsx RECOMMENDED

(All three work regardless of account state — the recommendation is what's
usually cleanest, not a constraint.)

Pick: service_account, oauth_user, or local_xlsx
```

After the user picks, record the answer (`auth_mode` in `.devloop/project.json` will carry it). Then surface only the setup paths relevant to that mode — described below.

**Agent response — fixed, no improvising:**

1. **STOP** the current elicitation question. Do not push past it.

2. **Invoke the `Read` tool on the canonical guide:** `devloop:sheets-sync references/google-sheets-setup.md`. Actually call Read — don't summarize from memory.

3. **DO NOT write a new guide.** The canonical guide already ships with the plugin. Authoring a duplicate (`docs/<ts>_[GUIDE]_*.md`) is an anti-pattern. If you feel the existing guide is insufficient, propose an edit to it via the `skill-creator` skill — never side-step it with a fresh markdown file.

4. **Detect available paths.** Run `command -v gcloud >/dev/null 2>&1 && echo HAS_GCLOUD || echo NO_GCLOUD` via Bash. If `HAS_GCLOUD`, the user can use the automated script (Path C). Adjust the offer:
   - **gcloud detected → offer A / B / C, recommend C.**
   - **gcloud missing → offer A / B only, recommend B for first-timers.**

### If user picked `service_account` → setup paths A / B / C

5a. **Offer the paths.** Use these labels and content verbatim (omit C if gcloud is missing):

> **A — self-service (read on your own).** I print the full path. You open it and do Steps 1–7 in your own time. When done, reply `ready` and I resume.
>
> **B — guided manual (walk through together).** I show you Step 1's content inline (literal markdown from the Read). You do it, confirm, we move to Step 2. Through Step 7 (~10–15 min). I resume the elicitation when credentials + folder are in place.
>
> **C — gcloud walkthrough (interactive, you make choices).** I walk you through gcloud setup ONE decision per turn (account → existing-or-new project → project ID → service-account name → Drive folder), then run the gcloud commands. Say _"just defaults"_ any time and I'll fast-path via `scripts/gcloud-setup.sh` instead. ~1–3 min total.
>
> **Recommended:** **C** if `gcloud` is installed and you want a few choices. **C with "just defaults"** for zero-question automation. **B** for first-timers without gcloud. **A** if you've done it before.

### If user picked `local_xlsx` → setup path E (zero setup)

5c. **No detection, no scripts, no credentials needed.** Skip directly to Sheet (here, workbook) creation:

> **E — local `.xlsx` (no Google access).** I'll write a fresh workbook at `.devloop/sheet.xlsx` with the six canonical tabs (BG / REQ / US / REL / Dashboard / Audit) plus safety columns. No `gcloud`, no SA JSON key, no folder share. The file lives in your repo; commit it like any other artifact.
>
> To switch to a Google backend later, `devloop sheets push-to-google --to-auth-mode oauth_user` will atomically migrate the data (snapshot-first, planning columns transferred 1:1).

The agent runs:

```bash
devloop sheets create-project --name "<Q1-answer>" --auth-mode local_xlsx
```

That's it — no further elicitation in this branch. Continue with the next intent question (project name, etc., if not already covered).

### If user picked `oauth_user` → setup path D (only path)

5b. **Detect ADC + offer Path D.** Run `Bash` `test -f ~/.config/gcloud/application_default_credentials.json && echo HAS_ADC || echo NO_ADC`.

> **D — OAuth user-acting (~30s, no SA dance).**
>
> - **If ADC present:** I'm ready. The active gcloud account `<email>` will be used. Skipping to Sheet creation.
> - **If ADC missing:** Run this in your terminal (one-time, browser-based):
>
>       gcloud auth application-default login
>
>   Or run the helper script: `scripts/oauth-user-setup.sh`. Reply `ready` when authenticated. The agent verifies and resumes.
>
> No project, no SA, no JSON key, no folder share required. The `devloop sheets create-project --auth-mode oauth_user` step lands the Sheet in YOUR Drive root by default; pass `--folder-id` to put it in a specific folder of yours.

6. **Wait** for the user to pick (the auth-mode question first, then the path within that mode).

7. **Honor the choice:**

   **A — self-service.** Print `cat ~/.claude/plugins/cache/devloop-marketplace/devloop/<version>/skills/sheets-sync/references/google-sheets-setup.md` (or just the relative path). Pause until user replies `ready`.

   **B — guided manual.** Present Step 1's literal content from the Read. Wait for the user to confirm completion of Step 1 before advancing to Step 2. After Step 7 verify, resume the elicitation.

   **C — gcloud walkthrough.** Drive an interactive sub-elicitation with the same one-question-per-turn / propose-and-confirm discipline. Walk these decisions in order, ALWAYS proposing a default the user can confirm or redirect:
   1. **Active gcloud account?** Run `gcloud auth list --filter=status:ACTIVE --format='value(account)'`. If empty, ask user to run `gcloud auth login [<account>]` (use `!` prefix in CC), reply `ready`. If non-empty, propose using that account; user can switch by saying `use <other@email>` (agent runs `gcloud auth login <other@email>` then `gcloud config set account <other@email>`).

   2. **DISCOVER existing devloop infrastructure first** — avoid project sprawl. Run:

      ```bash
      gcloud projects list --filter="projectId:devloop-sheets-*" \
        --format="value(projectId,createTime)" 2>/dev/null | head -5
      ```

      Then for each found project, list its devloop-sheets SAs:

      ```bash
      gcloud iam service-accounts list --project=<id> \
        --filter="email:devloop-sheets@*" --format="value(email)" 2>/dev/null
      ```

      **Branch on results:**
      - **0 projects found** → no existing infra; proceed to step 3 with default "create new".
      - **1 project found** → propose REUSING it: _"Found existing project `devloop-sheets-<ts>` (created `<date>`) with SA `devloop-sheets@...`. Reuse it (regenerates the JSON key, doesn't create new infra) or create new?"_ Default: **reuse**.
      - **2+ projects found** → list them with creation dates, ask user to pick (reuse #N) or create new. Default: most recent.

      If user picks **reuse**: skip steps 3–4 (project + SA already exist). Run the script with `--project-id <chosen-id>` — it's idempotent, keeps the existing SA, just regenerates the JSON key (existing key is backed up to `<path>.bak.<ts>` first).

      If user picks **create new**: continue to steps 3–5.

   3. **Project ID for the new project?** (only if creating new) Default: `devloop-sheets-<UTC-timestamp>`. User can override with team naming convention.
   4. **Service-account name?** Default: `devloop-sheets`. Most users keep the default; rare custom case if their team has a naming standard.
   5. **Drive folder for the Sheet?** Default: `root` (service-account-owned, shared back to user). User can paste a Drive folder ID instead.

   After all answers (or earlier if user said _"just defaults"_), invoke the script. It handles project create-or-reuse, SA create-or-reuse, and key regen idempotently:

   ```bash
   # Reuse existing project + SA (keeps both, regens key only):
   bash <plugin-root>/skills/sheets-sync/scripts/gcloud-setup.sh --project-id <chosen-id>

   # Create new project + SA + key:
   bash <plugin-root>/skills/sheets-sync/scripts/gcloud-setup.sh
   ```

   "Just defaults" smart-fast-path:
   - If exactly 1 `devloop-sheets-*` project exists → silently reuse it (`--project-id <that-one>`).
   - If 0 found → create new (no flags).
   - If 2+ found → ask user explicitly (don't auto-pick).

   On success: verify `~/.config/devloop/credentials.json` exists, then proceed to **Step 8** below. On failure: surface stderr; offer fallback to **B**, or retry with different choices.

8. **Detect account type and branch.** Once credentials are in place, the agent must determine whether the user is on a Personal or Workspace Google account, because **service accounts cannot create files in their own Drive root** (zero storage quota). The Sheet has to live under a host with quota:
   - **Personal account** (`@gmail.com`, `@googlemail.com`): user creates the Sheet themselves, shares with SA, agent populates tabs.
   - **Workspace account** (any other domain): user provides a Shared Drive (or user-owned folder shared with SA), agent creates Sheet inside via Drive API.

   Detect via the active gcloud account:

   ```bash
   gcloud auth list --filter=status:ACTIVE --format='value(account)'
   ```

   If output ends in `@gmail.com` or `@googlemail.com`, it's Personal. Otherwise Workspace. (The `gcloud-setup.sh` script prints this in its summary if Path C was used.)

   **service_account + Personal Google account:**
   1. Tell the user: "You're on a personal Google account using service-account auth. SAs can't create files there. Create the Sheet — takes ~10 seconds."
   2. Walk them through:
      - Open https://sheets.new (or Drive → New → Google Sheets → blank).
      - Name it whatever they want.
      - Share with the SA email (`~/.config/devloop/credentials.json::client_email`) as **Editor**.
      - Copy the Sheet ID from the URL (segment between `/d/` and `/edit`).
   3. Run:
      ```bash
      devloop sheets create-project --name "<Q1-answer>" --sheet-id "<sheet-id-from-user>" --auth-mode service_account
      ```

   **service_account + Workspace:**
   1. Ask for a Shared Drive ID (preferred) or a user-owned folder ID.
   2. Tell the user to add the SA email as **Content manager** on the Shared Drive (or **Editor** on the folder).
   3. Run:
      ```bash
      devloop sheets create-project --name "<Q1-answer>" --folder-id "<drive-or-folder-id>" --auth-mode service_account
      ```

   **oauth_user (any account type):**
   1. ADC is in place (Path D verified it).
   2. Ask whether the user wants the Sheet in a specific folder, or fine in their Drive root. Default: root.
   3. Run:
      ```bash
      devloop sheets create-project --name "<Q1-answer>" --auth-mode oauth_user [--folder-id "<id>"]
      ```
      The agent acts as the user. Sheet ownership = user. No share-with-SA dance needed (the user already has access — they own it).

   **local_xlsx (no Google access):**
   1. No credentials, no folders, no Sheet ID. Just run:
      ```bash
      devloop sheets create-project --name "<Q1-answer>" --auth-mode local_xlsx
      ```
   2. The workbook is written to `.devloop/sheet.xlsx` with all six canonical tabs + safety columns. `project.json` records `auth_mode: local_xlsx` and `local_path`.
   3. To migrate to a Google backend later: `devloop sheets push-to-google --to-auth-mode oauth_user` (atomic, snapshot-first; planning columns transfer 1:1).

   Either path:
   - Creates / populates the 6 canonical tabs (BusinessGoal, Requirement, UserStory, Release, Dashboard, Audit).
   - Writes `.devloop/project.json` with `project_name`, `sheet_id`, etc.
   - Commit `.devloop/project.json` (propose; user approves).

   On error: surface the exact `SheetsError` message. The most common failures are:
   - `403 caller does not have permission` → SA isn't shared on the folder/Sheet. Ask user to fix the share.
   - `403 storageQuotaExceeded` → SA tried to create a file in its own root (likely the user provided a folder the SA owns). Switch to Personal flow.
   - `403 not a member of the Shared Drive` → ask Workspace admin to add SA as Content Manager.

9. **NEVER proceed to a different elicitation question** until creds are in place. "I'll handle setup later" is acceptable — the workflow pauses, the agent records `decision_recorded` noting the deferral, and the next phase does not start.

## Q1 — Project name?

**Recommended:** `<repo directory name>` because it's already meaningful to the team and avoids a second name to remember.
Used as the human-readable name in the Sheet title and `.devloop/project.json::project_name`.

Acceptance: any non-empty string. If user responds "use the default", use the recommendation.

## Q2 — Sheet attachment: create new or attach existing?

**Recommended:** `create new` because reusing an existing Sheet risks overwriting another project's rows (the bootstrap preflight will refuse without `--force`).

If user responds `attach <Sheet ID>`:

- Validate the ID by attempting a single `sheets-sync read` against the `BusinessGoal` tab.
- If the read succeeds (or returns `not found` cleanly), the ID is good.
- If the read fails with `sheet_unreachable` or `forbidden`, surface the error and ask again.

If user responds `create new`:

- Proceed to Q3.

## Q3 — Drive folder for the new Sheet? (only if Q2 = create new)

**Recommended:** `team Drive folder ID` if known to the team; otherwise `root` (the agent's service-account-owned root in Drive).

If user provides a folder ID, the agent verifies with a Drive API `files.get` that the folder is accessible by the service account.

If `root`, the Sheet is created under the service account's root and shared with the user's Google account on success (manual sharing in v0.1; automated in v0.2).

**If the user signals they need to configure Google before answering** — fire the cross-cutting Google-setup trigger at the top of this document. Don't just acknowledge the gap; surface the A/B choice.

## Q4 — Service-account credentials path?

**Recommended:** `~/.config/devloop/credentials.json` because that's the convention the gcloud-setup script writes to and the auth resolver checks first.

**If the file is absent**, fire the cross-cutting Google-setup trigger at the top of this document — offer the user Option A (self-service) or Option B (guided walkthrough) and honor their choice. Do NOT just print the file path; actually invoke the choice.

The agent does NOT proceed past this question without working credentials. If the user says "I'll handle setup later," accept it but mark the workflow paused — the next phase needs credentials.

## Q5 — Are stakeholder sources ready?

**Recommended:** `docs/sources/*.md must contain ≥1 file` because the agent extracts Goals/Requirements/Stories from those files; without them the workflow has nothing to project.

If `docs/sources/` is empty, the agent surfaces the message:

> "I need stakeholder material in `docs/sources/*.md` before I can extract Goals. Drop interview transcripts, emails, or design notes there as markdown, then re-run."

The agent PAUSES. It does NOT proceed by inventing Goals from thin air.

## Q6 (only if `--update` mode) — Confirm the Sheet ID

**Recommended:** the `sheet_id` already in `.devloop/project.json`.

If the user wants to attach a different Sheet, that's effectively a new project — the agent suggests running `project-workflow` without `--update` instead.

## Skip rules

- If `.devloop/project.json` has `project_name`, skip Q1.
- If it has `sheet_id`, skip Q2 and Q3.
- If `~/.config/devloop/credentials.json` exists and loads, skip Q4.
- If `docs/sources/*.md` is non-empty, skip Q5 (still verify; just don't ask).
- Q6 only fires in `--update` mode.

## Hard rule

**Never invent.** If the agent finds itself wanting to "just default this so we can keep moving," that is the wrong instinct. Pause, ask the user, accept the answer.
