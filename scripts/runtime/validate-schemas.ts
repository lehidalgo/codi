#!/usr/bin/env tsx
/**
 * Validates that every sample event in schemas/sample-events.json conforms
 * to schemas/manifest-event.schema.json, and that the closed event
 * vocabulary in the schema matches the set of sample events exactly.
 *
 * Exit codes:
 *   0 — all samples valid and vocabulary matches
 *   1 — schema invalid, samples invalid, or vocabulary mismatch
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

interface CanonicalEventVariant {
  title?: string;
  properties?: { event_type?: { const?: string } };
}

interface ManifestEventSchema {
  oneOf?: CanonicalEventVariant[];
}

interface SampleEvent {
  event_id: string;
  event_type: string;
  schema_version: string;
  [k: string]: unknown;
}

const here = dirname(fileURLToPath(import.meta.url));
const schemasDir = resolve(here, "..", "schemas");
const schemaPath = resolve(schemasDir, "manifest-event.schema.json");
const samplesPath = resolve(schemasDir, "sample-events.json");

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function extractCanonicalEventTypes(schema: ManifestEventSchema): string[] {
  if (!schema.oneOf) {
    throw new Error("Schema is missing oneOf at root.");
  }
  const types: string[] = [];
  for (const variant of schema.oneOf) {
    const eventType = variant.properties?.event_type?.const;
    if (typeof eventType !== "string") {
      throw new Error(`Schema variant ${variant.title ?? "unknown"} is missing event_type.const.`);
    }
    types.push(eventType);
  }
  return types;
}

function main(): void {
  const schema = loadJson<ManifestEventSchema>(schemaPath);
  const samples = loadJson<SampleEvent[]>(samplesPath);

  const canonicalTypes = extractCanonicalEventTypes(schema);
  const sampleTypes = samples.map((s) => s.event_type);

  console.log(`Schema declares ${canonicalTypes.length} canonical event types.`);
  console.log(`Samples file contains ${samples.length} events.`);

  const canonicalSet = new Set(canonicalTypes);
  const sampleSet = new Set(sampleTypes);

  const missingFromSamples = canonicalTypes.filter((t) => !sampleSet.has(t));
  const unknownInSamples = sampleTypes.filter((t) => !canonicalSet.has(t));

  if (missingFromSamples.length > 0) {
    console.error(`\nERROR: ${missingFromSamples.length} canonical event types lack samples:`);
    for (const t of missingFromSamples) console.error(`  - ${t}`);
  }
  if (unknownInSamples.length > 0) {
    console.error(`\nERROR: ${unknownInSamples.length} samples reference unknown event types:`);
    for (const t of unknownInSamples) console.error(`  - ${t}`);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false, discriminator: true });
  addFormats.default(ajv);
  const validate = ajv.compile(schema);

  let passed = 0;
  let failed = 0;
  for (const sample of samples) {
    const sampleType = sample.event_type;
    const sampleId = sample.event_id;
    const ok = validate(sample);
    if (ok) {
      passed += 1;
    } else {
      failed += 1;
      console.error(`\nFAIL: ${sampleType} (${sampleId})`);
      for (const err of validate.errors ?? []) {
        console.error(`  ${err.instancePath} ${err.message}`);
      }
    }
  }

  console.log(`\nValidation: ${passed}/${samples.length} samples passed.`);

  const vocabularyOk = missingFromSamples.length === 0 && unknownInSamples.length === 0;
  const samplesOk = failed === 0;

  if (!vocabularyOk || !samplesOk) {
    console.error("\nFAILED.");
    process.exit(1);
  }

  console.log("OK: schema vocabulary and samples are consistent.");
}

main();
