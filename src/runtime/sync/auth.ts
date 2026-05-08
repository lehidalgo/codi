/**
 * Authentication for Google Sheets + Drive.
 *
 * Two modes, both first-class:
 *
 *   - service_account: reads a service-account JSON key from
 *     ~/.config/devloop/credentials.json (or DEVLOOP_GOOGLE_CREDENTIALS env).
 *     Returns a JWT auth client. The agent acts as the SA. Files are owned
 *     by the SA (or the Shared Drive on Workspace) — SAs have ZERO Drive
 *     quota of their own, so Drive operations require either a Shared Drive
 *     or a folder/Sheet shared with the SA email.
 *
 *   - oauth_user: reads Application Default Credentials from
 *     ~/.config/gcloud/application_default_credentials.json (set up by
 *     `gcloud auth application-default login`). Returns the user's
 *     OAuth2 client — agent acts as the user, files use the user's Drive
 *     quota, files are owned by the user.
 *
 * Both coexist. Choose at project bootstrap (.devloop/project.json::auth_mode)
 * or via --auth-mode CLI flag. Neither is a default; the elicitation flow
 * asks the user which to use.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

import { JWT, GoogleAuth, OAuth2Client } from "google-auth-library";

import { SheetsError } from "./types.js";

export const DEFAULT_CREDENTIALS_PATH = ".config/devloop/credentials.json";

export const SHEETS_SCOPES: ReadonlyArray<string> = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

/**
 * Canonical OAuth scopes for `gcloud auth application-default login`.
 * MUST stay in sync with skills/sheets-sync/scripts/oauth-user-setup.sh::CANONICAL_SCOPES
 * (a unit test in tests/sheets-auth.test.ts asserts this).
 *
 * Why this set:
 *   - openid + userinfo.email — identity attribution for Audit rows
 *   - cloud-platform          — required by gcloud's ADC flow
 *   - spreadsheets            — read/write project Sheet
 *   - drive                   — create/move/share project Sheet via Drive API
 */
export const OAUTH_USER_LOGIN_SCOPES: ReadonlyArray<string> = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

/**
 * Probe the active ADC token by calling a known-404 Sheets endpoint.
 * Distinguishes scope problems from transport problems:
 *   - 404 (or 400) → token works; scopes are sufficient (the Sheet ID is bogus)
 *   - 403 + "insufficient_authentication_scopes" → token lacks scopes
 *   - 401            → token is invalid / expired
 *   - network error → transport problem
 *
 * Returns ScopeProbeResult; never throws.
 */
export type ScopeProbeOutcome =
  | "ok"
  | "insufficient_scopes"
  | "unauthorized"
  | "transport_error"
  | "unknown";

export interface ScopeProbeResult {
  outcome: ScopeProbeOutcome;
  http_status?: number;
  details?: string;
}

const PROBE_URL = "https://sheets.googleapis.com/v4/spreadsheets/__devloop_probe_invalid_id__";

export async function probeOAuthUserScopes(): Promise<ScopeProbeResult> {
  let token: string;
  try {
    const out = execFileSync("gcloud", ["auth", "application-default", "print-access-token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (out.length === 0)
      return { outcome: "transport_error", details: "gcloud returned empty token" };
    token = out;
  } catch (e) {
    return { outcome: "transport_error", details: (e as Error).message };
  }

  let res: Response;
  try {
    res = await fetch(PROBE_URL, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    return { outcome: "transport_error", details: (e as Error).message };
  }

  let body = "";
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }

  if (res.status === 404 || res.status === 400) {
    return { outcome: "ok", http_status: res.status };
  }
  if (res.status === 403 && /insufficient/i.test(body)) {
    return { outcome: "insufficient_scopes", http_status: res.status, details: body.slice(0, 200) };
  }
  if (res.status === 401) {
    return { outcome: "unauthorized", http_status: res.status, details: body.slice(0, 200) };
  }
  return { outcome: "unknown", http_status: res.status, details: body.slice(0, 200) };
}

/**
 * Classify a runtime SheetsError to detect "needs OAuth scope re-grant" cases.
 * Returns true when the error text matches the insufficient_scopes pattern.
 */
export function isInsufficientScopesError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.message}`.toLowerCase();
  return (
    /insufficient[\s_]?authentication[\s_]?scopes?/i.test(msg) ||
    /insufficient permissions|missing required scope/i.test(msg)
  );
}

export interface ServiceAccountKey {
  type: "service_account";
  client_email: string;
  private_key: string;
  project_id?: string;
}

/** Resolve the credentials path: explicit > env > default ~/.config/devloop/credentials.json. */
export function resolveCredentialsPath(explicit?: string): string {
  if (explicit && explicit.length > 0) return explicit;
  const fromEnv = process.env["DEVLOOP_GOOGLE_CREDENTIALS"];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return join(homedir(), DEFAULT_CREDENTIALS_PATH);
}

/** Load and validate a service-account key file. */
export function loadServiceAccountKey(explicitPath?: string): ServiceAccountKey {
  const path = resolveCredentialsPath(explicitPath);
  if (!existsSync(path)) {
    throw new SheetsError(
      "credentials_missing",
      `service-account credentials not found at ${path}`,
      { path },
    );
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new SheetsError(
      "credentials_missing",
      `unable to read credentials at ${path}: ${(e as Error).message}`,
      { path },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new SheetsError(
      "credentials_missing",
      `credentials file is not valid JSON: ${(e as Error).message}`,
      { path },
    );
  }
  return assertServiceAccountKey(parsed, path);
}

/** Build a JWT auth client from a key. Caller passes this to googleapis. */
export function createJwtAuth(key: ServiceAccountKey): JWT {
  return new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SHEETS_SCOPES.slice(),
  });
}

/** One-shot — load key + build JWT. Back-compat: returns JWT directly.
 *  New callers should prefer loadAuthClient (returns AuthClient discriminated union). */
export function loadAuth(explicitPath?: string): JWT {
  return createJwtAuth(loadServiceAccountKey(explicitPath));
}

// ─── Auth modes (both first-class, neither replaces the other) ──────────────

export type AuthMode = "service_account" | "oauth_user" | "local_xlsx";

/** googleapis accepts JWT (subtype of OAuth2Client) and GoogleAuth directly. */
export type SheetsAuthClient = JWT | OAuth2Client | GoogleAuth;

/**
 * AuthClient is a discriminated union — Google modes carry a googleapis
 * client; local_xlsx mode carries a local file path (no auth needed).
 */
export type AuthClient =
  | {
      kind: "service_account" | "oauth_user";
      /** SA email for service_account; user email for oauth_user. */
      identity: string;
      /** googleapis-compatible auth client. */
      client: SheetsAuthClient;
    }
  | {
      kind: "local_xlsx";
      /** "local:<basename>" — used purely for display. */
      identity: string;
      /** Absolute path to the .xlsx file. */
      filePath: string;
    };

export interface LoadAuthClientOptions {
  /** Explicit mode override. If absent, auto-detect (prefers SA when both present). */
  mode?: AuthMode;
  /** Override the SA credentials path. */
  saCredentialsPath?: string;
}

export interface LoadAuthClientOptionsLocalXlsx extends LoadAuthClientOptions {
  /** Override the local file path (only relevant when mode=local_xlsx). */
  localPath?: string;
}

/** Resolve the right auth client. Three modes coexist; pick via `mode` flag,
 *  ProjectConfig.auth_mode, or auto-detect (SA wins if both Google files present). */
export async function loadAuthClient(
  opts: LoadAuthClientOptionsLocalXlsx = {},
): Promise<AuthClient> {
  const requestedMode = opts.mode;

  if (requestedMode === "local_xlsx") {
    return loadLocalXlsxAuth(opts.localPath);
  }

  if (requestedMode === "oauth_user") {
    return await loadOAuthUserAuth();
  }

  if (requestedMode === "service_account") {
    return loadServiceAccountAuth(opts.saCredentialsPath);
  }

  // Auto-detect: prefer SA file, then OAuth ADC. local_xlsx is opt-in only —
  // never auto-resolved (it's the no-Google-access fallback users pick at
  // bootstrap time, not a default).
  const saPath = resolveCredentialsPath(opts.saCredentialsPath);
  if (existsSync(saPath)) {
    return loadServiceAccountAuth(opts.saCredentialsPath);
  }
  if (existsSync(adcCredentialsPath())) {
    return await loadOAuthUserAuth();
  }
  throw new SheetsError(
    "credentials_missing",
    `Neither service-account credentials at ${saPath} nor ADC at ${adcCredentialsPath()} are present. ` +
      `Pass --auth-mode service_account (after dropping the JSON key), --auth-mode oauth_user ` +
      `(after running 'gcloud auth application-default login'), ` +
      `or --auth-mode local_xlsx (no Google access required — persists to a local .xlsx file).`,
    { sa_path: saPath, adc_path: adcCredentialsPath() },
  );
}

function loadLocalXlsxAuth(explicitPath?: string): AuthClient {
  const filePath = explicitPath && explicitPath.length > 0 ? explicitPath : ".devloop/sheet.xlsx";
  const basename = filePath.split("/").pop() ?? filePath;
  return { kind: "local_xlsx", identity: `local:${basename}`, filePath };
}

function loadServiceAccountAuth(explicitPath?: string): AuthClient {
  const key = loadServiceAccountKey(explicitPath);
  const client = createJwtAuth(key);
  return { kind: "service_account", identity: key.client_email, client };
}

async function loadOAuthUserAuth(): Promise<AuthClient> {
  const adcPath = adcCredentialsPath();
  if (!existsSync(adcPath)) {
    throw new SheetsError(
      "credentials_missing",
      `OAuth user-acting mode requires Application Default Credentials at ${adcPath}.\n` +
        `Run: gcloud auth application-default login`,
      { adc_path: adcPath },
    );
  }

  // Pass the GoogleAuth instance directly to googleapis — it handles the
  // getClient()/refresh dance internally. Avoids type-narrowing pain.
  const googleAuth = new GoogleAuth({ scopes: SHEETS_SCOPES.slice() });
  // Sanity probe: ensure ADC is actually loadable before handing it off.
  try {
    await googleAuth.getClient();
  } catch (e) {
    throw new SheetsError(
      "credentials_missing",
      `Failed to load ADC at ${adcPath}: ${(e as Error).message}. Try re-running 'gcloud auth application-default login'.`,
      { adc_path: adcPath },
    );
  }

  return { kind: "oauth_user", identity: getActiveGcloudAccount(), client: googleAuth };
}

/** Path to gcloud's standard ADC file. Cross-platform. */
export function adcCredentialsPath(): string {
  const fromEnv = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.platform === "win32") {
    return join(
      process.env["APPDATA"] ?? join(homedir(), "AppData", "Roaming"),
      "gcloud",
      "application_default_credentials.json",
    );
  }
  return join(homedir(), ".config", "gcloud", "application_default_credentials.json");
}

function getActiveGcloudAccount(): string {
  try {
    const out = execFileSync("gcloud", ["config", "get-value", "account"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.length > 0 ? out : "unknown@oauth";
  } catch {
    return "unknown@oauth";
  }
}

export function elicitationPromptForOAuthSetup(): string {
  return [
    `OAuth user-acting mode requires Application Default Credentials.`,
    `Run this in your terminal (one-time, browser-based):`,
    ``,
    `    gcloud auth application-default login`,
    ``,
    `Then reply 'ready' and I'll resume.`,
  ].join("\n");
}

function assertServiceAccountKey(value: unknown, path: string): ServiceAccountKey {
  if (typeof value !== "object" || value === null) {
    throw new SheetsError("credentials_missing", `credentials at ${path} is not an object`, {
      path,
    });
  }
  const v = value as Record<string, unknown>;
  if (v["type"] !== "service_account") {
    throw new SheetsError(
      "credentials_missing",
      `credentials at ${path}: type must be 'service_account', got ${String(v["type"])}`,
      { path },
    );
  }
  if (typeof v["client_email"] !== "string" || (v["client_email"] as string).length === 0) {
    throw new SheetsError("credentials_missing", `credentials at ${path}: missing client_email`, {
      path,
    });
  }
  if (typeof v["private_key"] !== "string" || (v["private_key"] as string).length === 0) {
    throw new SheetsError("credentials_missing", `credentials at ${path}: missing private_key`, {
      path,
    });
  }
  const out: ServiceAccountKey = {
    type: "service_account",
    client_email: v["client_email"] as string,
    private_key: v["private_key"] as string,
  };
  if (typeof v["project_id"] === "string") out.project_id = v["project_id"] as string;
  return out;
}

export function elicitationPromptForMissingCredentials(): string {
  const path = resolveCredentialsPath();
  return [
    `Google service-account credentials not found at ${path}.`,
    `Place the service-account JSON key at the path above, or set DEVLOOP_GOOGLE_CREDENTIALS to its location.`,
    ``,
    `First-time setup? See sheets-sync/references/google-sheets-setup.md (7 steps, ~10–15 min).`,
    `Or ask Claude Code: "Walk me through the Google Sheets setup."`,
  ].join("\n");
}
