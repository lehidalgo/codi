/**
 * `codi sheets <subcommand>` dispatcher.
 *
 * Subcommands shipped in P1:
 *   upsert <Entity> <jsonRow>  — write or update a row (idempotent)
 *   read   <Entity> <id>        — read a single row
 *   list   <Entity>             — list all rows in the tab
 *
 * Flags:
 *   --bootstrap          — caller scope = bootstrap (allows planning-column writes;
 *                          intended for project-workflow internal use, exposed at the
 *                          CLI for testing convenience)
 *   --json               — machine-readable output
 *   --credentials <path> — override service-account key path
 *
 * Subcommands deferred to P5: daemon, reconcile.
 */

import { execFileSync } from "node:child_process";

import {
  ENTITY_NAMES,
  type EntityName,
  type CallerScope,
  type CellValue,
  type SheetRow,
  SheetsError,
  makeSheetsClient,
  loadAuthClient,
  type AuthMode,
  type AuthClient,
  adcCredentialsPath,
  elicitationPromptForOAuthSetup,
  readProjectConfig,
  tryReadProjectConfig,
  elicitationPromptForMissingConfig,
  elicitationPromptForMissingCredentials,
  upsertRow,
  readRow,
  readAllRowsLenient,
} from "./index.js";
import { enqueue, buildQueueId, type QueuedSync } from "./queue.js";
import { reconcile } from "./reconcile.js";
import { runDaemon } from "./daemon.js";

export interface CliFlags {
  readonly [key: string]: string | boolean | undefined;
}

export async function cmdSheets(positional: ReadonlyArray<string>, flags: CliFlags): Promise<void> {
  const sub = positional[1];
  if (sub === undefined || sub === "help") {
    printHelp();
    return;
  }

  switch (sub) {
    case "upsert":
      await runUpsert(positional, flags);
      return;
    case "read":
      await runRead(positional, flags);
      return;
    case "list":
      await runList(positional, flags);
      return;
    case "create-project": {
      const { runCreateProject } = await import("./cli-create.js");
      await runCreateProject(positional, flags);
      return;
    }
    case "auth-check":
      await runAuthCheck(flags);
      return;
    case "sync-draft": {
      const { runSyncDraft } = await import("./cli-draft.js");
      await runSyncDraft(positional, flags);
      return;
    }
    case "validate": {
      const { runValidate } = await import("./cli-draft.js");
      await runValidate(positional, flags);
      return;
    }
    case "pull":
    case "pull-all": {
      const { runPull } = await import("./cli-draft.js");
      await runPull(positional, flags);
      return;
    }
    case "snapshot":
    case "snapshots": {
      const { runSnapshot } = await import("./cli-draft.js");
      await runSnapshot(positional, flags);
      return;
    }
    case "diff": {
      const { runDiff } = await import("./cli-draft.js");
      await runDiff(positional, flags);
      return;
    }
    case "restore": {
      const { runRestore } = await import("./cli-safety.js");
      await runRestore(positional, flags);
      return;
    }
    case "archive": {
      const { runArchive } = await import("./cli-safety.js");
      await runArchive(positional, flags);
      return;
    }
    case "push-to-google": {
      const { runPushToGoogle } = await import("./cli-bridge.js");
      await runPushToGoogle(positional, flags);
      return;
    }
    case "pull-from-google": {
      const { runPullFromGoogle } = await import("./cli-bridge.js");
      await runPullFromGoogle(positional, flags);
      return;
    }
    case "daemon":
      await runDaemonCli(flags);
      return;
    case "reconcile":
      await runReconcileCli(flags);
      return;
    default:
      console.error(`unknown subcommand: sheets ${sub}`);
      printHelp();
      process.exit(1);
  }
}

// ─── upsert ──────────────────────────────────────────────────────────────────

async function runUpsert(positional: ReadonlyArray<string>, flags: CliFlags): Promise<void> {
  const entity = parseEntity(positional[2]);
  const jsonArg = positional[3];
  if (!jsonArg) {
    fail(`codi sheets upsert <Entity> <json> — missing json payload`);
  }
  const row = parseJsonObject(jsonArg, "row payload");
  const caller: CallerScope = flags["bootstrap"] === true ? "bootstrap" : "execution-only";

  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);
  const actor = readGitActor();

  try {
    const result = await upsertRow(entity, row, { caller, client, config, actor });

    if (flags["json"] === true) {
      console.log(JSON.stringify(result));
    } else if (result.was_no_op) {
      console.log(`no-op: ${entity}/${result.row_id} already matches (no diff)`);
    } else {
      const cols = result.columns_written.join(", ") || "(new)";
      console.log(`upserted ${entity}/${result.row_id} (cols: ${cols})`);
    }
  } catch (e) {
    if (e instanceof SheetsError && e.code === "sheet_unreachable") {
      const queueRecord: QueuedSync = {
        queue_id: buildQueueId(entity, row),
        enqueued_at: new Date().toISOString(),
        attempts: 0,
        entity,
        row,
        caller,
        actor,
      };
      enqueue(cwd, queueRecord);
      const target =
        typeof row["id"] === "string" ? `${entity}/${row["id"] as string}` : `${entity}/<new>`;
      if (flags["json"] === true) {
        console.log(JSON.stringify({ status: "queued", queue_id: queueRecord.queue_id }));
      } else {
        console.log(
          `queued: ${target} (Sheet unreachable; daemon will retry). queue_id=${queueRecord.queue_id}`,
        );
      }
      return;
    }
    throw e;
  }
}

// ─── read ────────────────────────────────────────────────────────────────────

async function runRead(positional: ReadonlyArray<string>, flags: CliFlags): Promise<void> {
  const entity = parseEntity(positional[2]);
  const id = positional[3];
  if (!id) fail(`codi sheets read <Entity> <id> — missing id`);

  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);

  const row = await readRow(entity, id, { client, config });
  if (row === null) {
    if (flags["json"] === true) console.log("null");
    else console.log(`${entity}/${id}: not found`);
    process.exit(2);
    return;
  }
  console.log(JSON.stringify(row, null, flags["json"] === true ? 0 : 2));
}

// ─── list ────────────────────────────────────────────────────────────────────

async function runList(positional: ReadonlyArray<string>, flags: CliFlags): Promise<void> {
  const entity = parseEntity(positional[2]);

  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);

  // List uses lenient read so malformed rows are SHOWN (so the user can fix
  // them), not hidden behind a thrown SheetsError. D6 fix from T4.6 audit.
  const rows = await readAllRowsLenient(entity, { client, config });
  if (flags["json"] === true) {
    console.log(JSON.stringify(rows));
    return;
  }
  if (rows.length === 0) {
    console.log(`${entity}: 0 rows`);
    return;
  }
  for (const r of rows) {
    const id = String(r["id"] ?? "?");
    const label = String(r["title"] ?? r["i_want"] ?? "");
    const archived =
      r["archived_at"] !== undefined && r["archived_at"] !== null && r["archived_at"] !== ""
        ? "  [archived]"
        : "";
    console.log(`${id}\t${label}${archived}`);
  }
}

// create-project handler lives in ./cli-create.ts (split for the 700-LOC cap).
// sync-draft + validate live in ./cli-draft.ts.

export type CoerceResult = { kind: "ok"; row: SheetRow } | { kind: "error"; message: string };

export function coerceJsonObjectToSheetRow(raw: Record<string, unknown>): CoerceResult {
  const out: Record<string, CellValue | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      return {
        kind: "error",
        message: `column '${k}' must be string, number, boolean, or null (got ${typeof v})`,
      };
    }
  }
  return { kind: "ok", row: out };
}

// ─── auth-check ──────────────────────────────────────────────────────────────

async function runAuthCheck(flags: CliFlags): Promise<void> {
  const cwd = process.cwd();
  const cfg = tryReadProjectConfig(cwd);
  const cfgMode = cfg?.auth_mode;
  const skipProbe = flags["no-probe"] === true;

  // Probe both backends without throwing.
  const fs = await import("node:fs");
  const saPath =
    process.env["CODI_GOOGLE_CREDENTIALS"] ??
    `${process.env["HOME"] ?? ""}/.config/codi/credentials.json`;
  const adcPath = adcCredentialsPath();
  const saPresent = fs.existsSync(saPath);
  const adcPresent = fs.existsSync(adcPath);

  let resolvedKind: AuthMode | "none" = "none";
  let resolvedIdentity = "(unresolved)";
  try {
    const c = await loadAuthClientOrElicit({ ...(cfgMode !== undefined ? { mode: cfgMode } : {}) });
    resolvedKind = c.kind;
    resolvedIdentity = c.identity;
  } catch {
    // ignore — show what's missing
  }

  // Scope probe — only meaningful for oauth_user mode (B7 fix for L2).
  // The ADC file does NOT carry granted-scopes; the only reliable check is a
  // live HTTP call against a Sheets endpoint.
  let scopeProbe: { outcome: string; http_status?: number; details?: string } | undefined;
  if (!skipProbe && resolvedKind === "oauth_user") {
    const { probeOAuthUserScopes } = await import("./auth.js");
    const result = await probeOAuthUserScopes();
    scopeProbe = { outcome: result.outcome };
    if (result.http_status !== undefined) scopeProbe.http_status = result.http_status;
    if (result.details !== undefined) scopeProbe.details = result.details;
  }

  if (flags["json"] === true) {
    console.log(
      JSON.stringify({
        project_config_auth_mode: cfgMode ?? null,
        service_account_path: saPath,
        service_account_present: saPresent,
        adc_path: adcPath,
        adc_present: adcPresent,
        resolved_mode: resolvedKind,
        resolved_identity: resolvedIdentity,
        scope_probe: scopeProbe ?? null,
      }),
    );
    return;
  }

  console.log(`codi sheets auth-check`);
  console.log(
    `  project.json::auth_mode:    ${cfgMode ?? "(unset → defaults to service_account)"}`,
  );
  console.log(`  service-account JSON path:  ${saPath}  ${saPresent ? "✓" : "(missing)"}`);
  console.log(
    `  ADC path (oauth_user):      ${adcPath}  ${adcPresent ? "✓" : "(missing — run: gcloud auth application-default login)"}`,
  );
  console.log(``);
  if (resolvedKind === "none") {
    console.log(`  ✗ Resolved: NONE — neither auth file present (or load failed). Configure one.`);
    return;
  }

  // For oauth_user, scope probe outcome decides ✓ vs ✗ INCOMPLETE.
  if (scopeProbe !== undefined) {
    if (scopeProbe.outcome === "ok") {
      console.log(`  ✓ Resolved: ${resolvedKind} (${resolvedIdentity})`);
      console.log(`    Scope probe: OK (HTTP ${scopeProbe.http_status})`);
    } else if (scopeProbe.outcome === "insufficient_scopes") {
      console.log(`  ✗ INCOMPLETE: ${resolvedKind} (${resolvedIdentity})`);
      console.log(`    ADC present but lacks Sheets/Drive scopes.`);
      console.log(`    Recovery:`);
      console.log(`      bash <plugin-root>/skills/sheets-sync/scripts/oauth-user-setup.sh`);
      console.log(`    On personal Gmail (unverified-app block):`);
      console.log(
        `      bash <plugin-root>/skills/sheets-sync/scripts/oauth-user-project-client-setup.sh`,
      );
    } else if (scopeProbe.outcome === "transport_error") {
      console.log(`  ⚠ Resolved: ${resolvedKind} (${resolvedIdentity})`);
      console.log(
        `    Scope probe: transport error (${scopeProbe.details ?? "?"}). Auth may still work.`,
      );
    } else {
      console.log(`  ⚠ Resolved: ${resolvedKind} (${resolvedIdentity})`);
      console.log(
        `    Scope probe: ${scopeProbe.outcome} (HTTP ${scopeProbe.http_status ?? "?"}).`,
      );
    }
  } else {
    console.log(`  ✓ Resolved: ${resolvedKind} (${resolvedIdentity})`);
    if (resolvedKind === "oauth_user" && skipProbe) {
      console.log(`    (--no-probe; scope verification skipped)`);
    }
  }
}

// ─── reconcile ───────────────────────────────────────────────────────────────

async function runReconcileCli(flags: CliFlags): Promise<void> {
  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);
  const actor = readGitActor();

  const result = await reconcile({ cwd, client, config, actor });

  if (flags["json"] === true) {
    console.log(JSON.stringify(result));
  } else {
    console.log(
      `reconciled ${result.rows_reconciled} row(s) (${result.rows_no_op} no-op) in ${result.duration_ms}ms`,
    );
  }
}

// ─── daemon ──────────────────────────────────────────────────────────────────

async function runDaemonCli(flags: CliFlags): Promise<void> {
  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);

  const interval =
    typeof flags["interval"] === "string" ? Number.parseInt(flags["interval"], 10) : undefined;
  const maxAttempts =
    typeof flags["max-attempts"] === "string"
      ? Number.parseInt(flags["max-attempts"], 10)
      : undefined;
  const once = flags["once"] === true;

  await runDaemon({
    cwd,
    client,
    config,
    once,
    ...(interval !== undefined && Number.isFinite(interval) ? { intervalMs: interval } : {}),
    ...(maxAttempts !== undefined && Number.isFinite(maxAttempts) ? { maxAttempts } : {}),
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseEntity(input: string | undefined): EntityName {
  if (!input) fail(`expected one of: ${ENTITY_NAMES.join(", ")}`);
  const isEntity = (ENTITY_NAMES as ReadonlyArray<string>).includes(input);
  if (!isEntity) {
    fail(`unknown entity '${input}'. expected one of: ${ENTITY_NAMES.join(", ")}`);
  }
  return input as EntityName;
}

function parseJsonObject(raw: string, what: string): SheetRow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`${what} is not valid JSON: ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(`${what} must be a JSON object`);
  }
  const out: Record<string, CellValue | undefined> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      fail(`${what}: column '${k}' must be string, number, boolean, or null (got ${typeof v})`);
    }
  }
  return out;
}

export function readConfigOrElicit(cwd: string) {
  try {
    return readProjectConfig(cwd);
  } catch (e) {
    if (e instanceof SheetsError && e.code === "config_missing") {
      console.error(elicitationPromptForMissingConfig(cwd));
      process.exit(2);
    }
    throw e;
  }
}

interface AuthClientResolveOptions {
  /** Force a specific mode. */
  mode?: AuthMode;
  /** Override SA credentials path. */
  saCredentialsPath?: string;
}

/** Resolve the auth client honoring (in order): explicit mode, ProjectConfig.auth_mode, auto-detect.
 *  Surfaces the right elicitation prompt for whichever mode is missing. */
export async function loadAuthClientOrElicit(
  opts: AuthClientResolveOptions = {},
): Promise<AuthClient> {
  // If mode wasn't explicitly forced, try to read it from project.json.
  let resolvedMode = opts.mode;
  let resolvedLocalPath: string | undefined;
  if (resolvedMode === undefined) {
    const cfg = tryReadProjectConfig(process.cwd());
    if (
      cfg?.auth_mode === "oauth_user" ||
      cfg?.auth_mode === "service_account" ||
      cfg?.auth_mode === "local_xlsx"
    ) {
      resolvedMode = cfg.auth_mode;
      if (cfg.auth_mode === "local_xlsx" && cfg.local_path !== undefined) {
        resolvedLocalPath = cfg.local_path;
      }
    }
  }
  try {
    return await loadAuthClient({
      ...(resolvedMode !== undefined ? { mode: resolvedMode } : {}),
      ...(resolvedLocalPath !== undefined ? { localPath: resolvedLocalPath } : {}),
      ...(opts.saCredentialsPath !== undefined
        ? { saCredentialsPath: opts.saCredentialsPath }
        : {}),
    });
  } catch (e) {
    if (e instanceof SheetsError && e.code === "credentials_missing") {
      // Surface mode-specific prompt
      if (resolvedMode === "oauth_user") {
        console.error(elicitationPromptForOAuthSetup());
      } else {
        console.error(elicitationPromptForMissingCredentials());
      }
      process.exit(2);
    }
    throw e;
  }
}

export function readGitActor(): string {
  try {
    const out = execFileSync("git", ["config", "user.email"], { encoding: "utf8" }).trim();
    if (out.length > 0) return out;
  } catch {
    /* fallthrough */
  }
  return "unknown@local";
}

export function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function printHelp(): void {
  console.log(`codi sheets — Google Sheet persistence for the project layer

Subcommands:
  create-project --name "X" (--folder-id "Y" | --sheet-id "Y")
                              create a new project Sheet (6 tabs, headers) +
                              write .codi/project.json with the sheet_id
  sync-draft <draft.json>     batch-upsert rows from a local JSON draft.
                              Auto-runs 'validate' first; aborts on integrity
                              errors before any Sheet API call. Use this in
                              discover/decompose — far cheaper in tokens than
                              per-row "upsert" calls.
  validate <draft.json>       run integrity checks on a draft without writing.
                              Catches shape, dup-IDs, orphan refs, missing
                              required fields. Default cross-checks against
                              the current Sheet; --local skips that.
  pull <Entity>               read one tab to JSON (stdout or --into file).
  pull-all                    read every entity tab to a draft envelope.
                              Use BEFORE editing so the draft is a delta
                              against current Sheet truth (patch model).
  diff <draft.json>           insert/update/no-op/archive preview vs current
                              Sheet. --columns to list every changed cell.
  snapshot                    capture all tabs to .codi/snapshots/.
                              --label <name>, --list, --prune <keep>.
  restore --from <snap>       replay a snapshot back onto the Sheet. Use
                              after a bad sync. --latest picks newest. --only
                              "BG,REQ" restricts to specific tabs.
  archive <Entity> <id>       soft-delete a row (status=abandoned + archived_at
                              + archived_by). Restorable via restore --latest.
  push-to-google              upload local .xlsx contents to a Google Sheet
                              (atomic, snapshot-first). Updates project.json
                              to swap auth_mode unless --keep-local.
  pull-from-google            download Google Sheet contents to a local .xlsx
                              for offline editing. --switch-mode to flip
                              project.json::auth_mode to local_xlsx.
  upsert <Entity> <jsonRow>   write or update a single row (idempotent; queues
                              on Sheet unreachable). Prefer sync-draft for
                              batches.
  read   <Entity> <id>        read a single row
  list   <Entity>             list all rows in the tab
  auth-check                  show which auth mode resolves + which credentials
                              are present (service_account vs oauth_user)
  daemon                      drain the queue; foreground polling loop
  reconcile                   rebuild execution columns from the manifest

Entities: ${ENTITY_NAMES.join(", ")}

Common flags:
  --bootstrap                 caller scope = bootstrap (allows planning columns)
  --json                      machine-readable output
  --credentials <path>        override service-account key path

create-project flags:
  --name <project_name>       required: human-readable name (used as Sheet title)
  --auth-mode <mode>          'service_account' (default) | 'oauth_user'
                              service_account: agent acts as SA. Requires
                                --folder-id OR --sheet-id (SA has zero quota).
                              oauth_user: agent acts as the user via ADC.
                                Folder optional (lands in user's Drive root).
                                Requires 'gcloud auth application-default login'.
  --folder-id <id>            create new Sheet in folder (Shared Drive OR
                              user-owned folder; required for service_account)
  --sheet-id <id>             attach to existing Sheet (Personal accounts: user
                              creates blank Sheet, shares with SA, passes id)

Daemon flags:
  --once                      run a single drain pass and exit
  --interval <ms>             polling interval (default 10000)
  --max-attempts <n>          retry budget per record (default 5)
`);
}
