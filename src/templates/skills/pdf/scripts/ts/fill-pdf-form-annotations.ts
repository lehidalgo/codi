#!/usr/bin/env npx tsx
/**
 * Fill non-fillable PDFs by adding text annotations.
 *
 * Supports coordinate transformation from image space to PDF space.
 * Creates FreeText-like annotations via pdf-lib drawText on pages.
 *
 * Usage: npx tsx fill-pdf-form-annotations.ts <input.pdf> <fields.json> <output.pdf>
 */

import { readFileSync, writeFileSync } from "node:fs";

interface PageInfo {
  page_number: number;
  image_width?: number;
  image_height?: number;
  pdf_width?: number;
  pdf_height?: number;
}

interface EntryText {
  text: string;
  font?: string;
  font_size?: number;
  font_color?: string;
}

interface FormField {
  page_number: number;
  entry_bounding_box: number[];
  entry_text?: EntryText;
}

interface FieldsData {
  pages: PageInfo[];
  form_fields: FormField[];
}

function transformFromImageCoords(
  bbox: number[],
  imageWidth: number,
  imageHeight: number,
  pdfWidth: number,
  pdfHeight: number,
): { x: number; y: number } {
  const xScale = pdfWidth / imageWidth;
  const yScale = pdfHeight / imageHeight;

  const left = bbox[0]! * xScale;
  // PDF origin is bottom-left; image origin is top-left
  const bottom = pdfHeight - bbox[3]! * yScale;

  return { x: left, y: bottom };
}

function transformFromPdfCoords(bbox: number[], _pdfHeight: number): { x: number; y: number } {
  // bbox is already in PDF coordinates [left, bottom, right, top]
  return { x: bbox[0]!, y: bbox[1]! };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

export async function fillPdfForm(
  inputPdfPath: string,
  fieldsJsonPath: string,
  outputPdfPath: string,
): Promise<void> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const fieldsData: FieldsData = JSON.parse(readFileSync(fieldsJsonPath, "utf-8"));
  const pdfBytes = readFileSync(inputPdfPath);
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();

  const font = await doc.embedFont(StandardFonts.Helvetica);

  let annotationCount = 0;

  for (const field of fieldsData.form_fields) {
    if (!field.entry_text?.text) continue;

    const pageNum = field.page_number;
    const page = pages[pageNum - 1];
    if (!page) continue;

    const pageInfo = fieldsData.pages.find((p) => p.page_number === pageNum);
    if (!pageInfo) continue;

    const pdfWidth = page.getWidth();
    const pdfHeight = page.getHeight();

    let coords: { x: number; y: number };
    if (pageInfo.pdf_width) {
      coords = transformFromPdfCoords(field.entry_bounding_box, pdfHeight);
    } else {
      const imageWidth = pageInfo.image_width ?? pdfWidth;
      const imageHeight = pageInfo.image_height ?? pdfHeight;
      coords = transformFromImageCoords(
        field.entry_bounding_box,
        imageWidth,
        imageHeight,
        pdfWidth,
        pdfHeight,
      );
    }

    const fontSize = field.entry_text.font_size ?? 14;
    const colorHex = field.entry_text.font_color ?? "000000";
    const { r, g, b } = hexToRgb(colorHex);

    page.drawText(field.entry_text.text, {
      x: coords.x,
      y: coords.y,
      size: fontSize,
      font,
      color: rgb(r, g, b),
    });

    annotationCount++;
  }

  const outputBytes = await doc.save();
  writeFileSync(outputPdfPath, outputBytes);

  console.log(`Successfully filled PDF form and saved to ${outputPdfPath}`);
  console.log(`Added ${annotationCount} text annotations`);
}

// CLI entry point
if (process.argv[1]?.endsWith("fill-pdf-form-annotations.ts")) {
  if (process.argv.length !== 5) {
    console.error(
      "Usage: npx tsx fill-pdf-form-annotations.ts <input.pdf> <fields.json> <output.pdf>",
    );
    process.exit(1);
  }
  await fillPdfForm(process.argv[2]!, process.argv[3]!, process.argv[4]!);
}
