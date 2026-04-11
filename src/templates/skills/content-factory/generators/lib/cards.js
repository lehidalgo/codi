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
 * Extracts .social-card, .doc-page, and .slide elements along with shared styles.
 *
 * @param {string} html - Raw HTML string of a content template file
 * @returns {Array<{index:number, dataType:string, dataIdx:string, html:string, styleText:string, linkTags:string, format:null}>}
 */
export function parseCards(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const styleText = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent)
    .join("\n");
  const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.outerHTML)
    .join("\n");
  return Array.from(doc.querySelectorAll(".social-card, .doc-page, .slide")).map((el, i) => ({
    index: i,
    dataType: el.getAttribute("data-type") || "card",
    dataIdx: el.getAttribute("data-index") || String(i + 1).padStart(2, "0"),
    html: el.outerHTML,
    styleText,
    linkTags,
    format: null,
  }));
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
  const cards = parseCards(html);
  return {
    filename,
    id,
    name: meta.name || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type: meta.type || "social",
    format: meta.format || { w: 1080, h: 1080 },
    desc: meta.desc || "",
    cards,
  };
}
