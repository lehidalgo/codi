/**
 * Interactive prompt for security scan findings.
 *
 * Displays findings to the user and asks whether to proceed.
 * In non-interactive mode, auto-blocks on critical/high and
 * auto-proceeds with warnings on medium/low.
 */

import * as p from "@clack/prompts";
import { Logger } from "../output/logger.js";
import type { ScanReport, ScanFinding } from "./content-scanner.js";
import type { ScanSeverity } from "./scan-patterns.js";

const SEVERITY_LABELS: Record<ScanSeverity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

function formatFinding(finding: ScanFinding): string {
  const label = SEVERITY_LABELS[finding.severity].padEnd(8);
  const location = finding.line
    ? `${finding.file}:${finding.line}`
    : finding.file;
  return `  ${label}  ${location.padEnd(30)}  ${finding.category.padEnd(20)}  ${finding.description}`;
}

function formatSummary(report: ScanReport): string {
  const parts: string[] = [];
  if (report.summary.critical > 0)
    parts.push(`${report.summary.critical} critical`);
  if (report.summary.high > 0) parts.push(`${report.summary.high} high`);
  if (report.summary.medium > 0) parts.push(`${report.summary.medium} medium`);
  if (report.summary.low > 0) parts.push(`${report.summary.low} low`);
  return parts.join(", ");
}

/**
 * Returns true if installation should be blocked (critical or high findings).
 */
export function shouldBlockInstall(report: ScanReport): boolean {
  return report.verdict === "critical" || report.verdict === "high";
}

/**
 * Display security findings and prompt the user to proceed.
 *
 * @returns true to proceed with installation, false to block.
 */
export async function promptSecurityFindings(
  report: ScanReport,
): Promise<boolean> {
  const log = Logger.getInstance();
  const isInteractive = process.stdout.isTTY === true;

  // Display findings
  log.warn(`Security scan found issues:`);
  log.warn("");
  for (const finding of report.findings) {
    log.warn(formatFinding(finding));
  }
  log.warn("");
  log.warn(`  Summary: ${formatSummary(report)}`);
  log.warn("");

  // Non-interactive mode: auto-decide based on severity
  if (!isInteractive) {
    if (shouldBlockInstall(report)) {
      log.error(
        "Blocked: critical or high severity findings in non-interactive mode.",
      );
      return false;
    }
    log.warn("Proceeding with medium/low findings in non-interactive mode.");
    return true;
  }

  // Interactive mode: prompt the user
  const proceed = await p.confirm({
    message: "Proceed despite security findings?",
    initialValue: false,
  });

  if (p.isCancel(proceed)) {
    return false;
  }

  return proceed === true;
}
