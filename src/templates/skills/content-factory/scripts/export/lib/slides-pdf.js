// @ts-nocheck

/**
 * slides-pdf.js — vector PDF export for slide decks
 *
 * Strategy:
 *   - Navigate to the slide HTML via the preview server URL (fonts resolve correctly)
 *   - Activate one slide at a time using position:absolute;inset:0 layout
 *   - Capture each slide with page.pdf() → vector output (selectable text)
 *   - Merge per-slide PDFs into one document via pdf-lib
 */

import path from "path";
import fs from "fs";
import { applyNeutralize } from "./neutralize.js";

const SLIDE_W_PX = 960;
const SLIDE_H_PX = 540;

/**
 * Activates slide at index `idx` using the correct CSS layout so that
 * getBoundingClientRect() and pdf() both see the slide in its intended position.
 */
async function activateSlide(page, idx) {
  return page.evaluate((i) => {
    const slides = Array.from(document.querySelectorAll(".slide"));
    slides.forEach((s, j) => {
      const active = j === i;
      s.classList.toggle("active", active);
      s.style.cssText = active
        ? "display:flex!important;flex-direction:column!important;visibility:visible!important;opacity:1!important;position:absolute!important;inset:0!important;"
        : "display:none!important;";
    });
    const pb = document.getElementById("progressBar");
    if (pb) pb.style.width = ((i + 1) / slides.length) * 100 + "%";
    const sc = document.getElementById("slideCounter");
    if (sc) sc.textContent = i + 1 + " / " + slides.length;
  }, idx);
}

/**
 * Exports a slides HTML page (served via preview server) to a multi-page PDF.
 *
 * @param {import('playwright').Page} page
 * @param {string} url       Full preview server URL including ?file= param
 * @param {string} outputPath  Absolute path for the output .pdf file
 */
export async function exportSlidesPdf(page, url, outputPath) {
  let PDFDocument;
  try {
    ({ PDFDocument } = await import("pdf-lib"));
  } catch {
    throw new Error("pdf-lib not installed. Run: npm install pdf-lib --save-dev");
  }

  await page.setViewportSize({ width: SLIDE_W_PX, height: SLIDE_H_PX });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]),
  );
  await applyNeutralize(page);

  const total = await page.evaluate(() => document.querySelectorAll(".slide").length);
  if (!total) throw new Error(`No .slide elements found at ${url}`);

  const merged = await PDFDocument.create();

  for (let i = 0; i < total; i++) {
    process.stdout.write(`    slide ${i + 1}/${total}...`);
    await activateSlide(page, i);
    await page.waitForTimeout(80);

    const pdfBytes = await page.pdf({
      printBackground: true,
      width: `${SLIDE_W_PX}px`,
      height: `${SLIDE_H_PX}px`,
      pageRanges: "1",
    });

    const single = await PDFDocument.load(pdfBytes);
    const [copied] = await merged.copyPages(single, [0]);
    merged.addPage(copied);
    process.stdout.write(" ok\n");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await merged.save());
  console.log(`  → PDF: ${outputPath} (${total} slides)`);
}
