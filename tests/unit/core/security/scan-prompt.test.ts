import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../../../../src/core/output/logger.js";
import { shouldBlockInstall } from "../../../../src/core/security/scan-prompt.js";
import type { ScanReport } from "../../../../src/core/security/content-scanner.js";

function makeReport(
  verdict: ScanReport["verdict"],
  overrides?: Partial<ScanReport>,
): ScanReport {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  if (verdict === "critical") summary.critical = 1;
  if (verdict === "high") summary.high = 1;
  if (verdict === "medium") summary.medium = 1;
  if (verdict === "low") summary.low = 1;

  return {
    target: "/tmp/test",
    scannedAt: new Date().toISOString(),
    filesScanned: 1,
    verdict,
    findings: [],
    summary,
    ...overrides,
  };
}

beforeEach(() => {
  Logger.init({ level: "error", mode: "human", noColor: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shouldBlockInstall", () => {
  it("returns true for critical verdict", () => {
    expect(shouldBlockInstall(makeReport("critical"))).toBe(true);
  });

  it("returns true for high verdict", () => {
    expect(shouldBlockInstall(makeReport("high"))).toBe(true);
  });

  it("returns false for medium verdict", () => {
    expect(shouldBlockInstall(makeReport("medium"))).toBe(false);
  });

  it("returns false for low verdict", () => {
    expect(shouldBlockInstall(makeReport("low"))).toBe(false);
  });

  it("returns false for pass verdict", () => {
    expect(shouldBlockInstall(makeReport("pass"))).toBe(false);
  });
});
