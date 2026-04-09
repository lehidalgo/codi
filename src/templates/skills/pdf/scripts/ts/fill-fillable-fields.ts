#!/usr/bin/env npx tsx
/**
 * Fill native PDF form fields with values using pdf-lib.
 *
 * Reads field values from JSON, validates against field types, and updates
 * the PDF form fields.
 *
 * Usage: npx tsx fill-fillable-fields.ts <input.pdf> <field-values.json> <output.pdf>
 */

import { readFileSync, writeFileSync } from "node:fs";

interface FieldValue {
  field_id: string;
  page: number;
  value: string;
}

export async function fillPdfFields(
  inputPdfPath: string,
  fieldsJsonPath: string,
  outputPdfPath: string,
): Promise<void> {
  const pdfLib = await import("pdf-lib");
  const { PDFDocument, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFTextField } = pdfLib;

  const fieldValues: FieldValue[] = JSON.parse(readFileSync(fieldsJsonPath, "utf-8"));
  const pdfBytes = readFileSync(inputPdfPath);
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  let hasError = false;

  // Validate all fields first
  for (const fv of fieldValues) {
    if (!("value" in fv)) continue;

    try {
      const field = form.getField(fv.field_id);

      if (field instanceof PDFCheckBox) {
        const valid = ["Yes", "Off", "true", "false"];
        if (!valid.includes(fv.value)) {
          console.error(
            `ERROR: Invalid value "${fv.value}" for checkbox field "${fv.field_id}". Valid values: ${valid.join(", ")}`,
          );
          hasError = true;
        }
      } else if (field instanceof PDFDropdown) {
        const options = field.getOptions();
        if (!options.includes(fv.value)) {
          console.error(
            `ERROR: Invalid value "${fv.value}" for choice field "${fv.field_id}". Valid values: ${JSON.stringify(options)}`,
          );
          hasError = true;
        }
      } else if (field instanceof PDFRadioGroup) {
        const options = field.getOptions();
        if (!options.includes(fv.value)) {
          console.error(
            `ERROR: Invalid value "${fv.value}" for radio group field "${fv.field_id}". Valid values: ${JSON.stringify(options)}`,
          );
          hasError = true;
        }
      }
    } catch {
      console.error(`ERROR: "${fv.field_id}" is not a valid field ID`);
      hasError = true;
    }
  }

  if (hasError) {
    process.exit(1);
  }

  // Apply values
  for (const fv of fieldValues) {
    if (!("value" in fv)) continue;

    const field = form.getField(fv.field_id);

    if (field instanceof PDFTextField) {
      field.setText(fv.value);
    } else if (field instanceof PDFCheckBox) {
      if (fv.value === "Yes" || fv.value === "true") {
        field.check();
      } else {
        field.uncheck();
      }
    } else if (field instanceof PDFDropdown) {
      field.select(fv.value);
    } else if (field instanceof PDFRadioGroup) {
      field.select(fv.value);
    }
  }

  const outputBytes = await doc.save();
  writeFileSync(outputPdfPath, outputBytes);
  console.log(
    `Filled ${fieldValues.filter((f) => "value" in f).length} fields, saved to ${outputPdfPath}`,
  );
}

// CLI entry point
if (process.argv[1]?.endsWith("fill-fillable-fields.ts")) {
  if (process.argv.length !== 5) {
    console.error(
      "Usage: npx tsx fill-fillable-fields.ts <input.pdf> <field-values.json> <output.pdf>",
    );
    process.exit(1);
  }
  await fillPdfFields(process.argv[2]!, process.argv[3]!, process.argv[4]!);
}
