/**
 * cards.js — pure HTML parsing functions for Codi content-factory templates.
 *
 * Uses DOMParser (browser API). In Node/Vitest: requires jsdom environment.
 * In browser: runs natively with no polyfill.
 *
 * @module cards
 */

/**
 * Parse card elements from an HTML string.
 * Extracts .social-card, .doc-page, and .slide elements along with shared
 * styles. Also reads the document-level `<meta name="codi:template">` so every
 * card carries the authored canvas (`nativeFormat`) and its content-type
 * classification (`elementType`). Slides and documents are fixed-pixel
 * layouts authored for ONE canvas; cardFormat() honors nativeFormat for
 * those types so preview proportions match what will ship.
 *
 * @param {string} html - Raw HTML string of a content template file
 * @returns {Array<{index:number, dataType:string, dataIdx:string, html:string, styleText:string, linkTags:string, format:{w:number,h:number}|null, nativeFormat:{w:number,h:number}|null, elementType:'slide'|'document'|'social'}>}
 */
export function parseCards(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const styleText = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent)
    .join("\n");
  const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.outerHTML)
    .join("\n");

  // Read the shared <meta name="codi:template"> once per document; all cards
  // inherit its format as their authored canvas. Malformed JSON is tolerated
  // (returns null nativeFormat) so partial files still render something.
  const metaEl = doc.querySelector('meta[name="codi:template"]');
  let nativeFormat = null;
  if (metaEl) {
    try {
      const m = JSON.parse(metaEl.getAttribute("content") || "{}");
      if (m && m.format && typeof m.format.w === "number" && typeof m.format.h === "number") {
        nativeFormat = { w: m.format.w, h: m.format.h };
      }
    } catch {
      /* malformed — leave nativeFormat null */
    }
  }

  return Array.from(doc.querySelectorAll(".social-card, .doc-page, .slide")).map((el, i) => {
    let elementType = "social";
    if (el.classList.contains("slide")) elementType = "slide";
    else if (el.classList.contains("doc-page")) elementType = "document";
    return {
      index: i,
      dataType: el.getAttribute("data-type") || "card",
      dataIdx: el.getAttribute("data-index") || String(i + 1).padStart(2, "0"),
      html: el.outerHTML,
      styleText,
      linkTags,
      format: nativeFormat,
      nativeFormat,
      elementType,
    };
  });
}

/**
 * Parse a template HTML file into a structured template object.
 *
 * @param {string} html - Raw HTML string of the template file
 * @param {string} filename - Filename used as fallback id (e.g. "dark-editorial.html")
 * @returns {{filename:string, id:string, name:string, type:string, format:{w:number,h:number}, desc:string, cards:Array}}
 */
export function parseTemplate(html, filename) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const metaEl = doc.querySelector('meta[name="codi:template"]');
  let meta = {};
  try {
    if (metaEl) meta = JSON.parse(metaEl.content);
  } catch {}
  const id = meta.id || filename.replace(/\.html$/, "");

  // Fallback: read legacy <meta name="template-type"> and <meta name="template-format">
  const legacyType = doc.querySelector('meta[name="template-type"]')?.content;
  const legacyFormatStr = doc.querySelector('meta[name="template-format"]')?.content;
  const legacyFormat = legacyFormatStr
    ? (([w, h]) => ({ w: Number(w), h: Number(h) }))(legacyFormatStr.toLowerCase().split("x"))
    : null;

  // Fallback name: codi:template > <title> tag > capitalized id
  const titleEl = doc.querySelector("title");
  const titleText = titleEl ? titleEl.textContent.replace(/\s*[—–-].*$/, "").trim() : "";

  const cards = parseCards(html);
  return {
    filename,
    id,
    name: meta.name || titleText || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type: meta.type || legacyType || "social",
    format: meta.format || legacyFormat || { w: 1080, h: 1080 },
    desc: meta.desc || "",
    cards,
  };
}
