// Renders an HTML file in headless chromium and extracts a raw DOM tree
// with computed geometry and the CSS properties the rule engine needs.
//
// Output shape (per node):
//   {
//     tag, id, classes, path,
//     rect: { x, y, w, h },
//     css: { display, flexDirection, gap, paddingTop, paddingRight, paddingBottom, paddingLeft },
//     dataBoxGroup: string|null,
//     textContent: string,          // own text only, excluding descendants
//     children: Node[]
//   }

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

async function loadPlaywright() {
  try {
    const mod = await import("playwright");
    return mod;
  } catch (err) {
    const msg =
      "playwright not installed. Run: bash ${SKILL_DIR}/scripts/setup.sh";
    const e = new Error(msg);
    e.cause = err;
    throw e;
  }
}

/**
 * Render an HTML file and extract the annotated tree from the first child of <body>.
 *
 * @param {object} opts
 * @param {string} opts.inputPath - absolute path to HTML file
 * @param {number} opts.width - viewport width
 * @param {number} opts.height - viewport height
 * @returns {Promise<object>} root node
 */
export async function renderAndExtract({ inputPath, width, height }) {
  const { chromium } = await loadPlaywright();
  const html = await readFile(inputPath, "utf8");

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    // Use a file:// URL base so relative assets resolve from the file's dir.
    await page.goto(pathToFileURL(inputPath).href, { waitUntil: "networkidle" });

    const tree = await page.evaluate(extractInBrowser);
    if (!tree) {
      throw new Error("no root element found (body has no children)");
    }
    return tree;
  } finally {
    await browser.close();
  }
}

// Runs inside the browser context. Walks the DOM, computes geometry,
// and returns a plain-object tree. Must be self-contained (no outer closures).
function extractInBrowser() {
  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) t += n.nodeValue || "";
    }
    return t.trim();
  }

  // Measure natural width of the element's text content using a Range.
  // This returns the actual rendered text width regardless of the box
  // width — unlike scrollWidth, which is clamped to clientWidth.
  function measureTextWidth(el) {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (range.detach) range.detach();
      return r.width;
    } catch {
      return 0;
    }
  }

  function walk(el, path) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return null;

    const rect = el.getBoundingClientRect();
    const children = [];
    let idx = 0;
    for (const child of el.children) {
      const childPath = `${path} > ${child.tagName.toLowerCase()}${
        child.id ? "#" + child.id : ""
      }[${idx}]`;
      const walked = walk(child, childPath);
      if (walked) children.push(walked);
      idx += 1;
    }

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: Array.from(el.classList),
      path,
      rect: {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        // Content metrics — used by R10 (Content Fit) to check both
        // overflow (content > box) and underfill (content << box).
        // scrollW/H + textW reflect the natural content size; clientW/H
        // reflect the inner box size.
        scrollW: el.scrollWidth,
        scrollH: el.scrollHeight,
        clientW: el.clientWidth,
        clientH: el.clientHeight,
        // Natural text width from Range.getBoundingClientRect.
        // scrollWidth clamps at clientWidth, so it cannot detect the
        // underfill case — we use a Range over text nodes instead.
        textW: measureTextWidth(el),
        // Alignment properties — leaves with centered content are
        // exempt from the underfill check because empty space is
        // balanced on both sides instead of pooling on one edge.
        justify: cs.justifyContent,
        textAlign: cs.textAlign,
      },
      css: {
        display: cs.display,
        flexDirection: cs.flexDirection,
        flexWrap: cs.flexWrap,
        gridTemplateColumns: cs.gridTemplateColumns,
        gap: parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0,
        columnGap: parseFloat(cs.columnGap) || 0,
        rowGap: parseFloat(cs.rowGap) || 0,
        paddingTop: parseFloat(cs.paddingTop) || 0,
        paddingRight: parseFloat(cs.paddingRight) || 0,
        paddingBottom: parseFloat(cs.paddingBottom) || 0,
        paddingLeft: parseFloat(cs.paddingLeft) || 0,
      },
      dataBoxGroup: el.getAttribute("data-box-group"),
      textContent: ownText(el),
      children,
    };
  }

  const root = document.body.firstElementChild;
  if (!root) return null;
  return walk(root, root.tagName.toLowerCase());
}
