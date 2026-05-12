/**
 * Public surface of lib/sheets/.
 *
 * Other modules import from here (not from internal files) so the boundary stays narrow.
 */

export type {
  EntityName,
  Zone,
  CallerScope,
  CellValue,
  SheetRow,
  ProjectConfig,
  UpsertResult,
  SheetsErrorCode,
} from "./types.js";

export {
  ENTITY_NAMES,
  ID_PREFIX_BY_ENTITY,
  COLUMN_ZONES,
  SheetsError,
  allowedZones,
  zoneOf,
} from "./types.js";

export {
  PROJECT_CONFIG_RELATIVE_PATH,
  projectConfigPath,
  readProjectConfig,
  writeProjectConfig,
  tryReadProjectConfig,
  elicitationPromptForMissingConfig,
} from "./config.js";

export type {
  ServiceAccountKey,
  AuthMode,
  AuthClient,
  SheetsAuthClient,
  LoadAuthClientOptions,
} from "./auth.js";
export {
  DEFAULT_CREDENTIALS_PATH,
  SHEETS_SCOPES,
  OAUTH_USER_LOGIN_SCOPES,
  resolveCredentialsPath,
  loadServiceAccountKey,
  createJwtAuth,
  loadAuth,
  loadAuthClient,
  adcCredentialsPath,
  elicitationPromptForMissingCredentials,
  elicitationPromptForOAuthSetup,
  probeOAuthUserScopes,
  isInsufficientScopesError,
} from "./auth.js";

export type { ScopeProbeResult, ScopeProbeOutcome } from "./auth.js";

export type {
  A1Range,
  ReadRangeResult,
  UpdateRangeRequest,
  AppendRowRequest,
  BatchWriteRequest,
  SheetsClient,
} from "./client.js";
export {
  GoogleSheetsClient,
  tabRange,
  rowRange,
  appendTarget,
  makeSheetsClient,
} from "./client.js";

export { LocalXlsxClient } from "./xlsx-client.js";

export type { CreateLocalXlsxOptions, CreateLocalXlsxResult } from "./xlsx-bootstrap.js";
export { createLocalXlsxProject, localXlsxTabHeaders, LOCAL_XLSX_TABS } from "./xlsx-bootstrap.js";

export type { BaseOptions, UpsertOptions, ParsedTab } from "./operations.js";
export {
  readTab,
  readRow,
  readAllRows,
  readAllRowsLenient,
  upsertRow,
  archiveRow,
  appendAuditRow,
} from "./operations.js";

export { validatePartialRow, validateFullRow, isValidId, nextId } from "./schema.js";

export type {
  DraftEnvelope,
  IntegrityIssue,
  IntegrityIssueCode,
  IntegrityReport,
  ValidateOptions,
} from "./integrity.js";
export { validateDraft, formatIntegrityReport } from "./integrity.js";

export type {
  Snapshot,
  SnapshotTab,
  SnapshotEntry,
  CaptureSnapshotOptions,
  CaptureSnapshotResult,
} from "./snapshot.js";
export {
  SNAPSHOT_VERSION,
  SNAPSHOT_DIR_RELATIVE,
  DEFAULT_SNAPSHOT_RETENTION,
  captureSnapshot,
  readSnapshot,
  listSnapshots,
  pruneSnapshots,
  snapshotFilename,
} from "./snapshot.js";

export type {
  DiffKind,
  ColumnChange,
  RowDiff,
  EntityCounts,
  DiffSummary,
  ComputeDiffOptions,
} from "./diff.js";
export { computeDiff, formatDiffSummary } from "./diff.js";

export type {
  AtomicSyncOptions,
  AtomicSyncOutcome,
  AtomicSyncResult,
  RestoreOptions,
} from "./transactions.js";
export { atomicSyncDraft, restoreFromSnapshot, restoreFromSnapshotPath } from "./transactions.js";

export type { TransferOptions, TransferResult } from "./bridge.js";
export { transferSheetData } from "./bridge.js";

export type {
  CreateSheetOptions,
  CreateSheetResult,
  BootstrapExistingSheetOptions,
  PreflightReport,
} from "./bootstrap.js";
export {
  createProjectSheet,
  bootstrapExistingSheet,
  preflightExistingSheet,
  buildPreflightReport,
} from "./bootstrap.js";

export type { GoogleAccountType } from "./account-type.js";
export { detectAccountType, recommendedBootstrapMode } from "./account-type.js";

export type { QueuedSync } from "./queue.js";
export {
  QUEUE_RELATIVE_PATH,
  queuePath,
  enqueue,
  readPending,
  removeById,
  incrementAttempt,
  buildQueueId,
} from "./queue.js";

export type { ReconcileOptions, ReconcileResult } from "./reconcile.js";
export { reconcile } from "./reconcile.js";

export type { DaemonOptions, DaemonPassResult } from "./daemon.js";
export { drainOnce, runDaemon } from "./daemon.js";
