// @ts-nocheck

/**
 * neutralize.js — shared preview-shell artifact removal
 *
 * The preview server (server.cjs) injects preview-shell.js into every served
 * page. That script modifies the DOM in three ways that break exports:
 *   1. Sets document.body.style.marginLeft = "260px"  (sidebar offset)
 *   2. Overrides .doc-container to flex-direction:row  (side-by-side preview)
 *   3. Sets style="zoom:0.612..." inline on each .doc-page (viewport scaling)
 *
 * CSS !important cannot remove inline styles — the zoom fix requires JS.
 */

/** JS snippet to run via page.evaluate() before any capture. */
export const NEUTRALIZE_JS = `(() => {
  document.body.style.removeProperty("margin-left");
  document.body.style.removeProperty("padding-left");
  document.documentElement.style.setProperty("--sidebar-w", "0px");
  // Hide fixed-position elements injected by the preview shell (toolbar, nav overlay).
  // Using position:fixed detection is more reliable than class-name selectors because
  // the shell's class names are internal implementation details.
  document.querySelectorAll("body > *").forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (tag === "style" || tag === "script") return;
    const pos = window.getComputedStyle(el).position;
    if (pos === "fixed") el.style.setProperty("display", "none", "important");
  });
  // Reset doc-page zoom injected by the preview shell for browser preview scaling.
  document.querySelectorAll(".doc-page").forEach(el => {
    el.style.removeProperty("zoom");
    el.style.zoom = "1";
  });
})()`;

/**
 * CSS injected via page.addStyleTag() for document exports.
 * Restores flex-direction:column and enforces A4 page geometry.
 */
export const DOC_PRINT_CSS = `
  .doc-container {
    display: flex !important;
    flex-direction: column !important;
    padding: 0 !important;
    gap: 0 !important;
    background: transparent !important;
    align-items: stretch !important;
  }
  .doc-page {
    width: 100% !important;
    height: 1123px !important;
    min-height: unset !important;
    overflow: hidden !important;
    box-shadow: none !important;
    flex-shrink: 0 !important;
  }
`;

/** Convenience wrapper: runs NEUTRALIZE_JS in the page context. */
export async function applyNeutralize(page) {
  await page.evaluate(NEUTRALIZE_JS);
}
