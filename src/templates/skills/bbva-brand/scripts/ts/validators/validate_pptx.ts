#!/usr/bin/env npx tsx
/**
 * validate_pptx.ts — BBVA brand rule checker for PPTX files.
 *
 * Usage:
 *   npx tsx validate_pptx.ts --input file.pptx
 *
 * Requires: python -m markitdown (for text extraction)
 * Exit code: 0 = all checks pass, 1 = one or more checks fail
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as bt from "../brand_tokens.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  pass: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkFileExists(inputPath: string): CheckResult {
  return {
    name: "file_exists",
    pass: existsSync(inputPath),
    message: existsSync(inputPath) ? `File found: ${inputPath}` : `File not found: ${inputPath}`,
  };
}

function extractText(inputPath: string): string {
  try {
    return execSync(`python3 -m markitdown "${inputPath}" 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 30_000,
    });
  } catch {
    return "";
  }
}

function checkHasContent(text: string): CheckResult {
  const hasContent = text.trim().length > 50;
  return {
    name: "has_content",
    pass: hasContent,
    message: hasContent
      ? "Presentation has extractable text content"
      : "Presentation appears empty or unreadable",
  };
}

function checkNoForbiddenPhrases(text: string): CheckResult {
  const forbidden: string[] = bt.tokens.voice.phrases_avoid;
  const found = forbidden.filter((phrase) => text.toLowerCase().includes(phrase.toLowerCase()));
  return {
    name: "no_forbidden_phrases",
    pass: found.length === 0,
    message:
      found.length === 0
        ? "No forbidden phrases detected"
        : `Forbidden phrases found: ${found.join(", ")}`,
  };
}

function checkHasBrandTitle(text: string): CheckResult {
  // Very permissive: just check that BBVA appears somewhere
  const hasBrand = text.toUpperCase().includes("BBVA");
  return {
    name: "has_brand_mention",
    pass: hasBrand,
    message: hasBrand ? "BBVA brand mention found" : "No BBVA brand mention found in presentation",
  };
}

function checkSlideCount(text: string): CheckResult {
  // markitdown uses ## for slide separators
  const slideCount = (text.match(/^##/gm) ?? []).length;
  const hasSlides = slideCount >= 1;
  return {
    name: "has_slides",
    pass: hasSlides,
    message: hasSlides
      ? `Presentation has ${slideCount} slide(s)`
      : "No slides detected in presentation",
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function runChecks(inputPath: string): CheckResult[] {
  const results: CheckResult[] = [];

  const fileCheck = checkFileExists(inputPath);
  results.push(fileCheck);

  if (!fileCheck.pass) return results;

  const text = extractText(inputPath);

  results.push(checkSlideCount(text));
  results.push(checkHasContent(text));
  results.push(checkHasBrandTitle(text));
  results.push(checkNoForbiddenPhrases(text));

  return results;
}

function report(results: CheckResult[]): void {
  const pad = 30;
  console.log("\nBBVA PPTX Brand Validation");
  console.log("=".repeat(50));

  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    const icon = r.pass ? "✓" : "✗";
    console.log(`${icon} [${status}] ${r.name.padEnd(pad)} ${r.message}`);
  }

  const failures = results.filter((r) => !r.pass);
  console.log("=".repeat(50));

  if (failures.length === 0) {
    console.log(`\nAll ${results.length} checks passed.`);
  } else {
    console.log(`\n${failures.length}/${results.length} checks failed.`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseCli(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--input");
  const val = args[idx + 1];
  if (idx !== -1 && val) return val;
  throw new Error("Usage: npx tsx validate_pptx.ts --input file.pptx");
}

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].split("/").pop()!)) {
  const inputPath = parseCli();
  const results = runChecks(inputPath);
  report(results);
}

export { runChecks, report };
