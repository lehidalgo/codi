#!/usr/bin/env npx tsx
/**
 * validate_pptx.ts — Codi brand rule checker for PPTX files.
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

interface CheckResult {
  name: string;
  pass: boolean;
  message: string;
}

function checkFileExists(inputPath: string): CheckResult {
  const pass = existsSync(inputPath);
  return {
    name: "file_exists",
    pass,
    message: pass ? `File found: ${inputPath}` : `File not found: ${inputPath}`,
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

function checkSlideCount(text: string): CheckResult {
  const slideCount = (text.match(/^##/gm) ?? []).length;
  const pass = slideCount >= 1;
  return {
    name: "has_slides",
    pass,
    message: pass ? `Presentation has ${slideCount} slide(s)` : "No slides detected",
  };
}

function checkHasContent(text: string): CheckResult {
  const pass = text.trim().length > 50;
  return {
    name: "has_content",
    pass,
    message: pass ? "Presentation has extractable text content" : "Presentation appears empty",
  };
}

function checkBrandMention(text: string): CheckResult {
  const pass = text.toLowerCase().includes("codi");
  return {
    name: "has_brand_mention",
    pass,
    message: pass ? "Codi brand mention found" : "No 'codi' mention found in presentation",
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

export function runChecks(inputPath: string): CheckResult[] {
  const results: CheckResult[] = [];

  const fileCheck = checkFileExists(inputPath);
  results.push(fileCheck);
  if (!fileCheck.pass) return results;

  const text = extractText(inputPath);
  results.push(checkSlideCount(text));
  results.push(checkHasContent(text));
  results.push(checkBrandMention(text));
  results.push(checkNoForbiddenPhrases(text));

  return results;
}

export function report(results: CheckResult[]): void {
  console.log("\nCodi PPTX Brand Validation");
  console.log("=".repeat(50));

  for (const r of results) {
    const icon = r.pass ? "✓" : "✗";
    const status = r.pass ? "PASS" : "FAIL";
    console.log(`${icon} [${status}] ${r.name.padEnd(30)} ${r.message}`);
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
