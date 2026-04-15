"use strict";
/**
 * bundle-html.js — Inline external CSS and JS referenced by an HTML file.
 *
 * Replaces:
 *   <link rel="stylesheet" href="relative/path.css">  →  <style>…css…</style>
 *   <script src="relative/path.js"></script>           →  <script>…js…</script>
 *
 * Skips http/https/data URIs (cannot inline those safely).
 * Warns to stderr if a referenced file cannot be read.
 */

const fs = require("fs");
const path = require("path");

const LINK_RE = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi;
const SCRIPT_RE = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;

function isRemote(href) {
  return /^https?:\/\//i.test(href) || /^data:/i.test(href);
}

function readAsset(href, baseDir, label) {
  if (isRemote(href)) return null; // skip remote — caller leaves original tag
  const abs = path.resolve(baseDir, href);
  if (!fs.existsSync(abs)) {
    process.stderr.write("[bundle-html] WARNING: " + label + " not found: " + abs + "\n");
    return null;
  }
  return fs.readFileSync(abs, "utf-8");
}

/**
 * Inline <link rel="stylesheet"> and <script src> tags found in html.
 *
 * @param {string} html     - HTML source string
 * @param {string} baseDir  - directory to resolve relative hrefs against
 * @returns {string}        - HTML with external refs inlined
 */
function bundleHtml(html, baseDir) {
  // Inline stylesheets
  html = html.replace(LINK_RE, function (original, href) {
    const css = readAsset(href, baseDir, "<link>");
    if (css === null) return original;
    return "<style>\n" + css + "\n</style>";
  });

  // Inline scripts
  html = html.replace(SCRIPT_RE, function (original, src) {
    const js = readAsset(src, baseDir, "<script src>");
    if (js === null) return original;
    return "<script>\n" + js + "\n</script>";
  });

  return html;
}

module.exports = { bundleHtml };
