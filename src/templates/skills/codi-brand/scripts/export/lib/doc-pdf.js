// @ts-nocheck

/**
 * doc-pdf.js — A4 vector PDF export for multi-page documents
 *
 * Strategy:
 *   - Navigate to the document HTML via the preview server URL
 *   - Apply JS neutralization to undo preview-shell zoom and sidebar margin
 *   - Inject DOC_PRINT_CSS to restore column layout and enforce A4 geometry
 *   - Capture with page.pdf() → full-page vector PDF
 */

import path from "path";
import fs from "fs";
import { applyNeutralize, DOC_PRINT_CSS } from "./neutralize.js";

const DOC_VIEWPORT_W = 794; // A4 at 96 dpi
const DOC_VIEWPORT_H = 1123; // A4 at 96 dpi

/**
 * Exports a multi-page A4 document HTML page to PDF.
 *
 * @param {import('playwright').Page} page
 * @param {string} url       Full preview server URL including ?file= param
 * @param {string} outputPath  Absolute path for the output .pdf file
 */
export async function exportDocPdf(page, url, outputPath) {
  await page.setViewportSize({ width: DOC_VIEWPORT_W, height: DOC_VIEWPORT_H });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]),
  );

  // Remove preview-shell artifacts (zoom, sidebar, toolbar)
  await applyNeutralize(page);
  // Restore column layout and enforce exact A4 page geometry
  await page.addStyleTag({ content: DOC_PRINT_CSS });
  // Allow layout to reflow after style injection
  await page.waitForTimeout(200);

  const pageCount = await page.evaluate(() => document.querySelectorAll(".doc-page").length);
  if (!pageCount) throw new Error(`No .doc-page elements found at ${url}`);

  const pdfBytes = await page.pdf({
    printBackground: true,
    format: "A4",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`  → PDF: ${outputPath} (${pageCount} page(s))`);
}
