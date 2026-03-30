#!/usr/bin/env npx tsx
/**
 * Validate bounding boxes for PDF form fields.
 *
 * Checks for intersections between label and entry bounding boxes on the same page,
 * and validates entry box height against font size.
 *
 * Usage: npx tsx check-bounding-boxes.ts <fields.json>
 */

import { readFileSync } from "node:fs";

interface EntryText {
  text?: string;
  font_size?: number;
}

interface FormField {
  description: string;
  page_number: number;
  label_bounding_box: number[];
  entry_bounding_box: number[];
  entry_text?: EntryText;
}

interface FieldsData {
  form_fields: FormField[];
}

interface RectAndField {
  rect: number[];
  rectType: "label" | "entry";
  field: FormField;
}

function rectsIntersect(r1: number[], r2: number[]): boolean {
  const disjointHorizontal = r1[0]! >= r2[2]! || r1[2]! <= r2[0]!;
  const disjointVertical = r1[1]! >= r2[3]! || r1[3]! <= r2[1]!;
  return !(disjointHorizontal || disjointVertical);
}

export function getBoundingBoxMessages(fieldsData: FieldsData): string[] {
  const messages: string[] = [];
  messages.push(`Read ${fieldsData.form_fields.length} fields`);

  const rectsAndFields: RectAndField[] = [];
  for (const f of fieldsData.form_fields) {
    rectsAndFields.push({
      rect: f.label_bounding_box,
      rectType: "label",
      field: f,
    });
    rectsAndFields.push({
      rect: f.entry_bounding_box,
      rectType: "entry",
      field: f,
    });
  }

  let hasError = false;
  for (let i = 0; i < rectsAndFields.length; i++) {
    const ri = rectsAndFields[i]!;
    for (let j = i + 1; j < rectsAndFields.length; j++) {
      const rj = rectsAndFields[j]!;
      if (
        ri.field.page_number === rj.field.page_number &&
        rectsIntersect(ri.rect, rj.rect)
      ) {
        hasError = true;
        if (ri.field === rj.field) {
          messages.push(
            `FAILURE: intersection between label and entry bounding boxes for \`${ri.field.description}\` (${JSON.stringify(ri.rect)}, ${JSON.stringify(rj.rect)})`,
          );
        } else {
          messages.push(
            `FAILURE: intersection between ${ri.rectType} bounding box for \`${ri.field.description}\` (${JSON.stringify(ri.rect)}) and ${rj.rectType} bounding box for \`${rj.field.description}\` (${JSON.stringify(rj.rect)})`,
          );
        }
        if (messages.length >= 20) {
          messages.push(
            "Aborting further checks; fix bounding boxes and try again",
          );
          return messages;
        }
      }
    }
    if (ri.rectType === "entry" && ri.field.entry_text) {
      const fontSize = ri.field.entry_text.font_size ?? 14;
      const entryHeight = ri.rect[3]! - ri.rect[1]!;
      if (entryHeight < fontSize) {
        hasError = true;
        messages.push(
          `FAILURE: entry bounding box height (${entryHeight}) for \`${ri.field.description}\` is too short for the text content (font size: ${fontSize}). Increase the box height or decrease the font size.`,
        );
        if (messages.length >= 20) {
          messages.push(
            "Aborting further checks; fix bounding boxes and try again",
          );
          return messages;
        }
      }
    }
  }

  if (!hasError) {
    messages.push("SUCCESS: All bounding boxes are valid");
  }
  return messages;
}

// CLI entry point
if (process.argv[1]?.endsWith("check-bounding-boxes.ts")) {
  if (process.argv.length !== 3) {
    console.error("Usage: npx tsx check-bounding-boxes.ts <fields.json>");
    process.exit(1);
  }

  const fieldsData: FieldsData = JSON.parse(
    readFileSync(process.argv[2]!, "utf-8"),
  );
  const messages = getBoundingBoxMessages(fieldsData);
  for (const msg of messages) {
    console.log(msg);
  }
}
