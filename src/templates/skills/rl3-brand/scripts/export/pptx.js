#!/usr/bin/env node
// @ts-nocheck

/**
 * pptx.js — Brand HTML-to-PPTX export via Playwright + PptxGenJS
 *
 * Strategy per slide:
 *   1. Playwright renders at 960×540 (deviceScaleFactor=2 → 1920×1080 screenshot)
 *   2. Text elements hidden before screenshot → screenshot = visual design only
 *      (backgrounds, gradients, shapes, SVG logos, brand decorations)
 *   3. Text extracted with getBoundingClientRect → editable PptxGenJS text overlay
 *   4. Slide fade transition applied
 *
 * Usage:
 *   node pptx.js --input deck.html --output deck.pptx [--tokens brand_tokens.json] [--theme dark|light]
 *
 * Install once per project:
 *   npm install pptxgenjs
 *   npx playwright install chromium
 */
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let inputFile = "deck.html";
let outputFile = "deck.pptx";
let tokensFile = null;
let theme = "light";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && args[i + 1]) inputFile = args[++i];
  if (args[i] === "--output" && args[i + 1]) outputFile = args[++i];
  if (args[i] === "--tokens" && args[i + 1]) tokensFile = args[++i];
  if (args[i] === "--theme" && args[i + 1]) theme = args[++i];
}

const absInput = path.resolve(inputFile);
const absOutput = path.resolve(outputFile);

if (!fs.existsSync(absInput)) {
  console.error(`Input not found: ${absInput}`);
  process.exit(1);
}

// ─── Slide geometry ───────────────────────────────────────────────────────────

const W_IN = 10.0; // 960px / 96dpi
const H_IN = 5.625; // 540px / 96dpi
const W_PX = 960;
const H_PX = 540;

// Selectors whose matched elements become editable text boxes in PPTX.
// They are hidden before screenshotting so the PNG captures only visual design.
// Only LEAF matches are processed — elements containing other matches are skipped.
const TEXT_SELECTORS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "blockquote",
  "figcaption",
  ".title",
  ".subtitle",
  ".body-text",
  ".meta",
  ".callout",
  ".quote-text",
  ".attribution",
  ".metric-value",
  ".metric-label",
  ".section-number",
  ".slide__heading",
  ".slide__body",
  ".slide__subtitle",
].join(",");

// ─── Utility ──────────────────────────────────────────────────────────────────

const pxToIn = (px) => px / 96;
const ptFromPx = (px) => Math.max(6, Math.round(px * 0.75));

function rgbToHex(rgb) {
  if (!rgb || rgb === "transparent") return null;
  const m = rgb.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  return m
    .slice(0, 3)
    .map((n) => Math.round(parseFloat(n)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function loadTokens(file, themeKey) {
  if (!file) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.resolve(file), "utf-8"));
    return raw.themes?.[themeKey] ?? raw.themes?.light ?? null;
  } catch {
    return null;
  }
}

// ─── Playwright: activate a slide ─────────────────────────────────────────────

/**
 * Show slide at `idx`, hide all others.
 * Returns the slide's bounding rect in CSS pixels (viewport-relative).
 */
async function activateSlide(page, idx) {
  return page.evaluate((i) => {
    const slides = Array.from(document.querySelectorAll(".slide"));
    slides.forEach((s, j) => {
      const active = j === i;
      s.classList.toggle("active", active);
      s.style.cssText = active
        ? "display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;"
        : "display:none!important;";
    });

    const pb = document.getElementById("progressBar");
    if (pb) pb.style.width = ((i + 1) / slides.length) * 100 + "%";
    const sc = document.getElementById("slideCounter");
    if (sc) sc.textContent = i + 1 + " / " + slides.length;

    const s = slides[i];
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, idx);
}

// ─── Playwright: extract text elements ────────────────────────────────────────

/**
 * Returns positioned text objects for all leaf text elements in slide `idx`.
 * Coordinates are in CSS pixels relative to the slide's top-left corner.
 */
async function extractText(page, idx, slideX, slideY) {
  return page.evaluate(
    ({ sel, i, sx, sy }) => {
      const slide = document.querySelectorAll(".slide")[i];
      if (!slide) return [];

      const all = Array.from(slide.querySelectorAll(sel));
      const dominated = new WeakSet();

      // Mark descendants that are also matched — we only want leaf matches
      all.forEach((el) => {
        all.forEach((other) => {
          if (other !== el && el.contains(other)) dominated.add(other);
        });
      });

      return all
        .filter((el) => !dominated.has(el))
        .map((el) => {
          const text = (el.innerText || "").trim().replace(/\s+/g, " ");
          if (!text) return null;

          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return null;

          const s = window.getComputedStyle(el);
          return {
            text,
            x: r.left - sx,
            y: r.top - sy,
            w: r.width,
            h: r.height,
            fontSize: parseFloat(s.fontSize) || 16,
            fontWeight: s.fontWeight || "400",
            color: s.color || "rgb(0,0,0)",
            textAlign: s.textAlign || "left",
            fontFamily: s.fontFamily.split(",")[0].replace(/['"]/g, "").trim() || "Arial",
          };
        })
        .filter(Boolean);
    },
    { sel: TEXT_SELECTORS, i: idx, sx: slideX, sy: slideY },
  );
}

// ─── Playwright: screenshot with text hidden ──────────────────────────────────

/**
 * Hides text elements, screenshots the slide at native resolution,
 * then restores text. Returns a PNG Buffer.
 */
async function screenshotNoText(page, idx, rect) {
  await page.evaluate(
    ({ sel, i }) => {
      document
        .querySelectorAll(".slide")
        [i]?.querySelectorAll(sel)
        .forEach((el) => el.style.setProperty("opacity", "0", "important"));
    },
    { sel: TEXT_SELECTORS, i: idx },
  );

  await page.waitForTimeout(50);

  const buf = await page.screenshot({
    clip: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: W_PX,
      height: H_PX,
    },
  });

  await page.evaluate(
    ({ sel, i }) => {
      document
        .querySelectorAll(".slide")
        [i]?.querySelectorAll(sel)
        .forEach((el) => el.style.removeProperty("opacity"));
    },
    { sel: TEXT_SELECTORS, i: idx },
  );

  return buf;
}

// ─── PptxGenJS: build one slide ───────────────────────────────────────────────

function buildSlide(prs, imgBuf, textEls) {
  const slide = prs.addSlide();

  // Background: full-bleed screenshot (CSS visuals — gradients, SVGs, shapes)
  slide.addImage({
    data: "data:image/png;base64," + imgBuf.toString("base64"),
    x: 0,
    y: 0,
    w: W_IN,
    h: H_IN,
  });

  // Text overlay: editable text boxes positioned to match HTML layout
  for (const el of textEls) {
    const x = pxToIn(el.x);
    const y = pxToIn(el.y);
    const w = pxToIn(el.w);
    const h = pxToIn(el.h);

    // Skip out-of-bounds or degenerate boxes
    if (x < 0 || y < 0 || w < 0.05 || h < 0.05) continue;
    if (x + w > W_IN + 0.2 || y + h > H_IN + 0.2) continue;

    const color = rgbToHex(el.color);
    const align =
      el.textAlign === "center" ? "center" : el.textAlign === "right" ? "right" : "left";

    slide.addText(el.text, {
      x,
      y,
      w,
      h,
      fontSize: ptFromPx(el.fontSize),
      bold: parseInt(el.fontWeight, 10) >= 600,
      color: color ?? "000000",
      align,
      fontFace: el.fontFamily,
      valign: "top",
      wrap: true,
      isTextBox: true,
    });
  }

  // Slide transition (v4: property assignment)
  slide.transition = { type: "fade" };

  return slide;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let chromium, PptxGenJS;

  try {
    chromium = (await import("playwright")).chromium;
  } catch {
    console.error("playwright not found.\n" + "Run: npx playwright install chromium");
    process.exit(1);
  }

  try {
    const mod = await import("pptxgenjs");
    PptxGenJS = mod.default ?? mod;
  } catch {
    console.error("pptxgenjs not found.\n" + "Run: npm install pptxgenjs");
    process.exit(1);
  }

  const tokens = loadTokens(tokensFile, theme);
  if (tokens) console.log(`Tokens loaded  (theme: ${theme})`);

  // ── Browser
  const browser = await chromium.launch();
  const page = await (
    await browser.newContext({
      viewport: { width: W_PX, height: H_PX },
      deviceScaleFactor: 2, // 1920×1080 screenshots for sharpness
    })
  ).newPage();

  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(pathToFileURL(absInput).href, { waitUntil: "networkidle" });
  await page.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]),
  );

  const total = await page.evaluate(() => document.querySelectorAll(".slide").length);

  if (!total) {
    console.error("No .slide elements found in: " + absInput);
    await browser.close();
    process.exit(1);
  }

  console.log(`Exporting ${total} slide(s) → ${path.basename(absOutput)}`);

  // ── PptxGenJS presentation
  const prs = new PptxGenJS();
  prs.author = "Codi Brand Skill";
  prs.subject = path.basename(absInput, ".html");
  prs.defineLayout({ name: "WIDE169", width: W_IN, height: H_IN });
  prs.layout = "WIDE169";

  // ── Process slides sequentially (DOM mutations require sequential ops)
  for (let i = 0; i < total; i++) {
    process.stdout.write(`  [${i + 1}/${total}] rendering...`);

    const rect = await activateSlide(page, i);
    if (!rect) {
      process.stdout.write(" skipped (no rect)\n");
      continue;
    }

    await page.waitForTimeout(100); // CSS transitions settle

    const textEls = await extractText(page, i, rect.x, rect.y);
    const imgBuf = await screenshotNoText(page, i, rect);

    buildSlide(prs, imgBuf, textEls);

    process.stdout.write(` ${textEls.length} text boxes\n`);
  }

  await browser.close();

  // ── Write output
  const outDir = path.dirname(absOutput);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  await prs.writeFile({ fileName: absOutput });
  console.log(`\nPPTX saved: ${absOutput}`);
}

main().catch((err) => {
  console.error(err.message ?? String(err));
  process.exit(1);
});
