#!/usr/bin/env npx tsx
/**
 * Check whether a PDF has native fillable form fields.
 *
 * Uses pdf-lib to detect AcroForm fields. Falls back to searching for
 * /AcroForm in the raw PDF bytes if pdf-lib is unavailable.
 *
 * Usage: npx tsx check-fillable-fields.ts <input.pdf>
 */

import { readFileSync } from "node:fs";

async function checkFillableFields(pdfPath: string): Promise<void> {
  const pdfBytes = readFileSync(pdfPath);

  // Try pdf-lib first (richer detection)
  try {
    // @ts-expect-error pdf-lib is a user-project dependency
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = doc.getForm();
    const fields = form.getFields();

    if (fields.length > 0) {
      console.log(
        `This PDF has fillable form fields (${fields.length} fields found)`,
      );
    } else {
      console.log(
        "This PDF does not have fillable form fields; you will need to visually determine where to enter data",
      );
    }
    return;
  } catch {
    // pdf-lib not available, fall back to raw byte search
  }

  // Fallback: search for AcroForm in raw PDF
  const content = pdfBytes.toString("latin1");
  if (content.includes("/AcroForm")) {
    console.log("This PDF has fillable form fields");
  } else {
    console.log(
      "This PDF does not have fillable form fields; you will need to visually determine where to enter data",
    );
  }
}

// CLI entry point
if (process.argv[1]?.endsWith("check-fillable-fields.ts")) {
  if (process.argv.length !== 3) {
    console.error("Usage: npx tsx check-fillable-fields.ts <input.pdf>");
    process.exit(1);
  }
  await checkFillableFields(process.argv[2]!);
}
