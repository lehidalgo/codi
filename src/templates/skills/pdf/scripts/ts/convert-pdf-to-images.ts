#!/usr/bin/env npx tsx
/**
 * Convert PDF pages to PNG images.
 *
 * Uses external tools (pdftoppm from poppler-utils, or convert from ImageMagick)
 * since Node.js has no built-in PDF rasterizer.
 *
 * Usage: npx tsx convert-pdf-to-images.ts <input.pdf> <output-dir> [max-dim]
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

function findTool(): "pdftoppm" | "convert" | null {
  for (const tool of ["pdftoppm", "convert"] as const) {
    try {
      execFileSync("which", [tool], { stdio: "pipe" });
      return tool;
    } catch {
      // not found
    }
  }
  return null;
}

export function convertPdfToImages(
  pdfPath: string,
  outputDir: string,
  maxDim = 1000,
): void {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const tool = findTool();
  if (!tool) {
    console.error(
      "Error: No PDF-to-image tool found. Install poppler-utils (pdftoppm) or ImageMagick (convert).",
    );
    console.error("  macOS:  brew install poppler");
    console.error("  Linux:  apt install poppler-utils");
    process.exit(1);
  }

  if (tool === "pdftoppm") {
    // pdftoppm outputs page_-01.png, page_-02.png, etc.
    const prefix = join(outputDir, "page_");
    execFileSync("pdftoppm", ["-png", "-r", "200", pdfPath, prefix], {
      stdio: "pipe",
    });

    // Rename pdftoppm output (page_-01.png → page_1.png)
    const files = readdirSync(outputDir)
      .filter((f) => f.startsWith("page_") && f.endsWith(".png"))
      .sort();

    let count = 0;
    for (const file of files) {
      count++;
      const src = join(outputDir, file);
      const dst = join(outputDir, `page_${count}.png`);
      if (src !== dst) {
        renameSync(src, dst);
      }

      // Resize if needed using sips (macOS) or convert
      try {
        const sizeOutput = execFileSync(
          "sips",
          ["-g", "pixelWidth", "-g", "pixelHeight", dst],
          {
            encoding: "utf-8",
            stdio: "pipe",
          },
        );
        const widthMatch = sizeOutput.match(/pixelWidth:\s*(\d+)/);
        const heightMatch = sizeOutput.match(/pixelHeight:\s*(\d+)/);
        if (widthMatch && heightMatch) {
          const w = parseInt(widthMatch[1]!, 10);
          const h = parseInt(heightMatch[1]!, 10);
          if (w > maxDim || h > maxDim) {
            const scale = Math.min(maxDim / w, maxDim / h);
            const newW = Math.round(w * scale);
            const newH = Math.round(h * scale);
            execFileSync("sips", ["-z", String(newH), String(newW), dst], {
              stdio: "pipe",
            });
          }
          console.log(`Saved page ${count} as ${dst} (size: ${w}x${h})`);
        }
      } catch {
        console.log(`Saved page ${count} as ${dst}`);
      }
    }

    console.log(`Converted ${count} pages to PNG images`);
  } else {
    // ImageMagick convert
    execFileSync(
      "convert",
      ["-density", "200", pdfPath, join(outputDir, "page_%d.png")],
      {
        stdio: "pipe",
      },
    );
    const files = readdirSync(outputDir).filter((f) => f.endsWith(".png"));
    console.log(`Converted ${files.length} pages to PNG images`);
  }
}

// CLI entry point
if (process.argv[1]?.endsWith("convert-pdf-to-images.ts")) {
  if (process.argv.length < 4) {
    console.error(
      "Usage: npx tsx convert-pdf-to-images.ts <input.pdf> <output-dir> [max-dim]",
    );
    process.exit(1);
  }
  const pdfPath = process.argv[2]!;
  const outputDir = process.argv[3]!;
  const maxDim = process.argv[4] ? parseInt(process.argv[4], 10) : 1000;
  convertPdfToImages(pdfPath, outputDir, maxDim);
}
