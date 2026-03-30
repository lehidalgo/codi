#!/usr/bin/env npx tsx
/**
 * GIF Builder - Core module for assembling frames into GIFs optimized for Slack.
 *
 * Assembles PNG frame buffers into an animated GIF using sharp and gif-encoder-2
 * (or falls back to ImageMagick convert). Includes color optimization and
 * deduplication.
 *
 * Dependencies: sharp (required), gif-encoder-2 (optional, improves quality)
 *
 * Usage as library:
 *   import { GIFBuilder } from "./gif-builder.js";
 *   const builder = new GIFBuilder(128, 128, 10);
 *   builder.addFrame(pngBuffer);
 *   await builder.save("output.gif");
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

export interface GIFInfo {
  path: string;
  size_kb: number;
  size_mb: number;
  dimensions: string;
  frame_count: number;
  fps: number;
  duration_seconds: number;
  colors: number;
}

export class GIFBuilder {
  width: number;
  height: number;
  fps: number;
  frames: Buffer[] = [];

  constructor(width = 480, height = 480, fps = 15) {
    this.width = width;
    this.height = height;
    this.fps = fps;
  }

  /** Add a PNG buffer as a frame. */
  addFrame(pngBuffer: Buffer): void {
    this.frames.push(pngBuffer);
  }

  /** Add multiple PNG buffers. */
  addFrames(buffers: Buffer[]): void {
    for (const buf of buffers) {
      this.addFrame(buf);
    }
  }

  /**
   * Remove near-duplicate consecutive frames.
   * Returns number of frames removed.
   */
  async deduplicateFrames(threshold = 0.9995): Promise<number> {
    if (this.frames.length < 2) return 0;

    // @ts-expect-error sharp is a user-project dependency
    let sharp: typeof import("sharp");
    try {
      // @ts-expect-error sharp is a user-project dependency
      sharp = await import("sharp");
    } catch {
      return 0; // can't compare without sharp
    }

    const deduplicated: Buffer[] = [this.frames[0]!];
    let removedCount = 0;

    for (let i = 1; i < this.frames.length; i++) {
      const prevRaw = await sharp.default(deduplicated.at(-1)).raw().toBuffer();
      const currRaw = await sharp.default(this.frames[i]).raw().toBuffer();

      // Calculate similarity
      let diffSum = 0;
      const len = Math.min(prevRaw.length, currRaw.length);
      for (let j = 0; j < len; j++) {
        diffSum += Math.abs(prevRaw[j]! - currRaw[j]!);
      }
      const similarity = 1.0 - diffSum / (len * 255);

      if (similarity < threshold) {
        deduplicated.push(this.frames[i]!);
      } else {
        removedCount++;
      }
    }

    this.frames = deduplicated;
    return removedCount;
  }

  /** Save frames as optimized GIF. */
  async save(
    outputPath: string,
    numColors = 128,
    optimizeForEmoji = false,
    removeDuplicates = false,
  ): Promise<GIFInfo> {
    if (this.frames.length === 0) {
      throw new Error("No frames to save. Add frames with addFrame() first.");
    }

    if (removeDuplicates) {
      const removed = await this.deduplicateFrames(0.9995);
      if (removed > 0) {
        console.log(`  Removed ${removed} nearly identical frames`);
      }
    }

    if (optimizeForEmoji) {
      this.width = 128;
      this.height = 128;
      numColors = Math.min(numColors, 48);

      if (this.frames.length > 12) {
        console.log(
          `  Reducing frames from ${this.frames.length} to ~12 for emoji size`,
        );
        const keepEvery = Math.max(1, Math.floor(this.frames.length / 12));
        this.frames = this.frames.filter((_, i) => i % keepEvery === 0);
      }
    }

    // Resize frames to target dimensions
    // @ts-expect-error sharp is a user-project dependency
    let sharp: typeof import("sharp") | null = null;
    try {
      // @ts-expect-error sharp is a user-project dependency
      sharp = await import("sharp");
    } catch {
      // sharp not available
    }

    if (sharp) {
      const resized: Buffer[] = [];
      for (const frame of this.frames) {
        const buf = await sharp
          .default(frame)
          .resize(this.width, this.height, { fit: "fill" })
          .png()
          .toBuffer();
        resized.push(buf);
      }
      this.frames = resized;
    }

    // Try gif-encoder-2 first, fall back to ImageMagick
    const saved = await this.saveWithImageMagick(outputPath, numColors);
    if (!saved) {
      await this.saveWithTempFrames(outputPath, numColors);
    }

    const stat = statSync(outputPath);
    const sizeKb = stat.size / 1024;
    const sizeMb = sizeKb / 1024;

    const info: GIFInfo = {
      path: outputPath,
      size_kb: sizeKb,
      size_mb: sizeMb,
      dimensions: `${this.width}x${this.height}`,
      frame_count: this.frames.length,
      fps: this.fps,
      duration_seconds: this.frames.length / this.fps,
      colors: numColors,
    };

    console.log(`\nGIF created successfully!`);
    console.log(`  Path: ${outputPath}`);
    console.log(`  Size: ${sizeKb.toFixed(1)} KB (${sizeMb.toFixed(2)} MB)`);
    console.log(`  Dimensions: ${this.width}x${this.height}`);
    console.log(`  Frames: ${this.frames.length} @ ${this.fps} fps`);
    console.log(`  Duration: ${info.duration_seconds.toFixed(1)}s`);
    console.log(`  Colors: ${numColors}`);

    if (optimizeForEmoji) {
      console.log("  Optimized for emoji (128x128, reduced colors)");
    }
    if (sizeMb > 1.0) {
      console.log(`\n  Note: Large file size (${sizeKb.toFixed(1)} KB)`);
      console.log(
        "  Consider: fewer frames, smaller dimensions, or fewer colors",
      );
    }

    return info;
  }

  /** Save using ImageMagick convert command. */
  private async saveWithImageMagick(
    outputPath: string,
    numColors: number,
  ): Promise<boolean> {
    try {
      execFileSync("which", ["convert"], { stdio: "pipe" });
    } catch {
      return false;
    }

    const tempDir = join(tmpdir(), `gif-builder-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });

    // Write frames as PNGs
    for (let i = 0; i < this.frames.length; i++) {
      writeFileSync(
        join(tempDir, `frame_${String(i).padStart(4, "0")}.png`),
        this.frames[i]!,
      );
    }

    const delay = Math.round(100 / this.fps); // centiseconds per frame
    execFileSync(
      "convert",
      [
        "-delay",
        String(delay),
        "-loop",
        "0",
        "-colors",
        String(numColors),
        join(tempDir, "frame_*.png"),
        outputPath,
      ],
      { stdio: "pipe" },
    );

    // Clean up temp dir
    rmSync(tempDir, { recursive: true, force: true });

    return true;
  }

  /** Fallback: save frames as PNGs and instruct user to assemble. */
  private async saveWithTempFrames(
    outputPath: string,
    _numColors: number,
  ): Promise<void> {
    const frameDir = outputPath.replace(/\.gif$/, "_frames");
    if (!existsSync(frameDir)) mkdirSync(frameDir, { recursive: true });

    for (let i = 0; i < this.frames.length; i++) {
      writeFileSync(
        join(frameDir, `frame_${String(i).padStart(4, "0")}.png`),
        this.frames[i]!,
      );
    }

    console.error("Warning: Neither gif-encoder-2 nor ImageMagick available.");
    console.error(`Frames saved to ${frameDir}/`);
    console.error("Install ImageMagick: brew install imagemagick");
    console.error(
      `Then run: convert -delay ${Math.round(100 / this.fps)} -loop 0 ${frameDir}/frame_*.png ${outputPath}`,
    );

    // Create a single-frame GIF as placeholder
    if (this.frames.length > 0) {
      writeFileSync(outputPath, this.frames[0]!);
    }
  }

  /** Clear all frames. */
  clear(): void {
    this.frames = [];
  }
}
