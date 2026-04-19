// Default logo overlay size derived from the active canvas.
//
// 20% of the shortest side yields a brand-forward default that stays
// proportional across formats:
//   A4 document (794x1123) -> 159 px
//   Square (1080x1080)     -> 216 px
//   16:9 slide (1280x720)  -> 144 px
//
// The visual weight at this size depends on the SVG's own viewBox
// padding — marks with tight bounding boxes read larger than marks with
// generous internal whitespace at the same px height. The user can
// override via the inspector slider; the state layer tracks the
// override and suppresses recomputation while it is active.

export const LOGO_SIZE_FRACTION = 0.2;

export function defaultLogoSize(canvas) {
  if (!canvas || typeof canvas.w !== "number" || typeof canvas.h !== "number") {
    return 64;
  }
  const min = Math.min(canvas.w, canvas.h);
  return Math.round(min * LOGO_SIZE_FRACTION);
}
