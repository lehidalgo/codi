"use strict";
/**
 * inline-assets.js — Base64-encode fonts and images referenced in HTML/CSS.
 *
 * inlineFonts:  replaces url('path.woff2') in CSS @font-face rules with
 *               base64 data URIs so the deck works offline.
 *
 * inlineImages: replaces <img src="path"> with base64 data URIs.
 *
 * Both functions skip http/https/data: URIs and warn on missing files.
 */

const fs = require("fs");
const path = require("path");

const FONT_MIME = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const IMAGE_MIME = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// Matches url('...') or url("...") or url(...) — CSS url() function
const CSS_URL_RE = /url\((['"]?)([^)'"]+)\1\)/g;

// Matches <img src="..."> or <img src='...'>
const IMG_SRC_RE = /<img\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/gi;

function isRemote(src) {
  return /^https?:\/\//i.test(src) || /^data:/i.test(src);
}

function toDataUri(filePath, mimeMap) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = mimeMap[ext];
  if (!mime) return null;
  let data;
  try {
    data = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  return "data:" + mime + ";base64," + data.toString("base64");
}

function warnMissing(label, filePath) {
  process.stderr.write("[inline-assets] WARNING: " + label + " not found: " + filePath + "\n");
}

/**
 * Replace font url() references in CSS (embedded in HTML) with base64 data URIs.
 *
 * @param {string} html     - full HTML source (may contain <style> blocks)
 * @param {string} baseDir  - directory to resolve relative font paths against
 * @returns {string}        - HTML with font URLs replaced
 */
function inlineFonts(html, baseDir) {
  // We only process text inside <style> blocks to avoid touching img src attrs
  return html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, function (_, open, css, close) {
    const inlined = css.replace(CSS_URL_RE, function (original, quote, src) {
      if (isRemote(src)) return original;
      const ext = path.extname(src).toLowerCase();
      if (!FONT_MIME[ext]) return original; // not a font
      const abs = path.resolve(baseDir, src);
      if (!fs.existsSync(abs)) {
        warnMissing("<style> font", abs);
        return original;
      }
      const dataUri = toDataUri(abs, FONT_MIME);
      if (!dataUri) return original;
      return "url(" + quote + dataUri + quote + ")";
    });
    return open + inlined + close;
  });
}

/**
 * Replace <img src> relative paths with base64 data URIs.
 *
 * @param {string} html     - full HTML source
 * @param {string} baseDir  - directory to resolve relative image paths against
 * @returns {string}        - HTML with image src replaced
 */
function inlineImages(html, baseDir) {
  return html.replace(IMG_SRC_RE, function (_, before, src, after) {
    if (isRemote(src)) return _;
    const ext = path.extname(src).toLowerCase();
    if (!IMAGE_MIME[ext]) return _;
    const abs = path.resolve(baseDir, src);
    if (!fs.existsSync(abs)) {
      warnMissing("<img>", abs);
      return _;
    }
    const dataUri = toDataUri(abs, IMAGE_MIME);
    if (!dataUri) return _;
    return "<img" + before + ' src="' + dataUri + '"' + after + ">";
  });
}

module.exports = { inlineFonts, inlineImages };
