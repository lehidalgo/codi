/**
 * Draft-handling subcommands of `devloop sheets`:
 *   - sync-draft  — batch upsert from a local JSON draft (auto-validates first)
 *   - validate    — run integrity checks on a draft without writing
 *
 * Split out of cli.ts to honor the 700-LOC cap. Re-uses the shared CLI
 * helpers (fail, readConfigOrElicit, loadAuthClientOrElicit, readGitActor,
 * coerceJsonObjectToSheetRow) exported from cli.ts.
 */

import {
  ENTITY_NAMES,
  type EntityName,
  type SheetRow,
  type ProjectConfig,
  SheetsError,
  GoogleSheetsClient,
  makeSheetsClient,
  readTab,
  upsertRow,
  archiveRow,
  validateDraft,
  formatIntegrityReport,
  type DraftEnvelope,
  captureSnapshot,
  listSnapshots,
  pruneSnapshots,
  DEFAULT_SNAPSHOT_RETENTION,
  computeDiff,
  formatDiffSummary,
  atomicSyncDraft,
  restoreFromSnapshotPath,
} from "./index.js";

import {
  type CliFlags,
  fail,
  readConfigOrElicit,
  loadAuthClientOrElicit,
  readGitActor,
  coerceJsonObjectToSheetRow,
} from "./cli.js";

// ─── sync-draft ──────────────────────────────────────────────────────────────

export async function runSyncDraft(
  positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const draftPath = positional[2];
  if (!draftPath) {
    fail(
      `devloop sheets sync-draft <draft.json> [--dry-run]\n` +
        `\n` +
        `Reads a local JSON draft file with shape:\n` +
        `  {\n` +
        `    "BusinessGoal": [{...row...}, ...],\n` +
        `    "Requirement":  [{...row...}, ...],\n` +
        `    "UserStory":    [{...row...}, ...]\n` +
        `  }\n` +
        `\n` +
        `Upserts every row to the project Sheet with caller=bootstrap. IDs are\n` +
        `auto-assigned for rows without an "id" field. Validation runs FIRST;\n` +
        `the gate aborts before any Sheet API call if the draft has integrity\n` +
        `errors. Use this in discover / decompose — far cheaper in tokens than\n` +
        `per-row "devloop sheets upsert" calls.\n` +
        `\n` +
        `Flags:\n` +
        `  --dry-run         validate the draft + report row count, do NOT write\n` +
        `  --skip-validate   skip integrity validation (NOT recommended; warns)\n` +
        `  --local-validate  validate without reading current Sheet state (no\n` +
        `                    orphan cross-check). Faster; weaker.\n` +
        `  --json            machine-readable output`,
    );
  }

  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);
  const actor = readGitActor();

  const fs = await import("node:fs");
  const path = await import("node:path");
  const absPath = path.resolve(cwd, draftPath);
  if (!fs.existsSync(absPath)) {
    fail(`draft file not found: ${absPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (e) {
    fail(`draft file is not valid JSON: ${(e as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(`draft must be a JSON object whose keys are entity names`);
  }
  const draft = parsed as Record<string, unknown>;

  const dryRun = flags["dry-run"] === true;
  const skipValidate = flags["skip-validate"] === true;
  const localValidate = flags["local-validate"] === true;

  const envelope = coerceDraftEnvelope(draft);
  let sheetState: Partial<Record<EntityName, ReadonlyArray<SheetRow>>> | undefined;

  if (!skipValidate) {
    if (!localValidate) {
      sheetState = await pullSheetStateForEntities(
        Object.keys(envelope).filter((k) =>
          (ENTITY_NAMES as ReadonlyArray<string>).includes(k),
        ) as EntityName[],
        { client, config },
      );
    }
    const report = validateDraft(envelope, sheetState ? { sheetState } : {});
    if (!report.ok) {
      if (flags["json"] === true) {
        console.log(JSON.stringify({ phase: "validate", ...report }));
      } else {
        console.error(formatIntegrityReport(report));
        console.error(``);
        console.error(`Aborted: 0 rows written. Fix the draft and re-run.`);
        console.error(`Or pass --skip-validate to bypass (not recommended).`);
      }
      process.exit(1);
    }
    if (flags["json"] !== true) {
      console.log(formatIntegrityReport(report));
    }
  } else if (flags["json"] !== true) {
    console.error(`⚠  --skip-validate active: integrity checks bypassed.`);
  }

  if (dryRun) {
    if (flags["json"] === true) {
      console.log(
        JSON.stringify({ dry_run: true, draft_path: absPath, ...validateDraft(envelope) }),
      );
    } else {
      console.log(
        `[dry-run] sync-draft: ${absPath} — ${countTotalRows(envelope)} row(s) would be processed`,
      );
    }
    return;
  }

  // ── Atomic transaction: snapshot → per-row apply → rollback on first failure
  const skipSnapshot = flags["skip-snapshot"] === true;
  const result = await atomicSyncDraft({
    cwd,
    client,
    config,
    caller: "bootstrap",
    actor,
    envelope,
    snapshotLabel: typeof flags["label"] === "string" ? flags["label"] : "sync-draft",
    skipSnapshot,
  });

  if (flags["json"] === true) {
    console.log(JSON.stringify({ draft_path: absPath, ...result }));
  } else {
    console.log(`sync-draft: ${absPath}`);
    console.log(`  total rows:    ${result.total}`);
    console.log(`  written:       ${result.written}`);
    console.log(`  no-op:         ${result.no_ops}`);
    console.log(`  archived:      ${result.archived}`);
    console.log(`  failed:        ${result.failed}`);
    if (result.snapshot_path !== undefined) {
      console.log(`  snapshot:      ${result.snapshot_path}`);
    }
    if (result.rolled_back) {
      console.log(`  ⚠  ROLLED BACK from snapshot — Sheet is unchanged.`);
    }
    for (const o of result.outcomes) {
      if (o.error !== undefined) {
        console.log(`    ✗ ${o.entity}[${o.index}] (${o.error_code}): ${o.error}`);
      }
    }
    if (!result.rolled_back) {
      const byEntity = new Map<EntityName, (typeof result.outcomes)[number][]>();
      for (const o of result.outcomes) {
        if (o.error !== undefined) continue;
        const arr = byEntity.get(o.entity) ?? [];
        arr.push(o);
        byEntity.set(o.entity, arr);
      }
      for (const [entity, arr] of byEntity) {
        const ids = arr.map((o) => o.row_id ?? "?").join(", ");
        console.log(`  ${entity} (${arr.length}): ${ids}`);
      }
    }
  }

  if (result.failed > 0) process.exit(2);
}

function countTotalRows(envelope: DraftEnvelope): number {
  let n = 0;
  for (const rows of Object.values(envelope)) n += rows.length;
  return n;
}

// ─── validate (standalone) ───────────────────────────────────────────────────

export async function runValidate(
  positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const draftPath = positional[2];
  if (!draftPath) {
    fail(
      `devloop sheets validate <draft.json> [--local] [--json]\n` +
        `\n` +
        `Run integrity checks on a draft file WITHOUT writing to the Sheet:\n` +
        `  - shape (AJV) with enum-aware error messages\n` +
        `  - duplicate IDs within each entity\n` +
        `  - orphan references (satisfies / elaborated_from / parent_story)\n` +
        `  - missing required fields on insert\n` +
        `\n` +
        `By default, references are cross-checked against the current Sheet so\n` +
        `that a satisfies=BG-X resolves to a BusinessGoal that exists in the\n` +
        `Sheet even if it's not in the current draft.\n` +
        `\n` +
        `Flags:\n` +
        `  --local   pure-local (no Sheet read; faster; weaker)\n` +
        `  --json    machine-readable output\n` +
        `\n` +
        `Exits 0 on clean, 1 on integrity errors, 2 on Sheet read failure.`,
    );
  }

  const fs = await import("node:fs");
  const path = await import("node:path");
  const cwd = process.cwd();
  const absPath = path.resolve(cwd, draftPath);
  if (!fs.existsSync(absPath)) {
    fail(`draft file not found: ${absPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (e) {
    fail(`draft file is not valid JSON: ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(`draft must be a JSON object whose keys are entity names`);
  }
  const envelope = coerceDraftEnvelope(parsed as Record<string, unknown>);

  const local = flags["local"] === true;
  let sheetState: Partial<Record<EntityName, ReadonlyArray<SheetRow>>> | undefined;
  if (!local) {
    try {
      const config = readConfigOrElicit(cwd);
      const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
      const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
      const client = await makeSheetsClient(authClient);
      sheetState = await pullSheetStateForEntities(
        Object.keys(envelope).filter((k) =>
          (ENTITY_NAMES as ReadonlyArray<string>).includes(k),
        ) as EntityName[],
        { client, config },
      );
    } catch (e) {
      console.error(
        `Sheet read failed (${(e as Error).message}); falling back to --local mode is recommended.`,
      );
      process.exit(2);
    }
  }

  const report = validateDraft(envelope, sheetState ? { sheetState } : {});
  if (flags["json"] === true) {
    console.log(JSON.stringify({ draft_path: absPath, local, ...report }, null, 2));
  } else {
    console.log(formatIntegrityReport(report));
  }
  process.exit(report.ok ? 0 : 1);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Best-effort coercion of a raw parsed-JSON draft into a DraftEnvelope.
 * Skips rows that aren't plain objects or that contain non-scalar values.
 */
export function coerceDraftEnvelope(draft: Record<string, unknown>): DraftEnvelope {
  const out: Record<string, ReadonlyArray<SheetRow>> = {};
  for (const [entityKey, value] of Object.entries(draft)) {
    if (!Array.isArray(value)) {
      out[entityKey] = [];
      continue;
    }
    const rows: SheetRow[] = [];
    for (const raw of value) {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
      const coerced = coerceJsonObjectToSheetRow(raw as Record<string, unknown>);
      if (coerced.kind === "ok") rows.push(coerced.row);
    }
    out[entityKey] = rows;
  }
  return out;
}

/**
 * Pull current Sheet rows for the given entities (best-effort).
 * Used as the cross-check baseline for orphan-reference detection. Always
 * pulls BG / REQ / US so cross-tab references resolve even when the draft
 * only writes to one of them.
 */
export async function pullSheetStateForEntities(
  entities: ReadonlyArray<EntityName>,
  opts: { client: import("./client.js").SheetsClient; config: ProjectConfig },
): Promise<Partial<Record<EntityName, ReadonlyArray<SheetRow>>>> {
  const out: Partial<Record<EntityName, ReadonlyArray<SheetRow>>> = {};
  const targets = new Set<EntityName>([...entities, "BusinessGoal", "Requirement", "UserStory"]);
  for (const entity of targets) {
    try {
      const tab = await readTab(entity, opts);
      out[entity] = tab.rows;
    } catch {
      /* missing tab / unreachable: leave undefined */
    }
  }
  return out;
}

// ─── pull / pull-all ─────────────────────────────────────────────────────────

/**
 * `devloop sheets pull <Entity>` — read one tab to JSON.
 * `devloop sheets pull-all`      — read every entity tab to a draft envelope.
 *
 * Output goes to stdout unless `--into <path>` is supplied. The shape matches
 * what `sync-draft` consumes, so:
 *
 *     devloop sheets pull-all --into .devloop/sheet-state.json
 *
 * gives the agent the canonical "current truth" baseline before modifying.
 */
export async function runPull(positional: ReadonlyArray<string>, flags: CliFlags): Promise<void> {
  const sub = positional[1];
  const all = sub === "pull-all";

  const cwd = process.cwd();
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);

  let entitiesToPull: EntityName[];
  if (all) {
    entitiesToPull = [...ENTITY_NAMES];
  } else {
    const ent = positional[2];
    if (!ent) {
      fail(
        `devloop sheets pull <Entity> [--into <path>] [--json]\n` +
          `       devloop sheets pull-all [--into <path>] [--json]\n` +
          `\n` +
          `Read the current Sheet state to JSON. Use this BEFORE editing any\n` +
          `entity row so the resulting draft is a delta against current truth.\n` +
          `\n` +
          `Output shape (matches sync-draft input):\n` +
          `  { "BusinessGoal": [...], "Requirement": [...], "UserStory": [...] }\n` +
          `\n` +
          `Entities: ${ENTITY_NAMES.join(", ")}\n` +
          `\n` +
          `Flags:\n` +
          `  --into <path>   write JSON to file (default: stdout)\n` +
          `  --json          emit pure JSON to stdout (no row count summary)`,
      );
    }
    if (!(ENTITY_NAMES as ReadonlyArray<string>).includes(ent)) {
      fail(`unknown entity '${ent}'. expected one of: ${ENTITY_NAMES.join(", ")}`);
    }
    entitiesToPull = [ent as EntityName];
  }

  const envelope: Record<string, ReadonlyArray<SheetRow>> = {};
  let totalRows = 0;
  for (const entity of entitiesToPull) {
    try {
      const tab = await readTab(entity, { client, config });
      envelope[entity] = tab.rows;
      totalRows += tab.rows.length;
    } catch (e) {
      if (e instanceof SheetsError) {
        fail(`pull ${entity}: ${e.code}: ${e.message}`);
      }
      throw e;
    }
  }

  const json = JSON.stringify(envelope, null, 2);
  const intoPath = typeof flags["into"] === "string" ? flags["into"] : undefined;
  const fs = await import("node:fs");
  const path = await import("node:path");

  if (intoPath !== undefined) {
    const abs = path.resolve(cwd, intoPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, json + "\n", "utf8");
    if (flags["json"] !== true) {
      const counts = entitiesToPull.map((e) => `${e}=${envelope[e]?.length ?? 0}`).join(", ");
      console.log(`✓ pulled ${totalRows} row${totalRows === 1 ? "" : "s"} → ${abs}`);
      console.log(`  ${counts}`);
    } else {
      console.log(JSON.stringify({ path: abs, total: totalRows, by_entity: envelope }));
    }
  } else {
    console.log(json);
  }
}

// ─── snapshot ────────────────────────────────────────────────────────────────

/**
 * `devloop sheets snapshot [--label <name>] [--list] [--prune <keep>] [--json]`
 *
 * - default: capture a snapshot of all 5 tabs
 * - --list: print existing snapshots newest-first
 * - --prune <n>: keep N most-recent, delete older
 */
export async function runSnapshot(
  _positional: ReadonlyArray<string>,
  flags: CliFlags,
): Promise<void> {
  const cwd = process.cwd();

  if (flags["list"] === true) {
    const entries = await listSnapshots(cwd);
    if (flags["json"] === true) {
      console.log(
        JSON.stringify(
          entries.map((e) => ({
            path: e.path,
            filename: e.filename,
            mtime: e.mtime.toISOString(),
            size: e.size,
          })),
          null,
          2,
        ),
      );
    } else if (entries.length === 0) {
      console.log(`(no snapshots in .devloop/snapshots/)`);
    } else {
      for (const e of entries) {
        console.log(
          `  ${e.mtime.toISOString()}  ${e.size.toString().padStart(7)} B  ${e.filename}`,
        );
      }
    }
    return;
  }

  if (flags["prune"] !== undefined) {
    const keep =
      typeof flags["prune"] === "string"
        ? Number.parseInt(flags["prune"], 10)
        : DEFAULT_SNAPSHOT_RETENTION;
    if (!Number.isFinite(keep) || keep < 0) {
      fail(`--prune expects a non-negative integer (got ${String(flags["prune"])})`);
    }
    const removed = await pruneSnapshots(cwd, keep);
    if (flags["json"] === true) {
      console.log(JSON.stringify({ kept: keep, removed }, null, 2));
    } else {
      console.log(
        `pruned ${removed.length} snapshot${removed.length === 1 ? "" : "s"} (kept ${keep} most-recent)`,
      );
    }
    return;
  }

  // Capture path.
  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);
  const actor = readGitActor();
  const label = typeof flags["label"] === "string" ? flags["label"] : undefined;

  const result = await captureSnapshot({
    cwd,
    client,
    config,
    taken_by: actor,
    ...(label !== undefined ? { label } : {}),
  });

  // Best-effort prune to default retention so the dir doesn't grow unbounded.
  await pruneSnapshots(cwd, DEFAULT_SNAPSHOT_RETENTION);

  if (flags["json"] === true) {
    const counts: Record<string, number> = {};
    for (const [entity, tab] of Object.entries(result.snapshot.tabs)) {
      if (tab) counts[entity] = tab.row_count;
    }
    console.log(JSON.stringify({ path: result.path, by_entity: counts }, null, 2));
  } else {
    const counts = Object.entries(result.snapshot.tabs)
      .filter(([, t]) => t !== undefined)
      .map(([k, t]) => `${k}=${t!.row_count}`)
      .join(", ");
    console.log(`✓ snapshot captured  ${result.path}`);
    console.log(`  ${counts}`);
  }
}

// ─── diff ────────────────────────────────────────────────────────────────────

/**
 * `devloop sheets diff <draft.json> [--columns] [--json]`
 *
 * Show the patch a sync-draft WOULD apply, without writing. Reads current
 * Sheet state for the comparison. Useful for review before approving.
 */
export async function runDiff(positional: ReadonlyArray<string>, flags: CliFlags): Promise<void> {
  const draftPath = positional[2];
  if (!draftPath) {
    fail(
      `devloop sheets diff <draft.json> [--columns] [--json]\n` +
        `\n` +
        `Compute insert/update/no-op/archive counts vs current Sheet state.\n` +
        `Optional --columns lists every changed cell (verbose).`,
    );
  }

  const fs = await import("node:fs");
  const path = await import("node:path");
  const cwd = process.cwd();
  const absPath = path.resolve(cwd, draftPath);
  if (!fs.existsSync(absPath)) {
    fail(`draft file not found: ${absPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (e) {
    fail(`draft file is not valid JSON: ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(`draft must be a JSON object whose keys are entity names`);
  }
  const envelope = coerceDraftEnvelope(parsed as Record<string, unknown>);

  const config = readConfigOrElicit(cwd);
  const credPath = typeof flags["credentials"] === "string" ? flags["credentials"] : undefined;
  const authClient = await loadAuthClientOrElicit({ saCredentialsPath: credPath });
  const client = await makeSheetsClient(authClient);

  const sheetState = await pullSheetStateForEntities(
    Object.keys(envelope).filter((k) =>
      (ENTITY_NAMES as ReadonlyArray<string>).includes(k),
    ) as EntityName[],
    { client, config },
  );

  const diff = computeDiff(envelope, { sheetState });

  if (flags["json"] === true) {
    console.log(JSON.stringify(diff, null, 2));
  } else {
    console.log(formatDiffSummary(diff, { showColumns: flags["columns"] === true }));
  }
}

// runRestore + runArchive live in ./cli-safety.ts (split for the 700-LOC cap).
