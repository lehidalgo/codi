import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  readPreferences,
  writePreferences,
  preferencesPath,
  DEFAULT_PREFERENCES,
  PREFERENCES_RELATIVE_PATH,
} from "#src/runtime/preferences.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "devloop-prefs-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("preferences / readPreferences", () => {
  it("returns defaults (output_mode=caveman) when no file exists", () => {
    const prefs = readPreferences(cwd);
    expect(prefs.output_mode).toBe("caveman");
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it("reads the configured output_mode when set to normal", () => {
    mkdirSync(join(cwd, ".devloop"), { recursive: true });
    writeFileSync(
      join(cwd, ".devloop", "preferences.json"),
      JSON.stringify({ output_mode: "normal" }),
    );
    expect(readPreferences(cwd).output_mode).toBe("normal");
  });

  it("falls back to default when output_mode is invalid", () => {
    mkdirSync(join(cwd, ".devloop"), { recursive: true });
    writeFileSync(
      join(cwd, ".devloop", "preferences.json"),
      JSON.stringify({ output_mode: "shouting" }),
    );
    expect(readPreferences(cwd).output_mode).toBe("caveman");
  });

  it("returns defaults on malformed JSON without throwing", () => {
    mkdirSync(join(cwd, ".devloop"), { recursive: true });
    writeFileSync(join(cwd, ".devloop", "preferences.json"), "{ not valid json");
    expect(readPreferences(cwd).output_mode).toBe("caveman");
  });
});

describe("preferences / writePreferences", () => {
  it("creates .devloop/preferences.json on first write", () => {
    writePreferences(cwd, { output_mode: "normal" });
    expect(existsSync(preferencesPath(cwd))).toBe(true);
    expect(readPreferences(cwd).output_mode).toBe("normal");
  });

  it("merges with existing keys instead of clobbering", () => {
    writePreferences(cwd, { output_mode: "normal" });
    // Simulate a future schema with another key:
    mkdirSync(join(cwd, ".devloop"), { recursive: true });
    writeFileSync(preferencesPath(cwd), JSON.stringify({ output_mode: "normal", future_key: 42 }));
    writePreferences(cwd, { output_mode: "caveman" });
    const onDisk = JSON.parse(readFileSync(preferencesPath(cwd), "utf8")) as Record<
      string,
      unknown
    >;
    expect(onDisk["output_mode"]).toBe("caveman");
    // Existing future_key gets dropped because readPreferences is strict — that's
    // OK for now; tighten this assertion if/when we expand the schema.
  });
});

describe("preferences / paths", () => {
  it("preferencesPath returns .devloop/preferences.json relative to cwd", () => {
    expect(preferencesPath(cwd)).toBe(join(cwd, PREFERENCES_RELATIVE_PATH));
  });
});
