/**
 * card-builder.js — pure srcdoc HTML builders for Codi content-factory.
 *
 * No DOM reads, no global state. All external values (format, handle, logo)
 * are passed as parameters. Safe to import in Node/Vitest without jsdom.
 *
 * @module card-builder
 */

import { BUILTIN_DEFAULT_SVG } from "./builtin-logo.js";

/**
 * Resolve the effective format for a card.
 * A4 document cards (w=794) always use their native format regardless of the
 * active format selector. All other card types follow stateFormat.
 *
 * @param {{format:{w:number,h:number}|null}} card
 * @param {{w:number,h:number}} stateFormat - The active format from the sidebar
 * @returns {{w:number,h:number}}
 */
export function cardFormat(card, stateFormat) {
  if (card && card.format && card.format.w === 794) return card.format;
  return stateFormat;
}

/**
 * Build the full srcdoc HTML string for a preview or export iframe.
 *
 * @param {{html:string, styleText:string, linkTags:string, format:{w:number,h:number}|null}} card
 * @param {{w:number,h:number}} fmt - Resolved format from cardFormat()
 * @param {object|null} [logo] - Logo state object { visible, x, y, size }
 * @param {string} [handle] - Handle string without @ (e.g. "myuser")
 * @param {boolean} [forExport] - When true: transparent bg, overflow:visible, SVG logo
 * @returns {string}
 */
export function buildCardDoc(
  card,
  fmt,
  logo = null,
  handle = "handle",
  forExport = false,
  inspectorSource = "",
  cardContext = null,
) {
  const bg = forExport ? "background:#070a0f" : "";
  const html = card.html.replace(/@handle/g, "@" + handle);

  let logoHtml = "";
  let logoFontLink = "";
  if (forExport && logo && logo.visible) {
    const usingDefault = !(logo.svg && logo.svg.includes("<svg"));
    let svg = usingDefault ? BUILTIN_DEFAULT_SVG : logo.svg;
    // Only the built-in mark depends on Geist Mono; project/brand SVGs ship
    // their own glyph data.
    if (usingDefault) {
      logoFontLink =
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500&display=swap">';
    }
    // Force an explicit height on the <svg> root so renderers (Playwright
    // screenshot, print layout) always allocate a concrete box. SVGs without
    // width/height attributes fall back to the CSS default 300x150 or zero
    // inside a flex container, and the export ends up blank.
    svg = svg.replace(/<svg\b([^>]*)>/i, (_m, attrs) => {
      let a = attrs;
      a = a.replace(/\s(width|height)="[^"]*"/gi, ""); // drop any existing
      return "<svg" + a + ' height="' + logo.size + '">';
    });
    const wrapStyle = [
      "position:absolute",
      "left:" + logo.x + "%",
      "top:" + logo.y + "%",
      "transform:translate(-50%,-50%)",
      "z-index:999",
      "pointer-events:none",
      "opacity:0.88",
      "line-height:0",
    ].join(";");
    logoHtml = '<div style="' + wrapStyle + '">' + svg + "</div>";
  }

  const bodyOverflow = forExport ? "overflow:visible" : "overflow:hidden";
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    card.linkTags,
    logoFontLink,
    "<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    "html,body{width:" +
      fmt.w +
      "px;height:" +
      fmt.h +
      "px;" +
      bodyOverflow +
      ";position:relative;" +
      bg +
      "}",
    card.styleText +
      // Override format vars and canvas-root dimensions to match the active
      // format selector. Injected after template CSS so it wins the cascade.
      // The margin reset catches the common template bug where a
      // canvas-root carries layout margin meant for a multi-page container
      // (e.g. `.doc-page { margin: 24px auto }`). In the isolated per-card
      // iframe, that margin exposes the body's background as a stripe above
      // or beside the card.
      ":root{--w:" +
      fmt.w +
      "px;--h:" +
      fmt.h +
      "px}" +
      ".social-card,.slide,.doc-page{margin:0!important}" +
      ".social-card{width:" +
      fmt.w +
      "px!important;height:" +
      fmt.h +
      "px!important}" +
      ".slide{width:" +
      fmt.w +
      "px!important;height:" +
      fmt.h +
      "px!important}" +
      ".doc-page{width:" +
      fmt.w +
      "px!important;min-height:" +
      fmt.h +
      "px!important}" +
      "</style></head><body>",
    html + logoHtml,
    // Live element inspector — inlined into every interactive preview card
    // so URL resolution inside srcdoc iframes is not a factor. Starts
    // dormant; the parent app's Inspect toggle calls
    // iframe.contentWindow.__HLI__.setDormant(false) to activate it.
    //
    // __CF_CARD_CONTEXT__ tells the inspector which project/file/card this
    // iframe belongs to. Every selection and event the inspector posts
    // carries this context so the agent never has to guess what to edit.
    !forExport && inspectorSource
      ? "<script>window.__HLI_DORMANT__=true;window.__CF_CARD_CONTEXT__=" +
        JSON.stringify(cardContext || null).replace(/</g, "\\u003c") +
        ";</script><script>" +
        inspectorSource +
        "</script>"
      : "",
    "</body></html>",
  ].join("");
}

/**
 * Build the srcdoc HTML string for a gallery thumbnail iframe.
 * Always uses the card's native format. Handle replaced with "@preview".
 *
 * @param {{html:string, styleText:string, linkTags:string, format:{w:number,h:number}|null}} card
 * @param {{w:number,h:number}} fmt - Resolved format (use cardFormat() with native template format)
 * @returns {string}
 */
export function buildThumbDoc(card, fmt) {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    card.linkTags || "",
    "<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    "html,body{width:" + fmt.w + "px;height:" + fmt.h + "px;overflow:hidden}",
    (card.styleText || "") +
      ":root{--w:" +
      fmt.w +
      "px;--h:" +
      fmt.h +
      "px}" +
      ".social-card,.slide,.doc-page{margin:0!important}" +
      ".social-card{width:" +
      fmt.w +
      "px!important;height:" +
      fmt.h +
      "px!important}" +
      ".slide{width:" +
      fmt.w +
      "px!important;height:" +
      fmt.h +
      "px!important}" +
      ".doc-page{width:" +
      fmt.w +
      "px!important;min-height:" +
      fmt.h +
      "px!important}" +
      "</style></head><body>",
    (card.html || "")
      .replace(/@handle/g, "@preview")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") + "</body></html>",
  ].join("");
}

/**
 * Compute the display dimensions and scale for rendering a card in the canvas area.
 *
 * @param {{w:number,h:number}} fmt - Resolved format from cardFormat()
 * @param {{canvasW:number, canvasH:number, zoom:number, viewMode:string}} opts
 * @returns {{scale:number, fmt:{w:number,h:number}, displayW:number, displayH:number}}
 */
export function computeCardSize(fmt, { canvasW, canvasH, zoom, viewMode } = {}) {
  const cw = Math.max(canvasW ?? 400, 400);
  const ch = Math.max(canvasH ?? 300, 300);
  const z = zoom ?? 1;
  const mode = viewMode ?? "grid";
  let scale;
  if (mode === "app") {
    const fitW = (cw - 140) / fmt.w;
    const fitH = (ch - 140) / fmt.h; // 140 = ~70px top + 70px bottom breathing room
    const fitScale = Math.min(fitW, fitH);
    // z = 1.0 means "fit to canvas"; z > 1 zooms in, z < 1 zooms out
    scale = fitScale * z;
  } else {
    const refW = Math.min(cw - 80, 520);
    scale = (refW / fmt.w) * z;
  }
  return { scale, fmt, displayW: Math.round(fmt.w * scale), displayH: Math.round(fmt.h * scale) };
}
