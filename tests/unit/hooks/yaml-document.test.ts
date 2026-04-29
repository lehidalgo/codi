import { describe, it, expect } from "vitest";
import { isMap, YAMLMap } from "yaml";
import {
  loadOrEmptyDoc,
  findReposNode,
  isCodiManagedRepo,
  setCodiMarker,
  readUserPinnedRev,
  serialize,
  CODI_MARKER,
} from "#src/core/hooks/yaml-document.js";

describe("yaml-document helpers", () => {
  it("loadOrEmptyDoc returns a Document with empty repos when input is empty", () => {
    const doc = loadOrEmptyDoc("");
    const repos = findReposNode(doc);
    expect(repos).toBeDefined();
    expect(repos!.items).toHaveLength(0);
  });

  it("loadOrEmptyDoc preserves existing repos:", () => {
    const yaml = `repos:\n  - repo: https://github.com/x/y\n    rev: v1\n    hooks:\n      - id: foo\n`;
    const doc = loadOrEmptyDoc(yaml);
    const repos = findReposNode(doc);
    expect(repos!.items).toHaveLength(1);
  });

  it("loadOrEmptyDoc adds repos: when missing", () => {
    const yaml = "default_stages: [pre-commit]\n";
    const doc = loadOrEmptyDoc(yaml);
    const repos = findReposNode(doc);
    expect(repos).toBeDefined();
    expect(repos!.items).toHaveLength(0);
  });

  it("loadOrEmptyDoc throws on malformed YAML", () => {
    expect(() => loadOrEmptyDoc(": :: not yaml :::\n  - nested wrong")).toThrow(/yaml parse/);
  });

  it("isCodiManagedRepo recognizes the marker comment", () => {
    const yaml = `repos:\n  - repo: https://github.com/x/y    # ${CODI_MARKER}\n    rev: v1\n    hooks:\n      - id: foo\n`;
    const doc = loadOrEmptyDoc(yaml);
    const repos = findReposNode(doc);
    expect(isCodiManagedRepo(repos!.items[0]!)).toBe(true);
  });

  it("isCodiManagedRepo returns false when no marker", () => {
    const yaml = `repos:\n  - repo: https://github.com/x/y\n    rev: v1\n    hooks:\n      - id: foo\n`;
    const doc = loadOrEmptyDoc(yaml);
    const repos = findReposNode(doc);
    expect(isCodiManagedRepo(repos!.items[0]!)).toBe(false);
  });

  it("setCodiMarker adds the marker, then isCodiManagedRepo finds it", () => {
    const map = new YAMLMap();
    map.set("repo", "https://github.com/x/y");
    map.set("rev", "v1");
    setCodiMarker(map);
    expect(isCodiManagedRepo(map)).toBe(true);
  });

  it("readUserPinnedRev returns the rev string when present", () => {
    const yaml = `repos:\n  - repo: https://github.com/x/y    # ${CODI_MARKER}\n    rev: v1.2.3\n`;
    const doc = loadOrEmptyDoc(yaml);
    const repos = findReposNode(doc);
    const item = repos!.items[0]!;
    if (isMap(item)) {
      expect(readUserPinnedRev(item)).toBe("v1.2.3");
    }
  });

  it("serialize produces output ending in exactly one newline", () => {
    const doc = loadOrEmptyDoc("repos:\n  - repo: local\n");
    const out = serialize(doc);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});
