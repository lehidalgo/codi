#!/usr/bin/env npx tsx
/**
 * Easing Functions - Timing functions for smooth animations.
 *
 * All functions take a value t (0.0 to 1.0) and return eased value (0.0 to 1.0).
 * Pure math — no external dependencies.
 */

export type EasingFn = (t: number) => number;

export function linear(t: number): number {
  return t;
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  return (t - 1) * (t - 1) * (t - 1) + 1;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    const t2 = t - 1.5 / 2.75;
    return 7.5625 * t2 * t2 + 0.75;
  } else if (t < 2.5 / 2.75) {
    const t2 = t - 2.25 / 2.75;
    return 7.5625 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / 2.75;
    return 7.5625 * t2 * t2 + 0.984375;
  }
}

export function easeInBounce(t: number): number {
  return 1 - easeOutBounce(1 - t);
}

export function easeInOutBounce(t: number): number {
  return t < 0.5
    ? easeInBounce(t * 2) * 0.5
    : easeOutBounce(t * 2 - 1) * 0.5 + 0.5;
}

export function easeInElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
}

export function easeInOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const t2 = t * 2 - 1;
  if (t2 < 0) {
    return -0.5 * Math.pow(2, 10 * t2) * Math.sin((t2 - 0.1) * 5 * Math.PI);
  }
  return Math.pow(2, -10 * t2) * Math.sin((t2 - 0.1) * 5 * Math.PI) * 0.5 + 1;
}

export function easeBackIn(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

export function easeBackOut(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeBackInOut(t: number): number {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  if (t < 0.5) {
    return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
  }
  return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

/** Convenience mapping of easing names to functions. */
export const EASING_FUNCTIONS: Record<string, EasingFn> = {
  linear,
  ease_in: easeInQuad,
  ease_out: easeOutQuad,
  ease_in_out: easeInOutQuad,
  bounce_in: easeInBounce,
  bounce_out: easeOutBounce,
  bounce: easeInOutBounce,
  elastic_in: easeInElastic,
  elastic_out: easeOutElastic,
  elastic: easeInOutElastic,
  back_in: easeBackIn,
  back_out: easeBackOut,
  back_in_out: easeBackInOut,
  anticipate: easeBackIn,
  overshoot: easeBackOut,
};

/** Get easing function by name. */
export function getEasing(name = "linear"): EasingFn {
  return EASING_FUNCTIONS[name] ?? linear;
}

/** Interpolate between two values with easing. */
export function interpolate(
  start: number,
  end: number,
  t: number,
  easing = "linear",
): number {
  const easeFn = getEasing(easing);
  const easedT = easeFn(t);
  return start + (end - start) * easedT;
}

/** Apply squash/stretch deformation (preserves volume). */
export function applySquashStretch(
  baseScale: [number, number],
  intensity: number,
  direction: "vertical" | "horizontal" | "both" = "vertical",
): [number, number] {
  let [widthScale, heightScale] = baseScale;

  if (direction === "vertical") {
    heightScale *= 1 - intensity * 0.5;
    widthScale *= 1 + intensity * 0.5;
  } else if (direction === "horizontal") {
    widthScale *= 1 - intensity * 0.5;
    heightScale *= 1 + intensity * 0.5;
  } else {
    widthScale *= 1 - intensity * 0.3;
    heightScale *= 1 - intensity * 0.3;
  }

  return [widthScale, heightScale];
}

/** Calculate position along a parabolic arc (natural motion path). */
export function calculateArcMotion(
  start: [number, number],
  end: [number, number],
  height: number,
  t: number,
): [number, number] {
  const [x1, y1] = start;
  const [x2, y2] = end;

  const x = x1 + (x2 - x1) * t;
  const arcOffset = 4 * height * t * (1 - t);
  const y = y1 + (y2 - y1) * t - arcOffset;

  return [x, y];
}
