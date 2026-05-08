import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const LINTER = join(__dirname, "..", "scripts", "validators", "recommend-pattern.py");

function runLinter(args: string[] = []): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync("python3", [LINTER, ...args], { encoding: "utf8" });
    return { stdout, exitCode: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
  }
}

describe("recommend-pattern linter", () => {
  it("passes on the current repo (every elicitation file has Recommend X because Y)", () => {
    const { stdout, exitCode } = runLinter();
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/✓ recommend-pattern/);
  });

  it("flags a synthetic file with a question lacking the recommendation pattern", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const os = require("node:os") as typeof import("node:os");
    const path = require("node:path") as typeof import("node:path");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lint-test-"));
    const file = path.join(tmp, "phase-bad.md");
    fs.writeFileSync(file, `# Phase X\n\n## Should we proceed?\n\nGo for it.\n`);
    try {
      const { stdout, exitCode } = runLinter([file]);
      expect(exitCode).toBe(1);
      expect(stdout).toMatch(/Should we proceed\?/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts the canonical pattern: 'Recommended: X because Y'", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const os = require("node:os") as typeof import("node:os");
    const path = require("node:path") as typeof import("node:path");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lint-test-"));
    const file = path.join(tmp, "phase-good.md");
    fs.writeFileSync(
      file,
      `# Phase Y\n\n## Should we proceed?\n\n**Recommended:** yes because the gate has cleared.\n`,
    );
    try {
      const { exitCode } = runLinter([file]);
      expect(exitCode).toBe(0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts the alternative pattern: 'Default: X (because Y)'", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const os = require("node:os") as typeof import("node:os");
    const path = require("node:path") as typeof import("node:path");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lint-test-"));
    const file = path.join(tmp, "phase-default.md");
    fs.writeFileSync(
      file,
      `# Phase Z\n\n## What credentials path?\n\nDefault: \`~/.config/devloop/credentials.json\` (because that's where gcloud-setup writes).\n`,
    );
    try {
      const { exitCode } = runLinter([file]);
      expect(exitCode).toBe(0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
