/**
 * card-builder.js — pure srcdoc HTML builders for Codi content-factory.
 *
 * No DOM reads, no global state. All external values (format, handle) are
 * passed as parameters. Safe to import in Node/Vitest without jsdom.
 *
 * @module card-builder
 */

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
export function buildCardDoc(card, fmt, logo = null, handle = "handle", forExport = false) {
  const bg = forExport ? "background:#070a0f" : "";
  const html = card.html.replace(/@handle/g, "@" + handle);

  let logoHtml = "";
  let logoFontLink = "";
  if (forExport && logo && logo.visible) {
    logoFontLink =
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500&display=swap">';
    const svgStyle = [
      "position:absolute",
      "left:" + logo.x + "%",
      "top:" + logo.y + "%",
      "transform:translate(-50%,-50%)",
      "overflow:visible",
      "z-index:999",
      "pointer-events:none",
      "opacity:0.88",
    ].join(";");
    logoHtml = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" style="' + svgStyle + '">',
      "<defs>",
      '<linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">',
      '<stop offset="0%" stop-color="#56b6c2"/>',
      '<stop offset="100%" stop-color="#61afef"/>',
      "</linearGradient>",
      "</defs>",
      '<text x="0" y="0"',
      " font-family=\"'Geist Mono',monospace\"",
      ' font-size="' + logo.size + '"',
      ' font-weight="500"',
      ' fill="url(#cg)"',
      ' text-anchor="middle"',
      ' dominant-baseline="middle"',
      ">codi</text>",
      "</svg>",
    ].join("");
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
      // Override format vars and card dimensions to match the active format selector.
      // Injected after template CSS so it wins the cascade without !important on vars.
      // !important on .social-card catches templates that hardcode px instead of using vars.
      ":root{--w:" +
      fmt.w +
      "px;--h:" +
      fmt.h +
      "px}" +
      ".social-card{width:" +
      fmt.w +
      "px!important;height:" +
      fmt.h +
      "px!important}" +
      "</style></head><body>",
    html + logoHtml + "</body></html>",
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
      ".social-card{width:" +
      fmt.w +
      "px!important;height:" +
      fmt.h +
      "px!important}" +
      "</style></head><body>",
    (card.html || "").replace(/@handle/g, "@preview") + "</body></html>",
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
