#!/usr/bin/env node
// @ts-nocheck

/**
 * all.js — Codi session-aware export orchestrator
 *
 * Reads the session state written by start-server.sh, discovers HTML files
 * in screen_dir, classifies each as "slides" or "document", and exports all
 * applicable formats to exports_dir.
 *
 * Usage:
 *   node all.js --session /path/to/.codi_output/20260408_1012_codi-brand
 *
 * Requires: playwright, pdf-lib, pptxgenjs
 *   npm install pdf-lib pptxgenjs playwright
 *   npx playwright install chromium
 *
 * The server must already be running (started via start-server.sh) for the
 * session directory. The script reads connection info from state/server.log.
 */

import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { readState } from "./lib/state.js";
import { classify } from "./lib/classify.js";
import { exportSlidesPdf } from "./lib/slides-pdf.js";
import { exportDocPdf } from "./lib/doc-pdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let sessionDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--session" && args[i + 1]) sessionDir = args[++i];
}

if (!sessionDir) {
  console.error(
    "Usage: node all.js --session <session-dir>\n" +
      "  Example: node all.js --session .codi_output/20260408_1012_codi-brand",
  );
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Read session state
  const state = readState(sessionDir);
  console.log(`Session : ${path.resolve(sessionDir)}`);
  console.log(`Server  : ${state.url}`);
  console.log(`Output  : ${state.exports_dir}\n`);

  // 2. Discover HTML files
  const htmlFiles = fs
    .readdirSync(state.screen_dir)
    .filter((f) => f.endsWith(".html"))
    .sort();

  if (!htmlFiles.length) {
    console.error(`No HTML files found in ${state.screen_dir}`);
    process.exit(1);
  }

  console.log(`Files   : ${htmlFiles.join(", ")}\n`);

  // 3. Launch browser
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright not found.\nRun: npx playwright install chromium");
    process.exit(1);
  }

  const browser = await chromium.launch();

  try {
    for (const fileName of htmlFiles) {
      const fileUrl = `${state.url}/?file=${fileName}`;
      const baseName = path.basename(fileName, ".html");
      console.log(`─── ${fileName} ───`);

      // 4. Classify: probe the DOM to determine content type
      const probePage = await browser.newPage();
      await probePage.setViewportSize({ width: 960, height: 540 });
      await probePage.goto(fileUrl, { waitUntil: "networkidle" });
      const type = await classify(probePage);
      await probePage.close();

      if (type === "unknown") {
        console.log("  Skipped — no .slide or .doc-page elements found\n");
        continue;
      }

      console.log(`  Type    : ${type}`);

      // 5. Export PDF
      const pdfOut = path.join(state.exports_dir, `${baseName}.pdf`);
      const exportPage = await browser.newPage();

      if (type === "slides") {
        await exportSlidesPdf(exportPage, fileUrl, pdfOut);
        await exportPage.close();

        // PPTX: spawned as a subprocess (has its own browser + Playwright session)
        const pptxOut = path.join(state.exports_dir, `${baseName}.pptx`);
        runPptxExport(fileUrl, pptxOut);
      } else {
        await exportDocPdf(exportPage, fileUrl, pdfOut);
        await exportPage.close();
      }

      console.log();
    }
  } finally {
    await browser.close();
  }

  console.log(`Done. Exports saved to: ${state.exports_dir}`);
}

// ─── PPTX subprocess ─────────────────────────────────────────────────────────

/**
 * Spawns pptx.js as a child process, passing the server URL so that fonts
 * resolve via HTTP (they would fail with a file:// URL).
 */
function runPptxExport(fileUrl, outputPath) {
  const pptxScript = path.join(__dirname, "pptx.js");
  console.log(`  Exporting PPTX...`);
  const result = spawnSync(
    process.execPath,
    [pptxScript, "--url", fileUrl, "--output", outputPath],
    {
      stdio: "inherit",
    },
  );
  if (result.status !== 0) {
    console.error(`  PPTX export failed (exit ${result.status})`);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(err.message ?? String(err));
  process.exit(1);
});
