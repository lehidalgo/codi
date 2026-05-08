# Google Sheets setup for devloop

One-time setup so devloop can create and write to a project Sheet on your behalf.

## Pick your auth mode FIRST — both fully supported

Devloop supports two authentication modes. Both are first-class. The skill asks you which to use; this doc covers setup for each.

| Mode                  | Identity                                              | Setup time                                         | Best for                                                                      |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| **`service_account`** | A non-human Google identity (the SA) the project owns | ~10–15 min (manual) or ~30s (gcloud-setup.sh)      | Workspace + Shared Drive teams; CI/unattended use; shared team identity       |
| **`oauth_user`**      | YOU (via Google OAuth ADC)                            | ~30s after `gcloud auth application-default login` | Personal Google accounts (no SA Drive quota issue); single-developer projects |

You pick at project bootstrap (saved to `.devloop/project.json::auth_mode`). Different projects on the same machine can use different modes — they coexist.

---

### Path D — `oauth_user` setup (~30s, Workspace accounts)

```bash
# One-time, opens a browser. Sign in with the account devloop should act as.
~/.claude/plugins/cache/devloop-marketplace/devloop/<version>/skills/sheets-sync/scripts/oauth-user-setup.sh
```

The script runs `gcloud auth application-default login` with the canonical scopes (openid, userinfo.email, cloud-platform, spreadsheets, drive) and probes the resulting ADC token to confirm scopes actually stuck.

Verify with:

```bash
devloop sheets auth-check
# Expected:  ✓ Resolved: oauth_user (your-email@gmail.com)
#            Scope probe: OK (HTTP 404)
```

Then create a project Sheet (lands in your Drive root by default):

```bash
devloop sheets create-project --name "<project>" --auth-mode oauth_user
```

### Path D' — personal Gmail (when Path D hits the unverified-app block)

Google blocks the gcloud built-in OAuth client from requesting Sheets/Drive scopes on personal Gmail accounts. The recovery is a project-owned OAuth client + adding yourself as a Test User. devloop ships a guided-automation script:

```bash
~/.claude/plugins/cache/devloop-marketplace/devloop/<version>/skills/sheets-sync/scripts/oauth-user-project-client-setup.sh
```

**What it automates** (~80 % of the work):

- Picks an existing `devloop-sheets-*` Cloud project or creates a fresh one.
- Enables `sheets.googleapis.com` and `drive.googleapis.com`.
- Opens the Console at the consent-screen URL pre-filled with your project ID.
- Opens the Console at the credentials URL pre-filled with your project ID.
- Watches `~/.config/devloop/oauth-client.json` for the downloaded client JSON (5-min timeout).
- Validates the JSON shape.
- Runs `gcloud auth application-default login --client-id-file=… --scopes=…`.
- Runs the post-login scope probe.

**What you do** (~90 seconds of clicks):

1. Consent screen: User Type **External** → fill the three required fields → add yourself as **Test User**.
2. Credentials → Create credentials → OAuth client ID → **Desktop app** → Download JSON to `~/.config/devloop/oauth-client.json`.

The script picks up the JSON automatically and finishes the ADC login. You end up with the same `oauth_user` mode as Path D, but using your own OAuth client (which Google does NOT block).

**Why "Testing" mode is fine:** External + Testing is exactly what Google's OAuth verification model is designed for — apps in Testing skip the verification screen for users you've explicitly added as Test Users.

For `service_account` mode, see Steps 1–7 below (manual / B-guided / C-gcloud paths).

---

## `service_account` — three sub-paths

**Pick one:**

| Sub-path                                      | Time                           | Best for                                    |
| --------------------------------------------- | ------------------------------ | ------------------------------------------- |
| **A — self-service** (this doc, Steps 1–7)    | ~10–15 min                     | Full control, no `gcloud`                   |
| **B — guided** (agent walks Steps 1–7 inline) | ~10–15 min                     | First-timers who want the agent's hand      |
| **C — automated** (`scripts/gcloud-setup.sh`) | ~30s after `gcloud auth login` | Devs with `gcloud` and project-create perms |

Pick **C** if available. Steps 1–7 below describe the manual path used by both A and B.

You build a Google Cloud service account, enable the Sheets + Drive APIs, generate a JSON key, place it on disk, and share a Drive folder with the service account so it can drop new Sheets there.

## What you'll have at the end

- A Google Cloud project with the **Sheets** and **Drive** APIs enabled.
- A **service account** (e.g. `devloop-sheets@<project>.iam.gserviceaccount.com`).
- A **JSON key** at `~/.config/devloop/credentials.json` (mode `0600`).
- A **Drive folder** the service account can write to.
- A short verification command that confirms the loop works.

## Prerequisites

- A Google account (personal or Workspace).
- Owner / Editor access to a Google Cloud project, or permission to create one. If your Workspace admin restricts service-account creation, ask them or use a personal Google account.
- `gcloud` CLI is **optional** — every step below has a console-only path.

---

## Step 1 — Pick or create a Google Cloud project

1. Open the Cloud Console: https://console.cloud.google.com/
2. Top bar → project dropdown → **New Project**.
3. Name it (e.g. `devloop-sheets`). Note the **Project ID** — you'll see it under the name. Project IDs are globally unique; the system suggests a suffix if your name is taken.
4. Click **Create**. Wait ~10 seconds for the project to provision.
5. Confirm the new project is selected in the top bar.

If you already have a Cloud project you want to reuse, just select it.

## Step 2 — Enable the Sheets and Drive APIs

In the new project:

1. Sidebar → **APIs & Services** → **Library**.
2. Search `Google Sheets API` → click the result → **Enable**.
3. Back to **Library** → search `Google Drive API` → click → **Enable**.

Both APIs must be enabled in the **same project** that holds the service account.

## Step 3 — Create the service account

1. Sidebar → **IAM & Admin** → **Service Accounts** → **+ Create Service Account**.
2. **Service account name:** `devloop-sheets`. The account ID auto-fills (`devloop-sheets`).
3. **Description:** `Used by devloop CLI to read/write project Sheets`.
4. Click **Create and Continue**.
5. **Grant this service account access to project** — leave empty. Click **Continue**. (We don't need IAM roles at the project level; access is scoped to specific Sheets and Drive folders we share with it.)
6. **Grant users access to this service account** — leave empty. Click **Done**.

You're back on the Service Accounts list. Click the new account to open it. **Copy the email** (e.g. `devloop-sheets@<project>.iam.gserviceaccount.com`) — you'll paste it when you share the Drive folder in Step 6.

## Step 4 — Generate and download the JSON key

Still on the service-account page:

1. Top tabs → **Keys** → **Add Key** → **Create new key**.
2. **Key type:** JSON. Click **Create**.
3. The browser downloads `<project-id>-<keyhash>.json`. Treat this file as a **password** — anyone with it can act as the service account.

Move it to the canonical path immediately:

```bash
mkdir -p ~/.config/devloop
mv ~/Downloads/<project-id>-<keyhash>.json ~/.config/devloop/credentials.json
chmod 600 ~/.config/devloop/credentials.json
```

If you want a different path, set `DEVLOOP_GOOGLE_CREDENTIALS=/path/to/key.json` in your shell profile and skip the rename.

**Verify the key:**

```bash
python3 -c "import json; k=json.load(open('$HOME/.config/devloop/credentials.json')); print(k['client_email']); print('type =', k['type'])"
```

Expected:

```
devloop-sheets@<project>.iam.gserviceaccount.com
type = service_account
```

If `type` is anything other than `service_account`, you grabbed the wrong file.

## Step 5 — Create a Drive folder for project Sheets

1. Open Drive: https://drive.google.com/
2. **+ New** → **Folder** → name it `devloop-projects` (or whatever your team agrees).
3. Open the folder. The URL bar now shows `https://drive.google.com/drive/folders/<FOLDER_ID>`.
4. **Copy the FOLDER_ID** — the long alphanumeric segment after `/folders/`. You'll paste it into `.devloop/project.json` (or hand it to the agent during `project-workflow.intent`).

## Step 6 — Share the folder with the service account

1. Right-click the `devloop-projects` folder → **Share**.
2. **Add people and groups:** paste the service-account email from Step 3 (`devloop-sheets@<project>.iam.gserviceaccount.com`).
3. **Role:** Editor.
4. **Notify people:** uncheck (service accounts don't read email).
5. **Send / Done**.

Now any Sheet the service account creates inside this folder is owned by the folder, accessible by your team (because they own the folder), and editable by the service account.

## Step 7 — Verify the loop

In the test project (e.g. `/tmp/devloop-walkthrough/project/`):

```bash
cd /tmp/devloop-walkthrough/project
# Confirm credentials are picked up:
devloop sheets help
# Try an upsert without project.json — should ELICIT, not crash:
devloop sheets upsert UserStory '{"id":"US-001","status":"in-progress","workflow_type":"feature"}'
```

The second command should print:

```
Project Sheet config is missing at /tmp/devloop-walkthrough/project/.devloop/project.json.
Existing Sheet ID, or create new? (recommended: create new via project-workflow)
```

…and exit with code 2. That's the agent doing the right thing — refusing to invent a Sheet ID.

To do a real end-to-end smoke without the full `project-workflow`, manually create `project.json`:

```bash
mkdir -p .devloop
cat > .devloop/project.json <<'EOF'
{
  "project_name": "walkthrough-smoke",
  "sheet_id": "REPLACE_WITH_REAL_SHEET_ID",
  "sheet_template_version": 1,
  "drive_folder_id": "REPLACE_WITH_FOLDER_ID",
  "created_at": "2026-05-02T12:00:00Z",
  "created_by": "you@example.com"
}
EOF
```

Replace `REPLACE_WITH_REAL_SHEET_ID` with a freshly-created Sheet's ID (create one in the `devloop-projects` folder via the Drive UI, copy the ID from the URL — `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`). Add a tab named `UserStory` with at least these header columns in row 1:

```
id  as_a  i_want  so_that  acceptance_criteria  priority  assigned_to  parent_story  elaborated_from  workflow_type  branch  commit_shas  design_doc_path  pr_url  pr_state  merged_sha  merged_at  started_at  completed_at  status  created_at
```

Add an `Audit` tab with headers:

```
event_id  event_type  entity_id  actor  timestamp  payload_json
```

Then test upsert:

```bash
devloop sheets upsert UserStory '{"id":"US-001","status":"in-progress","workflow_type":"feature"}'
```

Expected:

```
upserted UserStory/US-001 (cols: id, status, workflow_type)
```

Open the Sheet in Drive — `UserStory` tab has the row, `Audit` tab has a row with your git email as `actor`. Loop confirmed.

> When you run **T4.6** (full `project-workflow`) for real, the agent creates the Sheet and tabs FOR you. The manual setup above is only for the smoke test, or for tests like T5.1 that need a pre-existing Sheet.

## Optional — revocable test Sheet for resilience tests (T5.1, T5.3)

T5.1 and T5.3 need a Sheet that you can temporarily make unreachable to the service account. Two ways:

- **Toggle the share.** Open the Sheet → Share → remove the service-account email → run the test → re-add Editor.
- **Toggle the network.** Disconnect Wi-Fi / disable network for the duration of the test. Simpler if you trust nothing else in your shell needs the network.

Either is fine. The first is cleaner for parallel work.

## Security notes

- **Never commit `~/.config/devloop/credentials.json`.** Add `~/.config/devloop/` to your global `.gitignore` if you're paranoid; the path is outside any project repo by default.
- **Rotate the key quarterly.** Cloud Console → service account → Keys → **Add Key** (new), then **Delete** the old one. Devloop only reads the file at process start, so re-running the CLI picks up the new key.
- **Scope the service account narrowly.** It does NOT need project-level IAM roles. The Sheets API and Drive API only let it touch resources explicitly shared with it.
- **One service account per team is fine for v0.1.** Per-developer OAuth lands in v0.2 (see the plan doc); until then, every dev's Sheet writes are signed by the same service account, and `actor` attribution comes from `git config user.email`.

## Troubleshooting

| Symptom                                                                   | Fix                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credentials_missing: file not found at <path>`                           | Re-check Step 4 path. Run `ls -l ~/.config/devloop/credentials.json`. If `DEVLOOP_GOOGLE_CREDENTIALS` is set, that wins over the default path — `echo $DEVLOOP_GOOGLE_CREDENTIALS`. |
| `credentials_missing: type must be 'service_account'`                     | You downloaded an OAuth client, not a service-account key. Step 4: must be from the **service account's Keys tab**, not from "OAuth 2.0 Client IDs".                                |
| `403 The caller does not have permission` on Sheet writes                 | The Sheet (or its Drive folder) is not shared with the service account. Step 6: paste the exact service-account email, role Editor.                                                 |
| `403 Google Drive API has not been used in project ... or it is disabled` | Step 2: enable both APIs in the **same project** that owns the service account.                                                                                                     |
| `400 Unable to parse range: UserStory!A:Z`                                | The Sheet has no tab named `UserStory`. Step 7: create the tab and headers, or run `project-workflow` which creates the full canonical layout (6 tabs) automatically.               |
| `claude: command not found`                                               | Optional `gcloud` and Cloud Console links are URLs only; no `claude` CLI is needed for setup. The `claude` CLI is needed only for `T1.2 plugin validate`.                           |
| Service-account email doesn't appear when sharing in Drive                | Domain admin in Workspace may restrict external sharing. Try a personal Google account, or ask your admin to allow service-account access to the target folder.                     |
| `Sheet template version mismatch`                                         | Future-proofing for v0.x — irrelevant in v0.1.                                                                                                                                      |

## When you're done

Tick these off in the walkthrough log (`/tmp/devloop-walkthrough/WALKTHROUGH.md`):

- [ ] Cloud project + Sheets API + Drive API enabled
- [ ] Service account created
- [ ] JSON key at `~/.config/devloop/credentials.json` (mode 0600)
- [ ] Drive folder created and shared with service account (Editor)
- [ ] Smoke test in Step 7 succeeded — `upserted UserStory/US-001` printed; row visible in the Sheet
- [ ] Folder ID copied (paste it when the agent asks during `project-workflow.intent`)

After this, every test that needs a real Sheet is unblocked — T2.21a, T2.22, T3.6–T3.8, T4.6, T4.7, all of T5.

---

## Path C — automated via gcloud

If you have the `gcloud` CLI installed and have permission to create Google Cloud projects, the script `scripts/gcloud-setup.sh` (alongside this doc) automates Steps 1–4 in ~30 seconds. Steps 5–6 differ by account type — see "After gcloud setup — branch by account type" below.

### **Important — service account Drive quota constraint**

Google service accounts have **zero Drive storage quota**. They cannot own files. Files have to live under a host with quota:

- **Personal Google account** (`@gmail.com`): the user creates the Sheet in their own Drive (uses the user's quota), shares with the SA as Editor; agent populates structure.
- **Workspace account** (`@<your-domain>`): use a **Shared Drive** (org-owned, no individual quota); SA gets Content Manager role; agent creates Sheet inside via Drive API.

The `gcloud-setup.sh` script detects your account type from the active gcloud account and prints the right next-step instructions in its summary.

### Prerequisites for Path C

- `gcloud --version` succeeds (install: https://cloud.google.com/sdk/docs/install).
- One-time auth: `gcloud auth login` (opens a browser, sign in, close the tab).
- Your Google account can create Cloud projects. Workspace admins sometimes restrict — if so, fall back to Path A or B.

### Run it

```bash
# One-time, only if you've never authed gcloud:
gcloud auth login

# Provision project + APIs + service account + key in one shot:
~/.claude/plugins/cache/devloop-marketplace/devloop/<version>/skills/sheets-sync/scripts/gcloud-setup.sh
```

The script:

1. Verifies `gcloud auth list` shows an active account.
2. Creates Cloud project `devloop-sheets-<UTC-timestamp>` (timestamped → re-runs never collide).
3. Sets the new project as the active gcloud project.
4. Enables Sheets API + Drive API in that project.
5. Creates service account `devloop-sheets@<project>.iam.gserviceaccount.com`.
6. Generates a JSON key, writes it to `~/.config/devloop/credentials.json`, `chmod 600`.
7. Prints a summary (project ID, service-account email, key path).

If a key already exists at the destination, it's backed up with `.bak.<timestamp>` — never silently overwritten.

### Reuse an existing project (avoid sprawl)

Every fresh `gcloud-setup.sh` run creates a new project + SA. To avoid that, **the agent should DISCOVER existing devloop infrastructure first** before deciding whether to create new:

```bash
# List existing devloop-sheets projects (most recent 5):
gcloud projects list --filter="projectId:devloop-sheets-*" \
  --format="value(projectId,createTime)" | head -5

# For each found project, list its devloop-sheets service accounts:
gcloud iam service-accounts list --project=<id> \
  --filter="email:devloop-sheets@*" --format="value(email)"
```

Branch:

- **0 projects found** → fresh setup. Run script with no flags.
- **1 project found** → reuse it. Run script with `--project-id <id>`. The SA is preserved, only the JSON key is regenerated (existing key backed up to `.bak.<ts>`).
- **2+ projects found** → ask the user which to reuse, or create new.

Manual reuse:

```bash
gcloud-setup.sh --project-id my-existing-project
```

Idempotent: skips project creation if the project exists, skips SA creation if the SA exists, regenerates only the JSON key.

### After gcloud setup — branch by account type

After `gcloud-setup.sh` finishes, you have working credentials at `~/.config/devloop/credentials.json` and a service-account email like `devloop-sheets@<project>.iam.gserviceaccount.com`. The next step depends on your Google account type — `gcloud-setup.sh` detects it and prints the right instructions, but here's both paths:

#### Personal Google account (gmail.com)

Service account cannot create the Sheet itself. **You** create a blank Sheet, share with the SA, then the agent populates it.

```
1. Open https://sheets.new (or Drive UI → New → Google Sheets → blank).
2. Name it whatever you want (e.g., your project name).
3. Share → add devloop-sheets@<project>.iam.gserviceaccount.com as Editor.
4. Copy the Sheet ID from the URL: docs.google.com/spreadsheets/d/<SHEET_ID>/edit
5. Run:
     devloop sheets create-project --name "<project>" --sheet-id "<SHEET_ID>"
```

The CLI adds the 6 canonical tabs (only those missing — idempotent) and writes headers. `.devloop/project.json` is committed with the Sheet ID.

#### Workspace account (custom domain)

Recommended path: Shared Drive. SA can create files there (no quota issues — Shared Drives are org-owned).

```
1. Open Drive → Shared drives → New (or pick an existing one your team uses).
2. Add the SA email as Content manager.
3. Copy the Shared Drive ID from the URL.
4. Run:
     devloop sheets create-project --name "<project>" --folder-id "<SHARED_DRIVE_ID>"
```

The agent creates the Sheet via Drive API with `parents: [SHARED_DRIVE_ID]` and `supportsAllDrives: true`, adds the 6 tabs, writes headers, commits `.devloop/project.json`.

Alternative (no Shared Drive): user-owned folder shared with SA as Editor. Pass `--folder-id <FOLDER_ID>`. Whether file-creation succeeds depends on org policy; if it fails, fall back to the personal-account flow (`--sheet-id`).

### When Path C fails

| Error                                       | Likely cause                               | Fix                                                                              |
| ------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| `Permission denied to create projects`      | Workspace admin restriction                | Ask admin, or use Path A/B with a personal Google account                        |
| `Quota exceeded for projects`               | Default Google quota is 12 active projects | Delete an unused project (`gcloud projects delete <id>`) or request a quota bump |
| `Service [sheets.googleapis.com] not found` | Rare; transient API-listing lag            | Re-run after 30s                                                                 |
| `gcloud not found`                          | CLI not installed                          | Install gcloud, OR fall back to Path A/B                                         |
| `no active gcloud account`                  | First-time use                             | Run `gcloud auth login`, then re-run the script                                  |
