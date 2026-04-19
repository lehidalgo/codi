// Default logo overlay size derived from the active canvas.
//
// 8% of the shortest side yields a consistent visual weight across formats:
//   A4 document (794x1123) -> 64 px
//   Square (1080x1080)     -> 86 px
//   16:9 slide (1280x720)  -> 58 px
//
// The user can override via the inspector slider; the state layer tracks
// the override and suppresses recomputation while it is active.

export const LOGO_SIZE_FRACTION = 0.08;

export function defaultLogoSize(canvas) {
  if (!canvas || typeof canvas.w !== "number" || typeof canvas.h !== "number") {
    return 64;
  }
  const min = Math.min(canvas.w, canvas.h);
  return Math.round(min * LOGO_SIZE_FRACTION);
}
