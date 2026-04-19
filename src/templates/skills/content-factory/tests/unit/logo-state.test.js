import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  readLogoState,
  writeLogoState,
  sanitizeLogoState,
} = require("#src/templates/skills/content-factory/scripts/lib/logo-state.cjs");

let projectDir;

beforeEach(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-logo-state-"));
  fs.mkdirSync(path.join(projectDir, "state"), { recursive: true });
});

afterEach(() => {
  if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("readLogoState", () => {
  it("returns null when the state file does not exist", () => {
    expect(readLogoState(projectDir, "document/onepager.html")).toBeNull();
  });

  it("returns null when the file is malformed JSON", () => {
    fs.writeFileSync(path.join(projectDir, "state", "logo-state.json"), "{ not json");
    expect(readLogoState(projectDir, "document/onepager.html")).toBeNull();
  });

  it("returns null when the requested file has no entry", () => {
    fs.writeFileSync(
      path.join(projectDir, "state", "logo-state.json"),
      JSON.stringify({ "other/file.html": { logo: {}, cardLogos: {} } }),
    );
    expect(readLogoState(projectDir, "document/onepager.html")).toBeNull();
  });

  it("returns the stored state for the requested file", () => {
    const payload = {
      logo: { visible: true, size: 64, x: 85, y: 5, userOverridden: false },
      cardLogos: { 0: { y: 5 }, 1: { size: 120 } },
    };
    fs.writeFileSync(
      path.join(projectDir, "state", "logo-state.json"),
      JSON.stringify({ "document/onepager.html": payload }),
    );
    expect(readLogoState(projectDir, "document/onepager.html")).toEqual(payload);
  });
});

describe("writeLogoState", () => {
  it("creates the state directory if missing", () => {
    fs.rmSync(path.join(projectDir, "state"), { recursive: true, force: true });
    writeLogoState(projectDir, "document/onepager.html", {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: {},
    });
    expect(fs.existsSync(path.join(projectDir, "state", "logo-state.json"))).toBe(true);
  });

  it("round-trips a single file entry", () => {
    const payload = {
      logo: { visible: true, size: 64, x: 85, y: 5, userOverridden: true },
      cardLogos: { 0: { y: 5 } },
    };
    writeLogoState(projectDir, "document/onepager.html", payload);
    expect(readLogoState(projectDir, "document/onepager.html")).toEqual(payload);
  });

  it("preserves unrelated file entries when updating one", () => {
    writeLogoState(projectDir, "document/a.html", {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: { 0: { y: 5 } },
    });
    writeLogoState(projectDir, "document/b.html", {
      logo: { visible: true, size: 128, x: 50, y: 50, userOverridden: true },
      cardLogos: {},
    });
    expect(readLogoState(projectDir, "document/a.html").cardLogos).toEqual({ 0: { y: 5 } });
    expect(readLogoState(projectDir, "document/b.html").logo.size).toBe(128);
  });

  it("overwrites a file's existing entry atomically", () => {
    writeLogoState(projectDir, "document/a.html", {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: { 0: { y: 5 } },
    });
    writeLogoState(projectDir, "document/a.html", {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: { 0: { y: 95 } },
    });
    expect(readLogoState(projectDir, "document/a.html").cardLogos).toEqual({ 0: { y: 95 } });
  });

  it("leaves no temp files behind after a successful write", () => {
    writeLogoState(projectDir, "document/a.html", {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: {},
    });
    const files = fs.readdirSync(path.join(projectDir, "state"));
    expect(files.every((f) => !f.endsWith(".tmp"))).toBe(true);
  });
});

describe("sanitizeLogoState", () => {
  it("drops cardLogos keys beyond the current card count", () => {
    const input = {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: { 0: { y: 5 }, 1: { y: 10 }, 5: { y: 50 } },
    };
    const out = sanitizeLogoState(input, { cardCount: 2 });
    expect(Object.keys(out.cardLogos)).toEqual(["0", "1"]);
  });

  it("drops non-numeric cardLogos keys", () => {
    const input = {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: { 0: { y: 5 }, abc: { y: 10 } },
    };
    const out = sanitizeLogoState(input, { cardCount: 3 });
    expect(Object.keys(out.cardLogos)).toEqual(["0"]);
  });

  it("coerces malformed logo fields to defaults", () => {
    const input = { logo: { size: "big", x: "left" }, cardLogos: {} };
    const out = sanitizeLogoState(input, { cardCount: 3 });
    expect(typeof out.logo.size).toBe("number");
    expect(typeof out.logo.x).toBe("number");
    expect(typeof out.logo.visible).toBe("boolean");
  });

  it("returns a valid shape even for entirely null input", () => {
    const out = sanitizeLogoState(null, { cardCount: 3 });
    expect(out).toHaveProperty("logo");
    expect(out).toHaveProperty("cardLogos");
    expect(out.cardLogos).toEqual({});
  });

  it("preserves valid cardLogos partial overrides", () => {
    const input = {
      logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
      cardLogos: { 0: { y: 5 }, 1: { size: 120, x: 72 } },
    };
    const out = sanitizeLogoState(input, { cardCount: 5 });
    expect(out.cardLogos).toEqual({ 0: { y: 5 }, 1: { size: 120, x: 72 } });
  });
});

describe("path traversal safety", () => {
  it("readLogoState refuses paths with .. segments", () => {
    expect(readLogoState(projectDir, "../escape.html")).toBeNull();
  });

  it("writeLogoState refuses paths with .. segments", () => {
    expect(() =>
      writeLogoState(projectDir, "../escape.html", {
        logo: { visible: true, size: 64, x: 85, y: 15, userOverridden: false },
        cardLogos: {},
      }),
    ).toThrow(/invalid file path/);
  });

  it("refuses absolute paths", () => {
    expect(readLogoState(projectDir, "/etc/passwd")).toBeNull();
    expect(() => writeLogoState(projectDir, "/etc/passwd", { logo: {}, cardLogos: {} })).toThrow(
      /invalid file path/,
    );
  });

  it("refuses empty file param", () => {
    expect(readLogoState(projectDir, "")).toBeNull();
    expect(() => writeLogoState(projectDir, "", { logo: {}, cardLogos: {} })).toThrow(
      /invalid file path/,
    );
  });
});
