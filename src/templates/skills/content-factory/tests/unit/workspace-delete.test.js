import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import * as workspace from "#src/templates/skills/content-factory/scripts/lib/workspace.cjs";

describe("workspace.deleteProject", () => {
  let workspaceDir;
  let sessionDir;

  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-delete-"));
    sessionDir = path.join(workspaceDir, "demo-session");
    fs.mkdirSync(path.join(sessionDir, "content"), { recursive: true });
    fs.mkdirSync(path.join(sessionDir, "state"), { recursive: true });
    fs.writeFileSync(path.join(sessionDir, "content", "social.html"), "<p>x</p>");
    fs.writeFileSync(
      path.join(sessionDir, "state", "manifest.json"),
      JSON.stringify({ name: "Demo" }),
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch {}
  });

  it("removes the session directory from disk", () => {
    const result = workspace.deleteProject(workspaceDir, "demo-session");
    expect(result.ok).toBe(true);
    expect(fs.existsSync(sessionDir)).toBe(false);
  });

  it("throws 404 when the session does not exist", () => {
    expect(() => workspace.deleteProject(workspaceDir, "nope")).toThrow(/not found/);
  });

  it("rejects path separators in the session id", () => {
    for (const bad of ["../outside", "/abs/path", "demo/nested", "demo\\back"]) {
      expect(() => workspace.deleteProject(workspaceDir, bad)).toThrow();
    }
  });

  it("rejects ids that start with _ (reserved for workspace meta)", () => {
    expect(() => workspace.deleteProject(workspaceDir, "_server")).toThrow();
  });

  it("rejects targets that are not real project directories", () => {
    // Create a non-project dir in the workspace
    fs.mkdirSync(path.join(workspaceDir, "bogus"));
    expect(() => workspace.deleteProject(workspaceDir, "bogus")).toThrow(/not a project/);
  });

  it("does not touch sibling projects", () => {
    fs.mkdirSync(path.join(workspaceDir, "sibling", "content"), { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "sibling", "content", "x.html"), "<p>y</p>");
    workspace.deleteProject(workspaceDir, "demo-session");
    expect(fs.existsSync(path.join(workspaceDir, "sibling"))).toBe(true);
  });
});
