import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  writeFitReport,
  readFitReport,
} = require("#src/templates/skills/content-factory/scripts/lib/fit-report.cjs");

function tmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-fr-"));
  fs.mkdirSync(path.join(dir, "state"), { recursive: true });
  return dir;
}

describe("writeFitReport / readFitReport", () => {
  it("persists JSON to state/fit-report.json", () => {
    const project = tmpProject();
    const report = {
      file: "document/onepager.html",
      canvas: { w: 794, h: 1123 },
      measured: { scrollHeight: 1410, scrollWidth: 794 },
      overflowPx: 287,
      overflowPct: 25.6,
      pageIndex: 1,
      remediation: "paginate",
      options: ["paginate", "tighten"],
      directive: "Page 1 exceeds 794x1123 by 287px...",
    };
    writeFitReport(project, report);
    const written = JSON.parse(
      fs.readFileSync(path.join(project, "state", "fit-report.json"), "utf-8"),
    );
    expect(written).toEqual(report);
    expect(readFitReport(project)).toEqual(report);
  });

  it("overwrites existing report on subsequent writes", () => {
    const project = tmpProject();
    writeFitReport(project, { overflowPx: 100, remediation: "paginate" });
    writeFitReport(project, { overflowPx: 0, remediation: "tighten" });
    const written = readFitReport(project);
    expect(written.overflowPx).toBe(0);
    expect(written.remediation).toBe("tighten");
  });

  it("readFitReport returns null when file does not exist", () => {
    const project = tmpProject();
    expect(readFitReport(project)).toBeNull();
  });

  it("creates state/ directory if missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-fr-noatate-"));
    writeFitReport(dir, { overflowPx: 0 });
    expect(fs.existsSync(path.join(dir, "state", "fit-report.json"))).toBe(true);
  });

  it("throws when projectDir is missing", () => {
    expect(() => writeFitReport(null, { overflowPx: 0 })).toThrow();
  });

  it("throws when report is missing", () => {
    const project = tmpProject();
    expect(() => writeFitReport(project, null)).toThrow();
  });
});
