#!/usr/bin/env npx tsx
/**
 * Frame Composer - Utilities for composing visual elements into frames.
 *
 * Provides functions for drawing shapes, text, and creating backgrounds.
 * Uses sharp for image manipulation (install with: npm install sharp).
 *
 * These are reference implementations — the agent can also use sharp directly
 * for more complex compositions.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Create SVG for a solid color background.
 * Returns SVG string that can be used with sharp.
 */
export function createBlankFrameSvg(
  width: number,
  height: number,
  color: RGB = { r: 255, g: 255, b: 255 },
): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="rgb(${color.r},${color.g},${color.b})"/>
</svg>`;
}

/**
 * Create SVG for a vertical gradient background.
 */
export function createGradientBackgroundSvg(
  width: number,
  height: number,
  topColor: RGB,
  bottomColor: RGB,
): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(${topColor.r},${topColor.g},${topColor.b})"/>
      <stop offset="100%" stop-color="rgb(${bottomColor.r},${bottomColor.g},${bottomColor.b})"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
</svg>`;
}

/**
 * Create SVG circle element string.
 */
export function circleSvg(
  cx: number,
  cy: number,
  radius: number,
  fill?: RGB,
  stroke?: RGB,
  strokeWidth = 1,
): string {
  const fillStr = fill ? `fill="rgb(${fill.r},${fill.g},${fill.b})"` : 'fill="none"';
  const strokeStr = stroke
    ? `stroke="rgb(${stroke.r},${stroke.g},${stroke.b})" stroke-width="${strokeWidth}"`
    : "";
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" ${fillStr} ${strokeStr}/>`;
}

/**
 * Create SVG text element string.
 */
export function textSvg(
  text: string,
  x: number,
  y: number,
  color: RGB = { r: 0, g: 0, b: 0 },
  fontSize = 14,
  centered = false,
): string {
  const anchor = centered ? 'text-anchor="middle" dominant-baseline="central"' : "";
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<text x="${x}" y="${y}" fill="rgb(${color.r},${color.g},${color.b})" font-size="${fontSize}" font-family="sans-serif" ${anchor}>${escaped}</text>`;
}

/**
 * Create SVG for a 5-pointed star.
 */
export function starSvg(
  cx: number,
  cy: number,
  size: number,
  fill: RGB,
  stroke?: RGB,
  strokeWidth = 1,
): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = ((i * 36 - 90) * Math.PI) / 180;
    const radius = i % 2 === 0 ? size : size * 0.4;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  const fillStr = `fill="rgb(${fill.r},${fill.g},${fill.b})"`;
  const strokeStr = stroke
    ? `stroke="rgb(${stroke.r},${stroke.g},${stroke.b})" stroke-width="${strokeWidth}"`
    : "";
  return `<polygon points="${points.join(" ")}" ${fillStr} ${strokeStr}/>`;
}

/**
 * Compose an SVG frame from background + element SVG strings.
 * Returns a complete SVG document string.
 */
export function composeSvgFrame(
  width: number,
  height: number,
  backgroundSvg: string,
  elements: string[],
): string {
  // Extract inner content from background SVG
  const bgInner = backgroundSvg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .replace(/<defs>[\s\S]*?<\/defs>/, (match) => match); // preserve defs

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
${bgInner}
${elements.join("\n")}
</svg>`;
}

/**
 * Convert SVG string to PNG buffer using sharp.
 * Returns null if sharp is not available.
 */
export async function svgToPng(
  svgContent: string,
  width: number,
  height: number,
): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(Buffer.from(svgContent)).resize(width, height).png().toBuffer();
  } catch {
    return null;
  }
}
