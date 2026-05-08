# Changelog — sheets-sync skill

## [0.2.0] — 2026-05-02

Third persistence backend + OAuth fixes.

### Added — local_xlsx persistence mode (B8)

- New `auth_mode: "local_xlsx"` in `ProjectConfig`. Runs the entire workflow against a local `.xlsx` file with no Google access required.
- `LocalXlsxClient` implements `SheetsClient` against a file via exceljs.
- `createLocalXlsxProject` builds a fresh workbook with all six canonical tabs + safety columns.
- Atomic writes via `<file>.tmp` + fsync + rename — same crash-safety as Google.
- `makeSheetsClient(authClient)` factory in `client.ts` picks the right backend.

### Added — push-to-google / pull-from-google bridges (B9)

- `sheets push-to-google` migrates `local_xlsx` → Google Sheet atomically; updates `project.json::auth_mode` unless `--keep-local`.
- `sheets pull-from-google` exports Google Sheet → local `.xlsx`; `--switch-mode` flips the project to offline.
- Migration policy: planning columns transfer 1:1; system-managed columns (`_rev`, `archived_at`, `archived_by`) are destination-managed.

### Added — OAuth fixes (B7)

- `oauth-user-setup.sh` now passes the canonical 5-scope set (openid + userinfo.email + cloud-platform + spreadsheets + drive) + supports `--client-id-file` for project-owned clients.
- New `oauth-user-project-client-setup.sh` automates ~80 % of the personal-Gmail unverified-app recovery flow.
- `auth-check` includes a live scope probe — distinguishes `✓ Resolved` from `✗ INCOMPLETE`.

## [0.1.7] — 2026-05-02

### Added — OAuth user-acting auth (coexists with service_account)

- **`AuthClient` discriminated union** in `lib/sheets/auth.ts` — `kind: "service_account" | "oauth_user"`. Both first-class, neither default.
- **`loadAuthClient(opts)`** resolves the right auth mode: explicit `mode` flag → ProjectConfig.auth_mode → auto-detect (SA wins if both files present).
- **OAuth via Application Default Credentials** — agent acts as the user (their Drive quota, their file ownership). One-time setup: `gcloud auth application-default login`.
- **`scripts/oauth-user-setup.sh`** — wraps the gcloud command + verification.
- **`devloop sheets create-project --auth-mode {service_account|oauth_user}`** flag. `oauth_user` makes `--folder-id` optional (Sheet lands in user's Drive root by default).
- **`devloop sheets auth-check`** — diagnostic showing which mode resolves, which credentials are present, and the resolved identity.
- **Cross-platform ADC path detection** — POSIX (`~/.config/gcloud/...`) + Windows (`%APPDATA%/gcloud/...`).
- **14 new vitest tests** in `tests/sheets-auth.test.ts` covering both modes' resolution, env override, missing-credentials errors, auto-detect priority.

### Changed

- **`createProjectSheet`** accepts `authMode` hint. For `oauth_user`, `driveFolderId` is optional (file lands in user's Drive root). For `service_account`, still required (zero quota).
- **`GoogleSheetsClient`** constructor now accepts `JWT | OAuth2Client | GoogleAuth` (previously JWT-only).
- **`bootstrapExistingSheet`** accepts the same broadened auth type.
- **`google-sheets-setup.md`** restructured: top-level "Pick your auth mode FIRST" section, then Path D for `oauth_user`, then Steps 1–7 + Path C for `service_account`.

### Why

Dogfood testing exposed that service accounts on personal Google accounts cannot create Drive files (zero quota). OAuth user-acting auth is the canonical workaround — but it's NOT a replacement. Both modes are valid for different use cases:

- `service_account`: shared team identity, Workspace + Shared Drive teams, CI/unattended.
- `oauth_user`: personal accounts, single-developer projects, "I want to own the files".

The skill asks the user which to use; never picks silently. A user can have project A on `service_account` and project B on `oauth_user` on the same machine — both work in parallel.

### Versions

- contract.json bumped 0.1.6 → 0.1.7.

## [0.1.6] — 2026-05-02

### Added

- **`devloop sheets sync-draft <draft.json>` CLI subcommand** — batch-upsert rows from a local JSON draft. Replaces 13+ per-row `devloop sheets upsert` Bash calls with 1 Write + 1 Bash. Massive token savings in `discover` and `decompose` phases.
- Draft JSON schema:
  ```json
  {
    "BusinessGoal": [{...row...}, ...],
    "Requirement":  [{...row...}, ...],
    "UserStory":    [{...row...}, ...]
  }
  ```
- Per-row outcome reporting (written / no-op / failed). On any failure: draft left intact, exit code 2, failed indices listed. Re-run after editing.
- `--dry-run` flag validates the draft without writing.

### Fixed

- **`gcloud-setup.sh` bash 3 incompatibility** on macOS. `${VAR,,}` is bash 4+ only; replaced with `tr '[:upper:]' '[:lower:]'`. Provisioning was already working; only the summary block crashed.

### Why

In dogfood testing the agent issued 4+ separate Bash calls to upsert Goals + Requirements one-by-one — each call ~500 tokens of CLI args/output. Projected to ~11,500 tokens for a full discover sync. New `sync-draft` reduces to ~2,000 tokens (one Write of the JSON draft + one Bash call). Plus the user can edit the local draft directly and ask for a re-sync, instead of redoing the conversation.

### Versions

- contract.json bumped 0.1.5 → 0.1.6.

## [0.1.5] — 2026-05-02

### Changed

- **`gcloud-setup.sh` now lists existing `devloop-sheets-*` projects** before creating a new one. If any are found, prints them with a hint to pass `--project-id <id>` to reuse instead of sprawling.
- **`google-sheets-setup.md` Path C** documents the discovery pattern: `gcloud projects list --filter="projectId:devloop-sheets-*"` first, branch on count (0 → new, 1 → reuse, 2+ → ask).

### Why

In dogfood testing, every Path C run created a new `devloop-sheets-<timestamp>` project + SA. Defaulting to fresh-each-time is wasteful (Google's per-account project quota is 12 active) and confusing for users debugging across runs. The agent should discover-then-decide, with reuse as the default when exactly one match exists.

### Versions

- contract.json bumped 0.1.4 → 0.1.5.

## [0.1.4] — 2026-05-02

### Changed

- **`createProjectSheet` now uses the Drive API** (`drive.files.create` with `parents: [folderId]` and `supportsAllDrives: true`) instead of the Sheets API. This is required because service accounts have zero Drive quota — `sheets.spreadsheets.create()` always created in the SA's own root, which fails with `storageQuotaExceeded`. The Drive-API path puts the Sheet under a host with quota (Workspace Shared Drive, or user-owned folder shared with SA).
- **`createProjectSheet` now requires `driveFolderId`.** Previously optional → defaulted to SA root → broken. Pass either a Shared Drive ID (Workspace) or a user-shared folder ID (Personal account, when SA is Editor on the folder).
- **`devloop sheets create-project` CLI now requires exactly one of `--folder-id` or `--sheet-id`.** `--sheet-id` is the new "attach to existing user-created Sheet" path for Personal accounts.

### Added

- **`bootstrapExistingSheet(sheetId, auth)`** — populates 6 canonical tabs + headers into a Sheet the user created. Idempotent: only adds missing tabs, overwrites row 1 headers. Used when the SA cannot create the Sheet itself (Personal accounts).
- **`lib/sheets/account-type.ts`** — `detectAccountType(email)` returns `"personal" | "workspace"` based on the email domain. Used by the agent's elicitation flow to branch correctly.
- **`gcloud-setup.sh` now detects and prints account type** in its summary, with personal-vs-Workspace next-step instructions.
- **`google-sheets-setup.md` Path C section split** into Personal Google account and Workspace account subsections, with the canonical commands for each.

### Why

In dogfood testing, Path C provisioned credentials successfully but then `devloop sheets create-project` failed with `403 caller does not have permission` followed by `storageQuotaExceeded`. The agent diagnosed the actual issue: SAs on personal Google accounts have zero Drive quota and cannot create files anywhere — including in folders shared TO them. Web research confirmed: SAs created after April 2025 have severely restricted "My Drive" access; the canonical patterns are (a) Workspace + Shared Drive, or (b) user-created Sheet + SA as Editor. This release implements both.

### Versions

- contract.json bumped 0.1.3 → 0.1.4.

## [0.1.3] — 2026-05-02

### Added

- `devloop sheets create-project --name "<X>" [--folder-id "<Y>"]` CLI subcommand. Wraps `lib/sheets/bootstrap.ts::createProjectSheet`, creates the Sheet with all 6 tabs, AND writes `.devloop/project.json` with `project_name`, `sheet_id`, `sheet_template_version: 1`, `drive_folder_id?`, `created_at`, `created_by` (git email). Refuses to overwrite an existing project.json with a sheet_id.

### Why

The agent had no way to invoke `createProjectSheet` from a Claude Code session — `lib/sheets/bootstrap.ts` was a TypeScript function, not a CLI surface. Surfaced in dogfood testing when project-workflow.intent finished elicitation but couldn't progress to Sheet creation. The new CLI closes that gap.

### Versions

- contract.json bumped 0.1.2 → 0.1.3.

## [0.1.2] — 2026-05-02

### Added

- `scripts/gcloud-setup.sh` — automated Google Cloud setup. Creates project, enables APIs, makes service account, generates JSON key at `~/.config/devloop/credentials.json` (mode 0600). Idempotent project name (timestamped) and key file (existing key backed up, never silently overwritten). ~30s after the user does `gcloud auth login`.
- `references/google-sheets-setup.md` — added "Path C — automated via gcloud" section at the bottom, plus a 3-path comparison table at the top. Lists prereqs, run command, failure modes, reuse-existing-project flag.

### Why

Path A (self-service Cloud Console) and Path B (agent-guided clicking) are both ~10–15 min of manual work. For devs with `gcloud` installed and project-create permissions, Path C cuts that to ~30 seconds. The same canonical guide doc still owns the manual steps; Path C is an alternative front-end, not a replacement.

### Versions

- contract.json bumped 0.1.1 → 0.1.2.

## [0.1.1] — 2026-05-02

### Added

- `references/google-sheets-setup.md` — one-time Google Cloud + Drive setup guide (service account, JSON key, folder share, verify) for first-time devs. 7 numbered steps, troubleshooting table, security notes.
- CLI elicitation prompts (`lib/sheets/auth.ts`, `lib/sheets/config.ts`) now point at the setup guide so a CLI-only user has a clear next step when credentials or config are missing.
- SKILL.md References section lists the setup guide first.

### Why

A first-time dev hitting `credentials_missing` previously got a one-line "place the key at this path" message with no guidance on how to obtain the key. Now they get a path to a 15-minute walkthrough they can run with or without Claude Code's help.

## [0.1.0] — 2026-05-02

### Added

- Initial skill (P1 of project-workflow + Google Sheets layer).
- contract.json declaring zone discipline (planning vs execution columns), event-to-column mapping, and emitted events for upsert/append/read/queue/reconcile.
- evals/evals.json with 6 failing cases per RED-GREEN-REFACTOR — zone enforcement, idempotency, queue-on-unreachable, missing-config-elicits, audit-row-on-every-write, reconcile-from-manifest.
- references/sheet-template.md documenting the canonical Sheet template (tabs, columns, validation, protected ranges).
- references/event-mapping.md documenting the full event-to-column projection.

### Notes

P1 ships write primitives + auth. Daemon and reconcile command land in P5 per the implementation plan.
