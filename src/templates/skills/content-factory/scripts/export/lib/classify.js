// @ts-nocheck

/**
 * classify.js — determine the content type of a loaded HTML page via DOM probe.
 *
 * The page must already be navigated to the target URL before calling classify().
 * Returns one of: "slides" | "document" | "unknown"
 */

/**
 * @param {import('playwright').Page} page  An already-navigated Playwright page
 * @returns {Promise<"slides"|"document"|"unknown">}
 */
export async function classify(page) {
  const { hasSlides, hasDocPages } = await page.evaluate(() => ({
    hasSlides: document.querySelectorAll(".slide").length > 0,
    hasDocPages: document.querySelectorAll(".doc-page").length > 0,
  }));

  if (hasSlides) return "slides";
  if (hasDocPages) return "document";
  return "unknown";
}
