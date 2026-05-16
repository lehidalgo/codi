import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseYaml } from "yaml";

import {
  readPreferences,
  writePreferences,
  preferencesYamlPath,
  preferencesJsonPath,
  migratePreferencesToYaml,
  DEFAULT_PREFERENCES,
  PREFERENCES_YAML_RELATIVE_PATH,
  PREFERENCES_JSON_RELATIVE_PATH,
} from "#src/runtime/preferences.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "codi-prefs-"));
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

  it("reads the configured output_mode when set to normal (YAML)", () => {
    mkdirSync(join(cwd, ".codi"), { recursive: true });
    writeFileSync(join(cwd, ".codi", "preferences.yaml"), "output_mode: normal\n");
    expect(readPreferences(cwd).output_mode).toBe("normal");
  });

  it("falls back to default when output_mode is invalid", () => {
    mkdirSync(join(cwd, ".codi"), { recursive: true });
    writeFileSync(join(cwd, ".codi", "preferences.yaml"), "output_mode: shouting\n");
    expect(readPreferences(cwd).output_mode).toBe("caveman");
  });

  it("returns defaults on malformed YAML without throwing", () => {
    mkdirSync(join(cwd, ".codi"), { recursive: true });
    writeFileSync(join(cwd, ".codi", "preferences.yaml"), ":\n  : : not\n: valid yaml");
    expect(readPreferences(cwd).output_mode).toBe("caveman");
  });

  it("reads legacy preferences.json when no YAML file exists", () => {
    mkdirSync(join(cwd, ".codi"), { recursive: true });
    writeFileSync(
      join(cwd, ".codi", "preferences.json"),
      JSON.stringify({ output_mode: "normal" }),
    );
    expect(readPreferences(cwd).output_mode).toBe("normal");
  });
});

describe("preferences / writePreferences", () => {
  it("creates .codi/preferences.yaml on first write", () => {
    writePreferences(cwd, { output_mode: "normal" });
    expect(existsSync(preferencesYamlPath(cwd))).toBe(true);
    expect(readPreferences(cwd).output_mode).toBe("normal");
  });

  it("merges with existing keys instead of clobbering", () => {
    writePreferences(cwd, { output_mode: "normal", docs_dir: "documentation/" });
    writePreferences(cwd, { output_mode: "caveman" });
    const onDisk = parseYaml(readFileSync(preferencesYamlPath(cwd), "utf8")) as Record<
      string,
      unknown
    >;
    expect(onDisk["output_mode"]).toBe("caveman");
    expect(onDisk["docs_dir"]).toBe("documentation/");
  });
});

describe("preferences / paths", () => {
  it("preferencesYamlPath returns .codi/preferences.yaml relative to cwd", () => {
    expect(preferencesYamlPath(cwd)).toBe(join(cwd, PREFERENCES_YAML_RELATIVE_PATH));
  });

  it("preferencesJsonPath returns .codi/preferences.json relative to cwd", () => {
    expect(preferencesJsonPath(cwd)).toBe(join(cwd, PREFERENCES_JSON_RELATIVE_PATH));
  });
});

describe("preferences / migratePreferencesToYaml", () => {
  it("converts JSON to YAML when only JSON exists", () => {
    mkdirSync(join(cwd, ".codi"), { recursive: true });
    writeFileSync(
      join(cwd, ".codi", "preferences.json"),
      JSON.stringify({ output_mode: "normal", docs_dir: "docs/v2" }),
    );
    const written = migratePreferencesToYaml(cwd);
    expect(written).toBe(preferencesYamlPath(cwd));
    expect(existsSync(preferencesYamlPath(cwd))).toBe(true);
    expect(readPreferences(cwd).output_mode).toBe("normal");
    expect(readPreferences(cwd).docs_dir).toBe("docs/v2");
  });

  it("returns null when YAML already exists", () => {
    mkdirSync(join(cwd, ".codi"), { recursive: true });
    writeFileSync(join(cwd, ".codi", "preferences.yaml"), "output_mode: normal\n");
    writeFileSync(
      join(cwd, ".codi", "preferences.json"),
      JSON.stringify({ output_mode: "caveman" }),
    );
    expect(migratePreferencesToYaml(cwd)).toBeNull();
  });

  it("returns null when neither file exists", () => {
    expect(migratePreferencesToYaml(cwd)).toBeNull();
  });
});
