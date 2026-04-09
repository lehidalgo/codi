#!/usr/bin/env npx tsx
/**
 * Create a visual validation image by drawing bounding boxes on a PDF page image.
 *
 * Draws entry bounding boxes in red and label bounding boxes in blue.
 * Requires the 'sharp' npm package for image manipulation.
 *
 * Usage: npx tsx create-validation-image.ts <page-number> <fields.json> <input-image> <output-image>
 */

import { readFileSync, writeFileSync } from "node:fs";

interface FormField {
  page_number: number;
  entry_bounding_box: number[];
  label_bounding_box: number[];
}

interface FieldsData {
  form_fields: FormField[];
}

export async function createValidationImage(
  pageNumber: number,
  fieldsJsonPath: string,
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const data: FieldsData = JSON.parse(readFileSync(fieldsJsonPath, "utf-8"));

  // Try sharp first, fall back to SVG overlay approach
  try {
    const sharp = (await import("sharp")).default;

    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    // Build SVG overlay with bounding boxes
    const svgParts: string[] = [];
    svgParts.push(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`);

    let numBoxes = 0;
    for (const field of data.form_fields) {
      if (field.page_number === pageNumber) {
        const [ex0, ey0, ex1, ey1] = field.entry_bounding_box;
        svgParts.push(
          `<rect x="${ex0}" y="${ey0}" width="${ex1! - ex0!}" height="${ey1! - ey0!}" fill="none" stroke="red" stroke-width="2"/>`,
        );

        const [lx0, ly0, lx1, ly1] = field.label_bounding_box;
        svgParts.push(
          `<rect x="${lx0}" y="${ly0}" width="${lx1! - lx0!}" height="${ly1! - ly0!}" fill="none" stroke="blue" stroke-width="2"/>`,
        );
        numBoxes += 2;
      }
    }

    svgParts.push("</svg>");
    const svgBuffer = Buffer.from(svgParts.join("\n"));

    await image.composite([{ input: svgBuffer, top: 0, left: 0 }]).toFile(outputPath);

    console.log(`Created validation image at ${outputPath} with ${numBoxes} bounding boxes`);
  } catch {
    // Fallback: write a JSON description of the boxes (agent can use another tool)
    const boxes: Array<{ type: string; rect: number[]; page: number }> = [];
    for (const field of data.form_fields) {
      if (field.page_number === pageNumber) {
        boxes.push({
          type: "entry",
          rect: field.entry_bounding_box,
          page: pageNumber,
        });
        boxes.push({
          type: "label",
          rect: field.label_bounding_box,
          page: pageNumber,
        });
      }
    }
    writeFileSync(outputPath + ".json", JSON.stringify(boxes, null, 2), "utf-8");
    console.error("Warning: 'sharp' not available. Install with: npm install sharp");
    console.log(`Wrote ${boxes.length} bounding box definitions to ${outputPath}.json`);
  }
}

// CLI entry point
if (process.argv[1]?.endsWith("create-validation-image.ts")) {
  if (process.argv.length !== 6) {
    console.error(
      "Usage: npx tsx create-validation-image.ts <page-number> <fields.json> <input-image> <output-image>",
    );
    process.exit(1);
  }
  const pageNumber = parseInt(process.argv[2]!, 10);
  const fieldsJsonPath = process.argv[3]!;
  const inputImagePath = process.argv[4]!;
  const outputImagePath = process.argv[5]!;
  await createValidationImage(pageNumber, fieldsJsonPath, inputImagePath, outputImagePath);
}
