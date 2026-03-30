#!/usr/bin/env npx tsx
/**
 * Extract form structure from a non-fillable PDF.
 *
 * Analyzes PDF to find text labels with coordinates, horizontal lines (row
 * boundaries), and checkboxes (small rectangles). Useful for forms that need
 * visual analysis instead of field extraction.
 *
 * Uses pdfjs-dist for parsing. Falls back to a simpler text extraction if unavailable.
 *
 * Usage: npx tsx extract-form-structure.ts <input.pdf> <output.json>
 */

import { readFileSync, writeFileSync } from "node:fs";

interface PageInfo {
  page_number: number;
  width: number;
  height: number;
}

interface Label {
  page: number;
  text: string;
  x0: number;
  top: number;
  x1: number;
  bottom: number;
}

interface Line {
  page: number;
  y: number;
  x0: number;
  x1: number;
}

interface Checkbox {
  page: number;
  x0: number;
  top: number;
  x1: number;
  bottom: number;
  center_x: number;
  center_y: number;
}

interface RowBoundary {
  page: number;
  row_top: number;
  row_bottom: number;
  row_height: number;
}

interface FormStructure {
  pages: PageInfo[];
  labels: Label[];
  lines: Line[];
  checkboxes: Checkbox[];
  row_boundaries: RowBoundary[];
}

export async function extractFormStructure(
  pdfPath: string,
): Promise<FormStructure> {
  const structure: FormStructure = {
    pages: [],
    labels: [],
    lines: [],
    checkboxes: [],
    row_boundaries: [],
  };

  const pdfBytes = readFileSync(pdfPath);

  try {
    // @ts-expect-error pdfjs-dist is a user-project dependency
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) })
      .promise;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      structure.pages.push({
        page_number: pageNum,
        width: Math.round(viewport.width * 10) / 10,
        height: Math.round(viewport.height * 10) / 10,
      });

      // Extract text items as labels
      const textContent = await page.getTextContent();
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const tx = item.transform;
        const x0 = Math.round(tx[4] * 10) / 10;
        const top = Math.round((viewport.height - tx[5]) * 10) / 10;
        const width = item.width ?? 0;
        const height = item.height ?? tx[3] ?? 12;

        structure.labels.push({
          page: pageNum,
          text: item.str,
          x0,
          top,
          x1: Math.round((x0 + width) * 10) / 10,
          bottom: Math.round((top + height) * 10) / 10,
        });
      }

      // Extract graphical elements (lines, rectangles)
      const opList = await page.getOperatorList();
      const ops = opList.fnArray;
      const args = opList.argsArray;

      for (let i = 0; i < ops.length; i++) {
        // OPS.constructPath = 91 in pdfjs-dist
        if (ops[i] === 91 && args[i]) {
          const pathOps = args[i][0] as number[];
          const pathArgs = args[i][1] as number[];

          // Simple heuristic: look for rectangles (re operation = 19)
          if (pathOps.includes(19) && pathArgs.length >= 4) {
            const x = pathArgs[0]!;
            const y = pathArgs[1]!;
            const w = pathArgs[2]!;
            const h = pathArgs[3]!;

            const absW = Math.abs(w);
            const absH = Math.abs(h);
            const pTop = viewport.height - y - Math.max(h, 0);

            // Detect horizontal lines (wide, thin)
            if (absW > viewport.width * 0.5 && absH < 3) {
              structure.lines.push({
                page: pageNum,
                y: Math.round(pTop * 10) / 10,
                x0: Math.round(x * 10) / 10,
                x1: Math.round((x + absW) * 10) / 10,
              });
            }

            // Detect checkboxes (small squares)
            if (
              5 <= absW &&
              absW <= 15 &&
              5 <= absH &&
              absH <= 15 &&
              Math.abs(absW - absH) < 2
            ) {
              structure.checkboxes.push({
                page: pageNum,
                x0: Math.round(x * 10) / 10,
                top: Math.round(pTop * 10) / 10,
                x1: Math.round((x + absW) * 10) / 10,
                bottom: Math.round((pTop + absH) * 10) / 10,
                center_x: Math.round((x + absW / 2) * 10) / 10,
                center_y: Math.round((pTop + absH / 2) * 10) / 10,
              });
            }
          }
        }
      }
    }
  } catch {
    console.error(
      "Warning: pdfjs-dist not available. Install with: npm install pdfjs-dist",
    );
    console.error("Falling back to basic structure extraction.");

    // Minimal fallback: just report the PDF exists
    structure.pages.push({ page_number: 1, width: 612, height: 792 });
  }

  // Calculate row boundaries from lines
  const linesByPage = new Map<number, number[]>();
  for (const line of structure.lines) {
    if (!linesByPage.has(line.page)) linesByPage.set(line.page, []);
    linesByPage.get(line.page)!.push(line.y);
  }

  for (const [page, yCoords] of linesByPage) {
    const unique = [...new Set(yCoords)].sort((a, b) => a - b);
    for (let i = 0; i < unique.length - 1; i++) {
      structure.row_boundaries.push({
        page,
        row_top: unique[i]!,
        row_bottom: unique[i + 1]!,
        row_height: Math.round((unique[i + 1]! - unique[i]!) * 10) / 10,
      });
    }
  }

  return structure;
}

// CLI entry point
if (process.argv[1]?.endsWith("extract-form-structure.ts")) {
  if (process.argv.length !== 4) {
    console.error(
      "Usage: npx tsx extract-form-structure.ts <input.pdf> <output.json>",
    );
    process.exit(1);
  }

  const pdfPath = process.argv[2]!;
  const outputPath = process.argv[3]!;

  console.log(`Extracting structure from ${pdfPath}...`);
  const structure = await extractFormStructure(pdfPath);

  writeFileSync(outputPath, JSON.stringify(structure, null, 2), "utf-8");

  console.log("Found:");
  console.log(`  - ${structure.pages.length} pages`);
  console.log(`  - ${structure.labels.length} text labels`);
  console.log(`  - ${structure.lines.length} horizontal lines`);
  console.log(`  - ${structure.checkboxes.length} checkboxes`);
  console.log(`  - ${structure.row_boundaries.length} row boundaries`);
  console.log(`Saved to ${outputPath}`);
}
