#!/usr/bin/env npx tsx
/**
 * Extract form field information from fillable PDFs.
 *
 * Uses pdf-lib to parse form fields (text, checkbox, radio, dropdown).
 * Outputs JSON with field metadata including type, page, location, and valid values.
 *
 * Usage: npx tsx extract-form-field-info.ts <input.pdf> <output.json>
 */

import { readFileSync, writeFileSync } from "node:fs";

interface FieldInfo {
  field_id: string;
  type: string;
  page?: number;
  rect?: number[];
  checked_value?: string;
  unchecked_value?: string;
  choice_options?: Array<{ value: string; text: string }>;
  radio_options?: Array<{ value: string; rect?: number[] }>;
}

export async function getFieldInfo(pdfPath: string): Promise<FieldInfo[]> {
  const pdfLib = await import("pdf-lib");
  const { PDFDocument, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFTextField } = pdfLib;

  const pdfBytes = readFileSync(pdfPath);
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();
  const pages = doc.getPages();

  const fieldInfoList: FieldInfo[] = [];

  for (const field of fields) {
    const name = field.getName();
    const info: FieldInfo = { field_id: name, type: "unknown" };

    if (field instanceof PDFTextField) {
      info.type = "text";
    } else if (field instanceof PDFCheckBox) {
      info.type = "checkbox";
      info.checked_value = "Yes";
      info.unchecked_value = "Off";
    } else if (field instanceof PDFDropdown) {
      info.type = "choice";
      const options = field.getOptions();
      info.choice_options = options.map((opt: string) => ({
        value: opt,
        text: opt,
      }));
    } else if (field instanceof PDFRadioGroup) {
      info.type = "radio_group";
      const options = field.getOptions();
      info.radio_options = options.map((opt: string) => ({ value: opt }));
    }

    // Find the page and rect for this field's widget
    const widgets = field.acroField.getWidgets();
    if (widgets.length > 0) {
      const widget = widgets[0]!;
      const widgetPage = widget.P();

      // Find page index
      if (widgetPage) {
        for (let i = 0; i < pages.length; i++) {
          if (pages[i]!.ref === widgetPage) {
            info.page = i + 1;
            break;
          }
        }
      }

      // Get rect
      const rect = widget.Rect();
      if (rect) {
        info.rect = [
          rect.asRectangle().x,
          rect.asRectangle().y,
          rect.asRectangle().x + rect.asRectangle().width,
          rect.asRectangle().y + rect.asRectangle().height,
        ];
      }
    }

    fieldInfoList.push(info);
  }

  // Sort by page then position (top-left to bottom-right)
  fieldInfoList.sort((a, b) => {
    const pageA = a.page ?? 0;
    const pageB = b.page ?? 0;
    if (pageA !== pageB) return pageA - pageB;
    const rectA = a.rect ?? [0, 0, 0, 0];
    const rectB = b.rect ?? [0, 0, 0, 0];
    // Sort top-to-bottom (higher y first in PDF coords), then left-to-right
    if (rectA[1] !== rectB[1]) return -(rectA[1]! - rectB[1]!);
    return rectA[0]! - rectB[0]!;
  });

  return fieldInfoList;
}

export async function writeFieldInfo(pdfPath: string, jsonOutputPath: string): Promise<void> {
  const fieldInfo = await getFieldInfo(pdfPath);
  writeFileSync(jsonOutputPath, JSON.stringify(fieldInfo, null, 2), "utf-8");
  console.log(`Wrote ${fieldInfo.length} fields to ${jsonOutputPath}`);
}

// CLI entry point
if (process.argv[1]?.endsWith("extract-form-field-info.ts")) {
  if (process.argv.length !== 4) {
    console.error("Usage: npx tsx extract-form-field-info.ts <input.pdf> <output.json>");
    process.exit(1);
  }
  await writeFieldInfo(process.argv[2]!, process.argv[3]!);
}
