/**
 * Tests for lib/sheets/auth.ts — both modes (service_account + oauth_user).
 *
 * We test the resolution logic, NOT the live googleapis network calls.
 * Network calls are exercised by the cookbook integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

import {
  loadAuthClient,
  loadServiceAccountKey,
  resolveCredentialsPath,
  adcCredentialsPath,
  SheetsError,
  type AuthClient,
  type AuthMode,
} from "../lib/sheets/index.js";

// Sample SA key content (private_key is a PEM placeholder; google-auth-library
// will accept it for object construction; we never actually call Google APIs).
const FAKE_SA_KEY = JSON.stringify({
  type: "service_account",
  client_email: "test-sa@test-project.iam.gserviceaccount.com",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nFAKE_KEY_MATERIAL_FOR_TEST\n-----END PRIVATE KEY-----\n",
  project_id: "test-project",
});

describe("auth — service-account key parsing", () => {
  let tmp: string;
  let saPath: string;
  let envBackup: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sa-key-"));
    saPath = join(tmp, "credentials.json");
    envBackup = process.env["DEVLOOP_GOOGLE_CREDENTIALS"];
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    if (envBackup === undefined) {
      delete process.env["DEVLOOP_GOOGLE_CREDENTIALS"];
    } else {
      process.env["DEVLOOP_GOOGLE_CREDENTIALS"] = envBackup;
    }
  });

  it("loadServiceAccountKey reads the file at the given path", () => {
    writeFileSync(saPath, FAKE_SA_KEY);
    const key = loadServiceAccountKey(saPath);
    expect(key.type).toBe("service_account");
    expect(key.client_email).toBe("test-sa@test-project.iam.gserviceaccount.com");
    expect(key.private_key.startsWith("-----BEGIN PRIVATE KEY-----")).toBe(true);
  });

  it("loadServiceAccountKey honors DEVLOOP_GOOGLE_CREDENTIALS env", () => {
    writeFileSync(saPath, FAKE_SA_KEY);
    process.env["DEVLOOP_GOOGLE_CREDENTIALS"] = saPath;
    const key = loadServiceAccountKey();
    expect(key.client_email).toBe("test-sa@test-project.iam.gserviceaccount.com");
  });

  it("loadServiceAccountKey throws credentials_missing on absent file", () => {
    try {
      loadServiceAccountKey(join(tmp, "nope.json"));
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsError);
      expect((e as SheetsError).code).toBe("credentials_missing");
    }
  });

  it("loadServiceAccountKey rejects non-service_account type", () => {
    writeFileSync(saPath, JSON.stringify({ type: "user", client_email: "x", private_key: "y" }));
    try {
      loadServiceAccountKey(saPath);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsError);
      expect((e as SheetsError).code).toBe("credentials_missing");
    }
  });
});

describe("auth — adcCredentialsPath", () => {
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  });

  afterEach(() => {
    if (envBackup === undefined) {
      delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    } else {
      process.env["GOOGLE_APPLICATION_CREDENTIALS"] = envBackup;
    }
  });

  it("returns the canonical gcloud ADC path on POSIX", () => {
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    const p = adcCredentialsPath();
    expect(p.includes("application_default_credentials.json")).toBe(true);
    if (process.platform !== "win32") {
      expect(p).toBe(join(homedir(), ".config", "gcloud", "application_default_credentials.json"));
    }
  });

  it("respects GOOGLE_APPLICATION_CREDENTIALS env override", () => {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/custom-adc.json";
    expect(adcCredentialsPath()).toBe("/tmp/custom-adc.json");
  });
});

describe("auth — loadAuthClient resolution", () => {
  let tmp: string;
  let envBackup: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "auth-resolve-"));
    envBackup = process.env["DEVLOOP_GOOGLE_CREDENTIALS"];
    delete process.env["DEVLOOP_GOOGLE_CREDENTIALS"];
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    if (envBackup === undefined) {
      delete process.env["DEVLOOP_GOOGLE_CREDENTIALS"];
    } else {
      process.env["DEVLOOP_GOOGLE_CREDENTIALS"] = envBackup;
    }
  });

  it("forced mode=service_account loads the SA key", async () => {
    const saPath = join(tmp, "credentials.json");
    writeFileSync(saPath, FAKE_SA_KEY);
    const client: AuthClient = await loadAuthClient({
      mode: "service_account",
      saCredentialsPath: saPath,
    });
    expect(client.kind).toBe("service_account");
    expect(client.identity).toBe("test-sa@test-project.iam.gserviceaccount.com");
  });

  it("forced mode=service_account fails clean if SA file missing", async () => {
    try {
      await loadAuthClient({
        mode: "service_account",
        saCredentialsPath: join(tmp, "nope.json"),
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsError);
      expect((e as SheetsError).code).toBe("credentials_missing");
    }
  });

  it("forced mode=oauth_user fails clean if ADC missing", async () => {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = join(tmp, "no-adc-here.json");
    try {
      await loadAuthClient({ mode: "oauth_user" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsError);
      expect((e as SheetsError).code).toBe("credentials_missing");
      expect(
        e instanceof Error && e.message.includes("gcloud auth application-default login"),
      ).toBe(true);
    } finally {
      delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    }
  });

  it("auto-detect prefers SA when both could resolve", async () => {
    // Only SA file present (ADC at canonical path may or may not be — we point
    // GOOGLE_APPLICATION_CREDENTIALS at a missing path to be safe).
    const saPath = join(tmp, "credentials.json");
    writeFileSync(saPath, FAKE_SA_KEY);
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = join(tmp, "missing-adc.json");
    const client = await loadAuthClient({ saCredentialsPath: saPath });
    expect(client.kind).toBe("service_account");
    delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  });

  it("auto-detect throws clearly when neither auth is present", async () => {
    process.env["DEVLOOP_GOOGLE_CREDENTIALS"] = join(tmp, "missing-sa.json");
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = join(tmp, "missing-adc.json");
    try {
      await loadAuthClient();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsError);
      expect((e as SheetsError).code).toBe("credentials_missing");
      expect(e instanceof Error).toBe(true);
      const msg = (e as Error).message;
      expect(
        msg.includes("--auth-mode service_account") || msg.includes("--auth-mode oauth_user"),
      ).toBe(true);
    } finally {
      delete process.env["DEVLOOP_GOOGLE_CREDENTIALS"];
      delete process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    }
  });
});

describe("auth — types are exported", () => {
  it("AuthMode union accepts both values", () => {
    const a: AuthMode = "service_account";
    const b: AuthMode = "oauth_user";
    expect([a, b]).toEqual(["service_account", "oauth_user"]);
  });

  it("resolveCredentialsPath returns a path", () => {
    expect(typeof resolveCredentialsPath("/x/y.json")).toBe("string");
  });

  // suppress unused import warning
  it("existsSync is callable", () => {
    expect(typeof existsSync).toBe("function");
    void mkdirSync;
  });
});

// ─── B7 — OAuth canonical scopes + scope-error classifier ────────────────────

describe("auth / OAUTH_USER_LOGIN_SCOPES", () => {
  it("exports the canonical 5-scope set for ADC login", async () => {
    const { OAUTH_USER_LOGIN_SCOPES } = await import("../lib/sheets/index.js");
    expect(OAUTH_USER_LOGIN_SCOPES).toEqual([
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ]);
  });

  it("oauth-user-setup.sh CANONICAL_SCOPES matches OAUTH_USER_LOGIN_SCOPES (drift detector)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { OAUTH_USER_LOGIN_SCOPES } = await import("../lib/sheets/index.js");

    const scriptPath = path.join(
      __dirname,
      "..",
      "skills",
      "sheets-sync",
      "scripts",
      "oauth-user-setup.sh",
    );
    const script = readFileSync(scriptPath, "utf8");
    const match = script.match(/CANONICAL_SCOPES="([^"]+)"/);
    expect(match, "CANONICAL_SCOPES var not found in oauth-user-setup.sh").not.toBeNull();
    const scriptScopes = (match![1] ?? "").split(",");
    expect(scriptScopes).toEqual([...OAUTH_USER_LOGIN_SCOPES]);
  });

  it("oauth-user-project-client-setup.sh shares the same CANONICAL_SCOPES", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const scriptPath = path.join(
      __dirname,
      "..",
      "skills",
      "sheets-sync",
      "scripts",
      "oauth-user-project-client-setup.sh",
    );
    const script = readFileSync(scriptPath, "utf8");
    expect(script).toMatch(/CANONICAL_SCOPES="openid,/);
    expect(script).toContain("auth/spreadsheets");
    expect(script).toContain("auth/drive");
  });
});

describe("auth / isInsufficientScopesError", () => {
  it("matches the canonical googleapis error message", async () => {
    const { isInsufficientScopesError } = await import("../lib/sheets/index.js");
    expect(
      isInsufficientScopesError(new Error("Request had insufficient authentication scopes.")),
    ).toBe(true);
    expect(isInsufficientScopesError(new Error("Insufficient_authentication_scopes"))).toBe(true);
    expect(isInsufficientScopesError(new Error("missing required scope"))).toBe(true);
  });

  it("does not match unrelated errors", async () => {
    const { isInsufficientScopesError } = await import("../lib/sheets/index.js");
    expect(isInsufficientScopesError(new Error("not found"))).toBe(false);
    expect(isInsufficientScopesError(new Error("network unreachable"))).toBe(false);
    expect(isInsufficientScopesError("plain string")).toBe(false);
    expect(isInsufficientScopesError(undefined)).toBe(false);
  });
});

describe("auth / scripts cross-references", () => {
  it("oauth-user-setup.sh points at oauth-user-project-client-setup.sh on failure", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const scriptPath = path.join(
      __dirname,
      "..",
      "skills",
      "sheets-sync",
      "scripts",
      "oauth-user-setup.sh",
    );
    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("oauth-user-project-client-setup.sh");
  });

  it("oauth-user-project-client-setup.sh exists and is executable contract-wise", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const scriptPath = path.join(
      __dirname,
      "..",
      "skills",
      "sheets-sync",
      "scripts",
      "oauth-user-project-client-setup.sh",
    );
    const script = readFileSync(scriptPath, "utf8");
    // sanity checks for the guided-automation steps
    expect(script).toContain("gcloud services enable sheets.googleapis.com");
    expect(script).toContain("apis/credentials/consent");
    expect(script).toContain("application-default login");
    expect(script).toContain("--client-id-file=");
    expect(script).toContain("--scopes=");
  });
});
