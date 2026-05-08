/**
 * Safety / recovery subcommands of `devloop sheets`:
 *   - restore   replay a snapshot back onto the Sheet
 *   - archive   soft-delete a row (sets status=abandoned + archived_at/by)
 *
 * Split out of cli-draft.ts to keep each file focused and under the 700-LOC
 * cap. Shares the auth + config helpers with cli-draft via cli.ts exports.
 */

import {
  ENTITY_NAMES,
  type EntityName,
  SheetsError,
  GoogleSheetsClient,
  makeSheetsClient,
  archiveRow,
  listSnapshots,
  restoreFromSnapshotPath,
} from "./index.js";

import {
  type CliFlags,
  fail,
  readConfigOrElicit,
  loadAuthClientOrElicit,
  readGitActor,
} from "./cli.js";

// ─── restore ─────────────────────────────────────────────────────────────────

export async function runRestore(
  positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const fromArg = typeof flags["from"] === "string" ? flags["from"] : positional[2];
  const latest = flags["latest"] === true;

  if (!fromArg && !latest) {
    fail(
      `devloop sheets restore --from <snapshot.json> [--only "BG,REQ"] [--json]\n` +
        `       devloop sheets restore --latest [--only ...]\n` +
        `\n` +
        `Replay a snapshot back onto the project Sheet. Every row in the named\n` +
        `entity tabs is REPLACED with the snapshot contents. Audit tab gets a\n` +
        `tab_restored_from_snapshot row for traceability.\n` +
        `\n` +
        `Flags:\n` +
        `  --from <path>    snapshot file (.devloop/snapshots/...)\n` +
        `  --latest         pick the newest snapshot in .devloop/snapshots/\n` +
        `  --only "BG,REQ"  restrict to specific entity tabs (comma-separated)\n` +
        `  --json           machine-readable output`,
    );
  }

  const cwd = process.cwd();
  const path = await import("node:path");

  let snapshotPath: string;
  if (latest) {
    const entries = await listSnapshots(cwd);
    if (entries.length === 0) {
      fail(`no snapshots found in .devloop/snapshots/ — capture one first`);
    }
    snapshotPath = entries[0]!.path;
  } else {
    snapshotPath = path.resolve(cwd, fromArg as string);
  }

  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);

  const onlyArg = typeof flags["only"] === "string" ? flags["only"] : undefined;
  const only: EntityName[] | undefined =
    onlyArg !== undefined
      ? (onlyArg
          .split(",")
          .map((s) => s.trim())
          .filter((s) => (ENTITY_NAMES as ReadonlyArray<string>).includes(s)) as EntityName[])
      : undefined;

  try {
    const result = await restoreFromSnapshotPath(snapshotPath, {
      client,
      config,
      ...(only !== undefined ? { only } : {}),
    });
    if (flags["json"] === true) {
      console.log(
        JSON.stringify(
          {
            snapshot: snapshotPath,
            restored_tabs: result.restored_tabs,
            total_rows: result.total_rows,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        `✓ restored ${result.total_rows} row${result.total_rows === 1 ? "" : "s"} ` +
          `across ${result.restored_tabs.length} tab${result.restored_tabs.length === 1 ? "" : "s"}`,
      );
      console.log(`  from:   ${snapshotPath}`);
      console.log(`  tabs:   ${result.restored_tabs.join(", ")}`);
    }
  } catch (e) {
    if (e instanceof SheetsError) {
      fail(`restore failed (${e.code}): ${e.message}`);
    }
    throw e;
  }
}

// ─── archive ─────────────────────────────────────────────────────────────────

export async function runArchive(
  positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const entityArg = positional[2];
  const idArg = positional[3];
  if (!entityArg || !idArg) {
    fail(
      `devloop sheets archive <Entity> <id> [--reason "<text>"] [--json]\n` +
        `\n` +
        `Soft-delete a row. Sets status=abandoned, archived_at, archived_by.\n` +
        `Row STAYS in the Sheet (no hard delete). Restore via:\n` +
        `  devloop sheets restore --latest\n` +
        `\n` +
        `Entities: ${ENTITY_NAMES.join(", ")}`,
    );
  }
  if (!(ENTITY_NAMES as ReadonlyArray<string>).includes(entityArg)) {
    fail(`unknown entity '${entityArg}'. expected one of: ${ENTITY_NAMES.join(", ")}`);
  }
  const entity = entityArg as EntityName;

  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);
  const actor = readGitActor();
  const reason = typeof flags["reason"] === "string" ? flags["reason"] : undefined;

  try {
    const result = await archiveRow(entity, idArg, {
      caller: "bootstrap",
      client,
      config,
      actor,
      ...(reason !== undefined ? { reason } : {}),
    });
    if (flags["json"] === true) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.was_no_op) {
      console.log(`(already archived) ${entity} ${idArg}`);
    } else {
      console.log(`✓ archived  ${entity} ${idArg}` + (reason !== undefined ? `  — ${reason}` : ""));
    }
  } catch (e) {
    if (e instanceof SheetsError) {
      fail(`archive failed (${e.code}): ${e.message}`);
    }
    throw e;
  }
}
