/**
 * `codi sheets create-project` handler.
 *
 * Branches across the three persistence backends:
 *   - service_account / oauth_user → google bootstrapping (createProjectSheet
 *     for new files, bootstrapExistingSheet to attach to an existing one).
 *   - local_xlsx                   → createLocalXlsxProject (B8): writes a
 *     fresh .xlsx file with all six canonical tabs.
 *
 * Split out of cli.ts to honor the 700-LOC cap.
 */

import {
  type AuthMode,
  type ProjectConfig,
  bootstrapExistingSheet,
  createLocalXlsxProject,
  createProjectSheet,
  tryReadProjectConfig,
  writeProjectConfig,
} from "./index.js";

import { type CliFlags, fail, loadAuthClientOrElicit, readGitActor } from "./cli.js";

import { PROJECT_DIR } from "./project-constants.js";

export async function runCreateProject(
  _positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const name = typeof flags["name"] === "string" ? flags["name"] : undefined;
  if (!name) {
    fail(
      `codi sheets create-project --name "<project_name>" \\\n` +
        `  (--auth-mode service_account [--folder-id "<id>" | --sheet-id "<id>"]\n` +
        `   | --auth-mode oauth_user    [--folder-id "<id>" | --sheet-id "<id>"]\n` +
        `   | --auth-mode local_xlsx    [--local-path "<path>"])\n` +
        `\n` +
        `  --name        required: human-readable project name\n` +
        `  --auth-mode   service_account | oauth_user | local_xlsx (default service_account)\n` +
        `  --folder-id   create new Sheet inside this folder (Google modes only)\n` +
        `  --sheet-id    attach to an existing Sheet (Google modes only)\n` +
        `  --local-path  .xlsx path (local_xlsx only; default .codi/sheet.xlsx)\n` +
        `  --force       bypass preflight refusal on Sheet with existing data\n` +
        `\n` +
        `service_account on a personal Gmail: SAs have ZERO Drive quota — pass\n` +
        `--sheet-id pointing to a Sheet you already created and shared with the SA.\n` +
        `\n` +
        `local_xlsx mode requires no Google access; persists to a local file you\n` +
        `can later push to Google Sheets via 'codi sheets push-to-google'.`,
    );
  }

  const folderId = typeof flags["folder-id"] === "string" ? flags["folder-id"] : undefined;
  const sheetId = typeof flags["sheet-id"] === "string" ? flags["sheet-id"] : undefined;
  const localPath = typeof flags["local-path"] === "string" ? flags["local-path"] : undefined;
  const authModeFlag = typeof flags["auth-mode"] === "string" ? flags["auth-mode"] : undefined;
  if (
    authModeFlag !== undefined &&
    authModeFlag !== "service_account" &&
    authModeFlag !== "oauth_user" &&
    authModeFlag !== "local_xlsx"
  ) {
    fail(
      `--auth-mode must be 'service_account', 'oauth_user', or 'local_xlsx' (got '${authModeFlag}')`,
    );
  }
  const authMode: AuthMode = (authModeFlag ?? "service_account") as AuthMode;

  if (authMode === "service_account" && !folderId && !sheetId) {
    fail(
      `service_account mode needs --folder-id or --sheet-id.\n` +
        `  Personal account → create a blank Sheet, share with SA, pass --sheet-id "<id>".\n` +
        `  Workspace → pass --folder-id "<sharedDriveId>".\n` +
        `Or switch to --auth-mode oauth_user (folder optional, lands in your Drive root)\n` +
        `or --auth-mode local_xlsx (no Google access; persists to a local .xlsx file).`,
    );
  }
  if (folderId && sheetId) {
    fail(`--folder-id and --sheet-id are mutually exclusive. Pick one.`);
  }
  if (authMode === "local_xlsx" && (folderId || sheetId)) {
    fail(
      `local_xlsx does not use --folder-id / --sheet-id. Use --local-path "<path>" or omit (defaults to .codi/sheet.xlsx).`,
    );
  }

  const cwd = process.cwd();
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;

  // Refuse to overwrite an existing project.json.
  const existing = tryReadProjectConfig(cwd);
  if (existing && typeof existing.sheet_id === "string" && existing.sheet_id.length > 0) {
    fail(
      `${cwd}/.codi/project.json already has sheet_id ${existing.sheet_id}.\n` +
        `Refusing to overwrite. Delete the file first if you want to recreate.`,
    );
  }

  const force = flags["force"] === true;

  // ── local_xlsx branch ────────────────────────────────────────────────────
  if (authMode === "local_xlsx") {
    const path = await import("node:path");
    const resolvedLocalPath = path.resolve(cwd, localPath ?? `${PROJECT_DIR}/sheet.xlsx`);
    const xlsxResult = await createLocalXlsxProject({ filePath: resolvedLocalPath, force });

    const config: ProjectConfig = {
      project_name: name,
      sheet_id: `local:${path.basename(resolvedLocalPath)}`,
      sheet_template_version: 1,
      local_path: resolvedLocalPath,
      created_at: new Date().toISOString(),
      created_by: readGitActor(),
      auth_mode: "local_xlsx",
    };
    writeProjectConfig(cwd, config);

    if (flags["json"] === true) {
      console.log(
        JSON.stringify({
          mode: "local_xlsx",
          local_path: xlsxResult.file_path,
          tabs_created: xlsxResult.tabs_created,
          project_json_path: `${cwd}/.codi/project.json`,
          config,
        }),
      );
    } else {
      console.log(`✓ local .xlsx workbook created: ${xlsxResult.file_path}`);
      console.log(`  tabs:      ${xlsxResult.tabs_created.join(", ")}`);
      console.log(`✓ Wrote ${cwd}/.codi/project.json (project_name=${name}, auth_mode=local_xlsx)`);
      console.log(`Next: commit .codi/project.json and run project-workflow.`);
      console.log(`Later, push to a Google Sheet with: codi sheets push-to-google --sheet-id <id>`);
    }
    return;
  }

  // ── Google modes (service_account / oauth_user) ──────────────────────────
  const authClient = await loadAuthClientOrElicit({ mode: authMode, saCredentialsPath: credPath });
  if (authClient.kind === "local_xlsx") {
    fail(`unexpected: loadAuthClientOrElicit returned local_xlsx for ${authMode}`);
  }

  const result =
    sheetId !== undefined
      ? await bootstrapExistingSheet({
          sheetId,
          auth: authClient.client,
          onPreExisting: force ? "force" : "abort",
        })
      : await createProjectSheet({
          title: name,
          auth: authClient.client,
          authMode,
          ...(folderId !== undefined ? { driveFolderId: folderId } : {}),
        });

  const config: ProjectConfig = {
    project_name: name,
    sheet_id: result.sheet_id,
    sheet_template_version: 1,
    created_at: new Date().toISOString(),
    created_by: readGitActor(),
    auth_mode: authMode,
    ...(folderId !== undefined ? { drive_folder_id: folderId } : {}),
  };
  writeProjectConfig(cwd, config);

  const mode = folderId !== undefined ? "created in folder" : "bootstrapped existing";
  if (flags["json"] === true) {
    console.log(
      JSON.stringify({
        mode,
        sheet_id: result.sheet_id,
        url: result.url,
        tabs_created: result.tabs_created,
        project_json_path: `${cwd}/.codi/project.json`,
        config,
      }),
    );
  } else {
    console.log(`✓ Sheet ${mode}: ${result.url}`);
    console.log(`  sheet_id:  ${result.sheet_id}`);
    console.log(`  tabs:      ${result.tabs_created.join(", ")}`);
    console.log(`✓ Wrote ${cwd}/.codi/project.json (project_name=${name})`);
    console.log(`Next: commit .codi/project.json and continue project-workflow.intent.`);
  }
}
