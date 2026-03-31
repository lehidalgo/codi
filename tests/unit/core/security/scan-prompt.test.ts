import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "#src/core/output/logger.js";
import {
  shouldBlockInstall,
  promptSecurityFindings,
} from "#src/core/security/scan-prompt.js";
import type {
  ScanReport,
  ScanFinding,
} from "#src/core/security/content-scanner.js";

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

describe("promptSecurityFindings (non-interactive)", () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = undefined as unknown as boolean;
  });

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY as true;
  });

  const makeFinding = (
    severity: ScanFinding["severity"],
    overrides?: Partial<ScanFinding>,
  ): ScanFinding => ({
    severity,
    category: "secrets",
    file: "config.ts",
    pattern: "API_KEY",
    description: "Hardcoded API key",
    ...overrides,
  });

  it("blocks on critical findings in non-interactive mode", async () => {
    const report = makeReport("critical", {
      findings: [makeFinding("critical")],
      summary: { critical: 1, high: 0, medium: 0, low: 0 },
    });
    const result = await promptSecurityFindings(report);
    expect(result).toBe(false);
  });

  it("blocks on high findings in non-interactive mode", async () => {
    const report = makeReport("high", {
      findings: [makeFinding("high")],
      summary: { critical: 0, high: 1, medium: 0, low: 0 },
    });
    const result = await promptSecurityFindings(report);
    expect(result).toBe(false);
  });

  it("proceeds on medium findings in non-interactive mode", async () => {
    const report = makeReport("medium", {
      findings: [makeFinding("medium")],
      summary: { critical: 0, high: 0, medium: 1, low: 0 },
    });
    const result = await promptSecurityFindings(report);
    expect(result).toBe(true);
  });

  it("proceeds on low findings in non-interactive mode", async () => {
    const report = makeReport("low", {
      findings: [makeFinding("low")],
      summary: { critical: 0, high: 0, medium: 0, low: 1 },
    });
    const result = await promptSecurityFindings(report);
    expect(result).toBe(true);
  });

  it("formats findings with line numbers when present", async () => {
    const warnSpy = vi.spyOn(Logger.getInstance(), "warn");
    const report = makeReport("medium", {
      findings: [makeFinding("medium", { line: 42 })],
      summary: { critical: 0, high: 0, medium: 1, low: 0 },
    });
    await promptSecurityFindings(report);

    const findingLog = warnSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("config.ts:42"),
    );
    expect(findingLog).toBeDefined();
  });

  it("formats summary with multiple severity counts", async () => {
    const warnSpy = vi.spyOn(Logger.getInstance(), "warn");
    const report = makeReport("medium", {
      findings: [makeFinding("medium"), makeFinding("low")],
      summary: { critical: 0, high: 0, medium: 1, low: 1 },
    });
    await promptSecurityFindings(report);

    const summaryLog = warnSpy.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("medium") &&
        call[0].includes("low"),
    );
    expect(summaryLog).toBeDefined();
  });
});
