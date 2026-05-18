#!/usr/bin/env node
/**
 * CORE-010 — copy `src/core/hooks/registry/yaml/*.yaml` into `dist/`
 * after `tsup` builds.
 *
 * `tsup` only emits compiled `.ts` files; non-TS assets are left
 * behind. Without this script the loader's
 * `new URL("./yaml/<lang>.yaml", import.meta.url)` would resolve to
 * a non-existent path inside the published package, breaking the
 * CLI in production while passing every dev test (where tsx reads
 * from `src/` directly).
 *
 * ## Why DEST is `dist/yaml` and not `dist/core/hooks/registry/yaml`
 *
 * The loader (`src/core/hooks/registry/loader.ts:41-42`) computes
 * `YAML_DIR = join(dirname(import.meta.url), "yaml")`. In src this
 * resolves to `src/core/hooks/registry/yaml/` — correct. In dist,
 * tsup BUNDLES non-entry modules into top-level `dist/chunk-*.js`
 * files, so the loader code runs from `dist/<chunk>.js` and
 * `import.meta.url` no longer preserves the original directory.
 * `dirname` becomes `dist/` and `YAML_DIR` becomes `dist/yaml/`.
 *
 * Putting the YAMLs at `dist/yaml/` matches that runtime resolution.
 * If a future bundle preserves the source directory structure (e.g.,
 * via a multi-entry tsup config that emits `dist/core/hooks/registry/
 * loader.js`), this DEST should be updated to mirror the loader's
 * new location. Resolves ISSUE-006 in the 2026-05-17 functional
 * audit (5 of 7 hook commands crashing with ENOENT, init silently
 * skipping hook installation via a swallowed catch).
 *
 * Mirrors `scripts/copy-skill-assets.mjs`. Wire into `tsup.config.ts`
 * `onSuccess` next to it.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "src/core/hooks/registry/yaml";
const DEST = "dist/yaml";

if (!existsSync(SRC)) {
  console.error(`[copy-hook-yaml] source missing: ${SRC}`);
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".yaml"));
for (const f of files) {
  cpSync(join(SRC, f), join(DEST, f));
}
console.log(`[copy-hook-yaml] copied ${files.length} YAML file(s) → ${DEST}`);
