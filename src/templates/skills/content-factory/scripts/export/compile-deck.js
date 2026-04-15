#!/usr/bin/env node
"use strict";
/**
 * compile-deck.js — Bundle a 3-file deck (deck.html + deck.css + deck.js)
 * into a single portable standalone HTML file with all assets inlined.
 *
 * Usage:
 *   node compile-deck.js --content <contentDir> [--out <filename>]
 *
 * Arguments:
 *   --content <dir>    Path to the session's content directory (where
 *                      deck.html, deck.css, and deck.js live).
 *   --out <filename>   Output filename (default: deck-standalone.html).
 *                      Written to the same content directory.
 *
 * Pipeline:
 *   1. Read deck.html from contentDir
 *   2. bundleHtml  — inline <link> CSS and <script src> JS
 *   3. inlineFonts — base64-encode @font-face url() references
 *   4. inlineImages — base64-encode <img src> references
 *   5. Write output file to contentDir (or --out path if absolute)
 *
 * Exit codes: 0 = success, 1 = error
 */

const fs = require("fs");
const path = require("path");

const { bundleHtml } = require("./lib/bundle-html.js");
const { inlineFonts, inlineImages } = require("./lib/inline-assets.js");

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { content: null, out: "deck-standalone.html" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--content" && argv[i + 1]) {
      args.content = argv[++i];
    } else if (argv[i] === "--out" && argv[i + 1]) {
      args.out = argv[++i];
    }
  }
  return args;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);

  if (!args.content) {
    process.stderr.write("compile-deck: --content <contentDir> is required\n");
    process.exit(1);
  }

  const contentDir = path.resolve(args.content);
  if (!fs.existsSync(contentDir)) {
    process.stderr.write("compile-deck: content directory not found: " + contentDir + "\n");
    process.exit(1);
  }

  const deckHtmlPath = path.join(contentDir, "deck.html");
  if (!fs.existsSync(deckHtmlPath)) {
    process.stderr.write("compile-deck: deck.html not found in " + contentDir + "\n");
    process.exit(1);
  }

  // Determine output path
  const outPath = path.isAbsolute(args.out) ? args.out : path.join(contentDir, args.out);

  // Run pipeline
  let html = fs.readFileSync(deckHtmlPath, "utf-8");
  html = bundleHtml(html, contentDir);
  html = inlineFonts(html, contentDir);
  html = inlineImages(html, contentDir);

  fs.writeFileSync(outPath, html, "utf-8");
  process.stdout.write("compile-deck: wrote " + outPath + "\n");
}

main();
