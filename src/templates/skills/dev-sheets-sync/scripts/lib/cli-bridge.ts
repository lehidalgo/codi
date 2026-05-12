/**
 * Cross-backend bridges:
 *   - push-to-google   local .xlsx → Google Sheet (atomic, snapshot-first)
 *   - pull-from-google Google Sheet → local .xlsx
 *
 * Both flows are read-then-write across SheetsClient instances. The atomic
 * guarantee (snapshot before write, rollback on failure) is delegated to
 * `atomicSyncDraft` — it works against any SheetsClient, so there's no
 * google-vs-local-specific atomicity code here.
 */

import { existsSync } from "node:fs";

import {
  ENTITY_NAMES,
  type ProjectConfig,
  bootstrapExistingSheet,
  createProjectSheet,
  createLocalXlsxProject,
  LocalXlsxClient,
  makeSheetsClient,
  transferSheetData,
  tryReadProjectConfig,
  writeProjectConfig,
} from "./index.js";

import { type CliFlags, fail, loadAuthClientOrElicit, readGitActor } from "./cli.js";

// ─── push-to-google ──────────────────────────────────────────────────────────

export async function runPushToGoogle(
  _positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const cwd = process.cwd();
  const config = tryReadProjectConfig(cwd);
  if (!config) {
    fail(`No .codi/project.json. Bootstrap a project first.`);
  }
  if (config.auth_mode !== "local_xlsx") {
    fail(
      `push-to-google requires the project to be in local_xlsx mode (current: ${config.auth_mode ?? "service_account"}).\n` +
        `If you want to migrate FROM Google Sheets, use 'pull-from-google' first.`,
    );
  }
  const localPath = config.local_path;
  if (!localPath || !existsSync(localPath)) {
    fail(`local .xlsx file not found at ${localPath ?? "(unset)"}.`);
  }

  const sheetId = typeof flags["sheet-id"] === "string" ? flags["sheet-id"] : undefined;
  const folderId = typeof flags["folder-id"] === "string" ? flags["folder-id"] : undefined;
  const toAuthFlag = typeof flags["to-auth-mode"] === "string" ? flags["to-auth-mode"] : undefined;
  if (toAuthFlag !== undefined && toAuthFlag !== "service_account" && toAuthFlag !== "oauth_user") {
    fail(`--to-auth-mode must be 'service_account' or 'oauth_user' (got '${toAuthFlag}')`);
  }
  const force = flags["force"] === true;
  const keepLocal = flags["keep-local"] === true;

  if (!sheetId && !folderId && toAuthFlag !== "oauth_user") {
    fail(
      `push-to-google needs a target. Pass one of:\n` +
        `  --sheet-id "<id>"            push into an existing Google Sheet\n` +
        `  --folder-id "<id>"           create a new Sheet in this Drive folder\n` +
        `  --to-auth-mode oauth_user    create a new Sheet in your Drive root (oauth_user only)`,
    );
  }

  // 1. Resolve destination Google auth.
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const destAuth = await loadAuthClientOrElicit({
    ...(toAuthFlag !== undefined ? { mode: toAuthFlag } : {}),
    saCredentialsPath: credPath,
  });
  if (destAuth.kind === "local_xlsx") {
    fail(`destination resolved to local_xlsx — push-to-google requires Google auth`);
  }

  // 2. Bootstrap / attach the destination Sheet.
  const destResult =
    sheetId !== undefined
      ? await bootstrapExistingSheet({
          sheetId,
          auth: destAuth.client,
          onPreExisting: force ? "force" : "abort",
        })
      : await createProjectSheet({
          title: config.project_name,
          auth: destAuth.client,
          authMode: destAuth.kind,
          ...(folderId !== undefined ? { driveFolderId: folderId } : {}),
        });

  // 3. Build configs + run pure transfer.
  const destConfig: ProjectConfig = {
    project_name: config.project_name,
    sheet_id: destResult.sheet_id,
    sheet_template_version: 1,
    created_at: config.created_at,
    created_by: config.created_by,
    auth_mode: destAuth.kind,
    ...(folderId !== undefined ? { drive_folder_id: folderId } : {}),
  };
  const sourceClient = new LocalXlsxClient(localPath);
  const destClient = await makeSheetsClient(destAuth);
  const actor = readGitActor();

  const transferResult = await transferSheetData({
    cwd,
    sourceClient,
    sourceConfig: config,
    destClient,
    destConfig,
    caller: "bootstrap",
    actor,
    snapshotLabel: "pre-push-to-google",
  });
  const result = transferResult.atomic;

  if (result.failed > 0) {
    if (flags["json"] === true) {
      console.log(JSON.stringify({ ...result, status: "failed" }));
    } else {
      console.error(
        `✗ push-to-google failed: ${result.failed} row(s) errored. Rolled back: ${result.rolled_back}.`,
      );
      for (const o of result.outcomes) {
        if (o.error !== undefined)
          console.error(`    ✗ ${o.entity}[${o.index}] (${o.error_code}): ${o.error}`);
      }
    }
    process.exit(2);
  }

  // 4. Update project.json unless --keep-local is set.
  if (!keepLocal) {
    writeProjectConfig(cwd, destConfig);
  }

  if (flags["json"] === true) {
    console.log(
      JSON.stringify({
        pushed: result.written,
        sheet_id: destResult.sheet_id,
        url: destResult.url,
        project_json_updated: !keepLocal,
        keep_local: keepLocal,
      }),
    );
  } else {
    console.log(`✓ pushed ${result.written} row${result.written === 1 ? "" : "s"} to Google Sheet`);
    console.log(`  url:        ${destResult.url}`);
    console.log(`  sheet_id:   ${destResult.sheet_id}`);
    if (keepLocal) {
      console.log(
        `  --keep-local: project.json unchanged (still local_xlsx). Use 'sheets pull-from-google' to refresh local later.`,
      );
    } else {
      console.log(
        `✓ project.json updated: auth_mode=${destAuth.kind}, sheet_id=${destResult.sheet_id}`,
      );
      console.log(`  Local file kept at ${localPath} as backup. Delete or move when satisfied.`);
    }
  }
}

// ─── pull-from-google ────────────────────────────────────────────────────────

export async function runPullFromGoogle(
  _positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const cwd = process.cwd();
  const config = tryReadProjectConfig(cwd);
  if (!config) {
    fail(`No .codi/project.json. Bootstrap a project first.`);
  }
  if (config.auth_mode === "local_xlsx") {
    fail(`pull-from-google requires Google mode. Project is currently local_xlsx.`);
  }

  const toFlag = typeof flags["to"] === "string" ? flags["to"] : undefined;
  const switchMode = flags["switch-mode"] === true;
  const force = flags["force"] === true;

  const path = await import("node:path");
  const localPath = path.resolve(cwd, toFlag ?? ".codi/sheet.xlsx");

  if (existsSync(localPath) && !force) {
    fail(
      `local file already exists at ${localPath}. Pass --force to overwrite, or use --to "<other-path>".`,
    );
  }

  // 1. Resolve Google auth.
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const sourceAuth = await loadAuthClientOrElicit({
    mode: config.auth_mode ?? "service_account",
    saCredentialsPath: credPath,
  });
  if (sourceAuth.kind === "local_xlsx") {
    fail(`unexpected: source resolved to local_xlsx`);
  }
  const sourceClient = await makeSheetsClient(sourceAuth);

  // 2. Create the local xlsx + run the transfer.
  await createLocalXlsxProject({ filePath: localPath, force });
  const localClient = new LocalXlsxClient(localPath);
  const localConfig: ProjectConfig = {
    project_name: config.project_name,
    sheet_id: `local:${path.basename(localPath)}`,
    sheet_template_version: 1,
    local_path: localPath,
    created_at: config.created_at,
    created_by: config.created_by,
    auth_mode: "local_xlsx",
  };
  const actor = readGitActor();

  const transferResult = await transferSheetData({
    cwd,
    sourceClient,
    sourceConfig: config,
    destClient: localClient,
    destConfig: localConfig,
    caller: "bootstrap",
    actor,
    snapshotLabel: "pre-pull-from-google",
    skipDestSnapshot: true, // local file was just created; no prior state to preserve
  });
  const result = transferResult.atomic;
  const totalRows = transferResult.total_rows;

  if (result.failed > 0) {
    if (flags["json"] === true) {
      console.log(JSON.stringify({ ...result, status: "failed" }));
    } else {
      console.error(`✗ pull-from-google failed: ${result.failed} row(s) errored.`);
      for (const o of result.outcomes) {
        if (o.error !== undefined)
          console.error(`    ✗ ${o.entity}[${o.index}] (${o.error_code}): ${o.error}`);
      }
    }
    process.exit(2);
  }

  // 4. Optionally swap project.json to local_xlsx mode.
  if (switchMode) {
    writeProjectConfig(cwd, localConfig);
  }

  if (flags["json"] === true) {
    console.log(
      JSON.stringify({
        pulled: totalRows,
        local_path: localPath,
        project_json_updated: switchMode,
      }),
    );
  } else {
    console.log(`✓ pulled ${totalRows} row${totalRows === 1 ? "" : "s"} from Google Sheet`);
    console.log(`  local:     ${localPath}`);
    if (switchMode) {
      console.log(`✓ project.json updated: auth_mode=local_xlsx, local_path=${localPath}`);
    } else {
      console.log(
        `  --switch-mode not set: project.json unchanged. Pass --switch-mode to flip to local_xlsx.`,
      );
    }
  }
}

// ENTITY_NAMES referenced for the dispatcher's contract; kept for tree-shake noise.
void ENTITY_NAMES;
