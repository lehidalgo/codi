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
 * Mirrors `scripts/copy-skill-assets.mjs`. Wire into `tsup.config.ts`
 * `onSuccess` next to it.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "src/core/hooks/registry/yaml";
const DEST = "dist/core/hooks/registry/yaml";

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
