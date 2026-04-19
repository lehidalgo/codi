// Content-fit measurement + remediation logic.
//
// Pure functions — browser call sites pass already-measured page dimensions
// so this module stays unit-testable in Node without jsdom. The browser
// adapter lives in validation-panel.js and bridges to the DOM.
//
// Severity is fixed per content type (document, slides, social all error
// on any overflow). What varies is the suggested remediation:
//
//   document -> paginate when overflow > 15%, else tighten
//   slides   -> split when overflow > 15%, else tighten
//   social   -> always tighten (single canvas, cannot paginate)

export const HIGH_OVERFLOW_PCT = 15;

const REMEDIATION_MATRIX = {
  document: { high: "paginate", low: "tighten", options: ["paginate", "tighten"] },
  slides: { high: "split", low: "tighten", options: ["split", "tighten"] },
  social: { high: "tighten", low: "tighten", options: ["tighten"] },
};

/**
 * Measure overflow across one or more canvas pages.
 *
 * @param {{canvas:{w:number,h:number}, pages:Array<{scrollHeight:number,scrollWidth:number}>, type:string}} args
 * @returns {{canvas:{w:number,h:number}, measured:{scrollHeight:number,scrollWidth:number}, overflowPx:number, overflowPct:number, pageIndex:number|null, type:string}}
 */
export function measureFit({ canvas, pages, type }) {
  let worstPx = 0;
  let worstIdx = null;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const overflow = Math.max(p.scrollHeight - canvas.h, p.scrollWidth - canvas.w, 0);
    if (overflow > worstPx) {
      worstPx = overflow;
      worstIdx = i + 1;
    }
  }
  const overflowPct = worstPx === 0 ? 0 : (worstPx / canvas.h) * 100;
  return {
    canvas,
    measured: worstIdx ? pages[worstIdx - 1] : pages[0] || { scrollHeight: 0, scrollWidth: 0 },
    overflowPx: worstPx,
    overflowPct: Number(overflowPct.toFixed(1)),
    pageIndex: worstIdx,
    type,
  };
}

/**
 * Resolve the suggested remediation + allowed options for a given overflow.
 * Single source of truth consumed by the badge renderer and the fit-report
 * writer.
 */
export function computeRemediation({ overflowPct, type }) {
  const matrix = REMEDIATION_MATRIX[type] || REMEDIATION_MATRIX.document;
  const remediation = overflowPct > HIGH_OVERFLOW_PCT ? matrix.high : matrix.low;
  return { remediation, options: matrix.options };
}

/**
 * Build the human- and agent-readable directive shown in the validation
 * panel and persisted in state/fit-report.json. Callers pass the full
 * measurement + resolved remediation so wording stays consistent.
 */
export function buildDirective({ canvas, overflowPx, overflowPct, pageIndex, remediation, type }) {
  const fmt = canvas.w + "x" + canvas.h;
  const pagePrefix = type === "document" && pageIndex ? "Page " + pageIndex + " " : "";
  if (remediation === "paginate") {
    return (
      pagePrefix +
      "exceeds " +
      fmt +
      " by " +
      overflowPx +
      "px (" +
      overflowPct +
      "%). Add a new .doc-page sibling after the offending page and move overflow content into it. Preserve the existing header on every page."
    );
  }
  if (remediation === "split") {
    return (
      "Slide exceeds " +
      fmt +
      " by " +
      overflowPx +
      "px (" +
      overflowPct +
      "%). Split this slide into multiple slides at the next natural section break (h2 or hr)."
    );
  }
  return (
    pagePrefix +
    "exceeds " +
    fmt +
    " by " +
    overflowPx +
    "px (" +
    overflowPct +
    "%). Tighten the layout: reduce padding, condense copy, or lower font sizes until content fits."
  );
}
