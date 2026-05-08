import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readProjectConfig,
  writeProjectConfig,
  tryReadProjectConfig,
} from "../lib/sheets/config.js";
import { SheetsError } from "../lib/sheets/types.js";
import type { ProjectConfig } from "../lib/sheets/types.js";

function freshTmp(): string {
  return mkdtempSync(join(tmpdir(), "devloop-config-test-"));
}

function writeRaw(cwd: string, raw: object): void {
  mkdirSync(join(cwd, ".devloop"), { recursive: true });
  writeFileSync(join(cwd, ".devloop", "project.json"), JSON.stringify(raw, null, 2), "utf8");
}

describe("readProjectConfig — auth_mode validation", () => {
  it("accepts auth_mode='service_account'", () => {
    const cwd = freshTmp();
    try {
      writeRaw(cwd, {
        project_name: "p",
        sheet_id: "1abc",
        sheet_template_version: 1,
        created_at: "2026-05-03T00:00:00Z",
        created_by: "u@x",
        auth_mode: "service_account",
      });
      const cfg = readProjectConfig(cwd);
      expect(cfg.auth_mode).toBe("service_account");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("accepts auth_mode='oauth_user'", () => {
    const cwd = freshTmp();
    try {
      writeRaw(cwd, {
        project_name: "p",
        sheet_id: "1abc",
        sheet_template_version: 1,
        created_at: "2026-05-03T00:00:00Z",
        created_by: "u@x",
        auth_mode: "oauth_user",
      });
      const cfg = readProjectConfig(cwd);
      expect(cfg.auth_mode).toBe("oauth_user");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("accepts auth_mode='local_xlsx' when local_path is set (regression: rejected before fix)", () => {
    const cwd = freshTmp();
    try {
      writeRaw(cwd, {
        project_name: "acme-local",
        sheet_id: "local:sheet.xlsx",
        sheet_template_version: 1,
        created_at: "2026-05-03T00:00:00Z",
        created_by: "u@x",
        auth_mode: "local_xlsx",
        local_path: "/tmp/x/.devloop/sheet.xlsx",
      });
      const cfg = readProjectConfig(cwd);
      expect(cfg.auth_mode).toBe("local_xlsx");
      expect(cfg.local_path).toBe("/tmp/x/.devloop/sheet.xlsx");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects auth_mode='local_xlsx' when local_path is missing", () => {
    const cwd = freshTmp();
    try {
      writeRaw(cwd, {
        project_name: "p",
        sheet_id: "local:sheet.xlsx",
        sheet_template_version: 1,
        created_at: "2026-05-03T00:00:00Z",
        created_by: "u@x",
        auth_mode: "local_xlsx",
      });
      expect(() => readProjectConfig(cwd)).toThrowError(/local_path.*required/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects unknown auth_mode values", () => {
    const cwd = freshTmp();
    try {
      writeRaw(cwd, {
        project_name: "p",
        sheet_id: "x",
        sheet_template_version: 1,
        created_at: "2026-05-03T00:00:00Z",
        created_by: "u@x",
        auth_mode: "supabase",
      });
      expect(() => readProjectConfig(cwd)).toThrow(SheetsError);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects non-string local_path", () => {
    const cwd = freshTmp();
    try {
      writeRaw(cwd, {
        project_name: "p",
        sheet_id: "x",
        sheet_template_version: 1,
        created_at: "2026-05-03T00:00:00Z",
        created_by: "u@x",
        local_path: 42,
      });
      expect(() => readProjectConfig(cwd)).toThrowError(/local_path.*string/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("readProjectConfig — round-trip via writeProjectConfig", () => {
  it("round-trips a local_xlsx config faithfully (regression for the v0.9.0 gap)", () => {
    const cwd = freshTmp();
    try {
      const original: ProjectConfig = {
        project_name: "acme-local",
        sheet_id: "local:sheet.xlsx",
        sheet_template_version: 1,
        local_path: join(cwd, ".devloop", "sheet.xlsx"),
        created_at: "2026-05-03T00:00:00Z",
        created_by: "u@x",
        auth_mode: "local_xlsx",
      };
      writeProjectConfig(cwd, original);
      const back = readProjectConfig(cwd);
      expect(back).toEqual(original);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("tryReadProjectConfig returns null on missing file (config_missing is swallowed)", () => {
    const cwd = freshTmp();
    try {
      expect(tryReadProjectConfig(cwd)).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
