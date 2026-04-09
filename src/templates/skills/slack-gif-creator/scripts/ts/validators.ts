#!/usr/bin/env npx tsx
/**
 * Validators - Check if GIFs meet Slack's requirements.
 *
 * Validates dimensions, file size, and frame count for Slack emoji and message GIFs.
 * Uses sharp for reading GIF metadata. Falls back to file size check if unavailable.
 *
 * Usage: npx tsx validators.ts <gif-path> [--emoji | --message] [--quiet]
 */

import { statSync } from "node:fs";

export interface ValidationResult {
  file: string;
  passes: boolean;
  width: number;
  height: number;
  size_kb: number;
  size_mb: number;
  frame_count: number;
  duration_seconds: number | null;
  fps: number | null;
  is_emoji: boolean;
  optimal: boolean | null;
}

export async function validateGif(
  gifPath: string,
  isEmoji = true,
  verbose = true,
): Promise<[boolean, ValidationResult]> {
  const stat = statSync(gifPath);
  const sizeBytes = stat.size;
  const sizeKb = sizeBytes / 1024;
  const sizeMb = sizeKb / 1024;

  let width = 0;
  let height = 0;
  let frameCount = 1;
  let durationMs = 100;

  // Try sharp for GIF metadata
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(gifPath, { animated: true }).metadata();
    width = metadata.width ?? 0;
    height = metadata.pageHeight ?? metadata.height ?? 0;
    frameCount = metadata.pages ?? 1;
    durationMs = metadata.delay?.[0] ?? 100;
  } catch {
    // Try identify (ImageMagick) as fallback
    try {
      const { execFileSync } = await import("node:child_process");
      const output = execFileSync("identify", ["-format", "%w %h %n %T\\n", gifPath], {
        encoding: "utf-8",
        stdio: "pipe",
      });
      const firstLine = output.trim().split("\n")[0];
      if (firstLine) {
        const parts = firstLine.split(/\s+/);
        width = parseInt(parts[0] ?? "0", 10);
        height = parseInt(parts[1] ?? "0", 10);
        frameCount = parseInt(parts[2] ?? "1", 10);
        durationMs = parseInt(parts[3] ?? "10", 10) * 10; // ImageMagick reports centiseconds
      }
    } catch {
      if (verbose) {
        console.error("Warning: Neither sharp nor ImageMagick available for GIF analysis.");
      }
    }
  }

  const totalDuration = frameCount > 1 ? (durationMs * frameCount) / 1000 : null;
  const fps = totalDuration && totalDuration > 0 ? frameCount / totalDuration : null;

  // Validate dimensions
  let dimPass: boolean;
  let optimal: boolean | null = null;

  if (isEmoji) {
    optimal = width === 128 && height === 128;
    const acceptable = width === height && width >= 64 && width <= 128;
    dimPass = acceptable;
  } else {
    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    const aspectRatio = minDim > 0 ? maxDim / minDim : Infinity;
    dimPass = aspectRatio <= 2.0 && minDim >= 320 && minDim <= 640;
  }

  const results: ValidationResult = {
    file: gifPath,
    passes: dimPass,
    width,
    height,
    size_kb: sizeKb,
    size_mb: sizeMb,
    frame_count: frameCount,
    duration_seconds: totalDuration,
    fps,
    is_emoji: isEmoji,
    optimal,
  };

  if (verbose) {
    const name = gifPath.split("/").pop() ?? gifPath;
    console.log(`\nValidating ${name}:`);

    let dimLabel = "";
    if (isEmoji) {
      if (optimal) dimLabel = " (optimal)";
      else if (dimPass) dimLabel = " (acceptable)";
    }
    console.log(`  Dimensions: ${width}x${height}${dimLabel}`);

    const sizeStr =
      sizeMb >= 1.0
        ? `${sizeKb.toFixed(1)} KB (${sizeMb.toFixed(2)} MB)`
        : `${sizeKb.toFixed(1)} KB`;
    console.log(`  Size: ${sizeStr}`);

    const fpsStr = fps ? ` @ ${fps.toFixed(1)} fps (${totalDuration!.toFixed(1)}s)` : "";
    console.log(`  Frames: ${frameCount}${fpsStr}`);

    if (!dimPass) {
      console.log(
        `  Note: ${isEmoji ? "Emoji should be 128x128" : "Unusual dimensions for Slack"}`,
      );
    }
    if (sizeMb > 5.0) {
      console.log("  Note: Large file size - consider fewer frames/colors");
    }
  }

  return [dimPass, results];
}

/** Quick check if GIF is ready for Slack. */
export async function isSlackReady(
  gifPath: string,
  isEmoji = true,
  verbose = true,
): Promise<boolean> {
  const [passes] = await validateGif(gifPath, isEmoji, verbose);
  return passes;
}

// CLI entry point
if (process.argv[1]?.endsWith("validators.ts")) {
  const gifPath = process.argv[2];
  if (!gifPath) {
    console.error("Usage: npx tsx validators.ts <gif-path> [--emoji | --message] [--quiet]");
    process.exit(1);
  }

  const isEmoji = !process.argv.includes("--message");
  const verbose = !process.argv.includes("--quiet");

  const [passes, results] = await validateGif(gifPath, isEmoji, verbose);
  if (!verbose) {
    console.log(JSON.stringify(results, null, 2));
  }
  process.exit(passes ? 0 : 1);
}
