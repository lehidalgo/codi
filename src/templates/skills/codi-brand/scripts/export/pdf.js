#!/usr/bin/env node
/* eslint-disable */
/**
 * Codi Deck — PDF Export
 * Usage: node pdf.js --input deck.html --output deck.pdf
 *
 * Requires: npx playwright install chromium
 */
"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

// ========== CLI Args ==========

const args = process.argv.slice(2);
let inputFile = "deck.html";
let outputFile = "deck.pdf";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && args[i + 1]) inputFile = args[i + 1];
  if (args[i] === "--output" && args[i + 1]) outputFile = args[i + 1];
}

const absInput = path.resolve(inputFile);
const absOutput = path.resolve(outputFile);

// ========== Export ==========

async function exportPdf() {
  let chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch (_) {
    console.error("Playwright not installed. Run: npx playwright install chromium");
    process.exit(1);
  }

  const { PDFDocument } = await import("pdf-lib").catch(function () {
    console.error("pdf-lib not installed. Run: npm install pdf-lib");
    process.exit(1);
  });

  const browser = await chromium.launch();
  const merged = await PDFDocument.create();
  let slideCount = 0;

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 960, height: 540 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto(pathToFileURL(absInput).href);

    // Wait for fonts and animations
    await page.evaluate(function () {
      return Promise.race([
        document.fonts.ready,
        new Promise(function (resolve) {
          setTimeout(resolve, 5000);
        }),
      ]);
    });

    // Count slides
    const total = await page.evaluate(function () {
      return document.querySelectorAll(".slide").length;
    });

    if (total === 0) {
      console.error("No .slide elements found in " + inputFile);
      await browser.close();
      process.exit(1);
    }

    for (let i = 0; i < total; i++) {
      // Activate slide i
      await page.evaluate(function (idx) {
        var slides = document.querySelectorAll(".slide");
        slides.forEach(function (s, j) {
          s.classList.toggle("active", j === idx);
        });
        // Update progress bar and counter if present
        var pb = document.getElementById("progressBar");
        if (pb) pb.style.width = ((idx + 1) / slides.length) * 100 + "%";
        var sc = document.getElementById("slideCounter");
        if (sc) sc.textContent = idx + 1 + " / " + slides.length;
      }, i);

      // Wait one frame for CSS transitions
      await page.waitForTimeout(80);

      const pdfBytes = await page.pdf({
        printBackground: true,
        width: "960px",
        height: "540px",
        pageRanges: "1",
      });

      const single = await PDFDocument.load(pdfBytes);
      const [copiedPage] = await merged.copyPages(single, [0]);
      merged.addPage(copiedPage);
      slideCount++;
    }

    await page.close();
  } finally {
    await browser.close();
  }

  const { writeFileSync, mkdirSync } = require("fs");
  mkdirSync(path.dirname(absOutput), { recursive: true });
  writeFileSync(absOutput, await merged.save());
  console.log("PDF exported: " + absOutput + " (" + slideCount + " slides)");
}

exportPdf().catch(function (err) {
  console.error(err.message || String(err));
  process.exit(1);
});
