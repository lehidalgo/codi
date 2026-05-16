import type {
  AgentAdapter,
  AgentCapabilities,
  AgentPaths,
  GeneratedFile,
  GenerateOptions,
} from "../types/agent.js";
import type { NormalizedConfig } from "../types/config.js";
import { existsAny } from "./fs-helpers.js";
import { join } from "node:path";

/**
 * A spec for an adapter's `detect()` step. Two flavours:
 *
 * - `{ markers: string[] }` — declarative list of paths (files or
 *   directories) joined against `projectRoot`; `detect()` returns true
 *   when *any* of them exists. Covers all six built-in adapters and
 *   replaces six byte-identical local `exists()` loops.
 *
 * - `{ fn: (projectRoot) => Promise<boolean> }` — escape hatch for the
 *   rare case that a future adapter needs a non-trivial detection
 *   (parsing a config file, calling a CLI, etc.).
 */
export type DetectSpec =
  | { markers: ReadonlyArray<string> }
  | { fn: (projectRoot: string) => Promise<boolean> };

/**
 * Declarative description of an adapter. `defineAdapter()` converts a
 * definition into an `AgentAdapter` (the public contract consumed by the
 * registry and `core/generator/generator.ts`) without changing any
 * call-site semantics.
 *
 * Today the `generate` step is still an imperative function, matching
 * the previous adapter shape — this keeps the refactor byte-equal across
 * all six adapters. Future work (CORE-006b) can introduce declarative
 * section/skill/hook plans in this file without touching consumers.
 */
export interface AdapterDefinition {
  id: string;
  name: string;
  paths: AgentPaths;
  capabilities: AgentCapabilities;
  detect: DetectSpec;
  generate: (
    config: NormalizedConfig,
    options: GenerateOptions,
  ) => Promise<GeneratedFile[]>;
}

/**
 * Build an `AgentAdapter` from a declarative {@link AdapterDefinition}.
 *
 * The returned object satisfies the existing `AgentAdapter` contract, so
 * `src/adapters/index.ts` and `src/core/generator/generator.ts` see no
 * shape change. The benefit is twofold:
 *
 *  1. Adapter authors no longer hand-roll `detect()` for the common case
 *     of "exists any of these marker paths" — they list the markers.
 *  2. The shape `AdapterDefinition` gives a stable surface for future
 *     features (declarative section pipelines, layering guards keyed on
 *     the spec, `core/generator` introspection) without forcing another
 *     refactor of every adapter at the call site.
 */
export function defineAdapter(def: AdapterDefinition): AgentAdapter {
  return {
    id: def.id,
    name: def.name,
    paths: def.paths,
    capabilities: def.capabilities,
    detect: (projectRoot: string) => runDetect(def.detect, projectRoot),
    generate: def.generate,
  };
}

function runDetect(spec: DetectSpec, projectRoot: string): Promise<boolean> {
  if ("fn" in spec) return spec.fn(projectRoot);
  return existsAny(spec.markers.map((m) => join(projectRoot, m)));
}
