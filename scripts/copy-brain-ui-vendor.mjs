#!/usr/bin/env node
/**
 * ISSUE-061 — copy htmx + alpine into `dist/static/` so the brain-ui can
 * serve them locally instead of pulling from unpkg.com. Removes the CDN
 * supply-chain dependency and allows offline use.
 *
 * Pinned via package.json:
 *   - htmx.org@2.0.4
 *   - alpinejs@3.14.1
 *
 * Runs after tsup, alongside copy-skill-assets.mjs.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const DEST_DIR = "dist/static";
const FILES = [
  { from: "node_modules/htmx.org/dist/htmx.min.js", to: "htmx.min.js" },
  { from: "node_modules/alpinejs/dist/cdn.min.js", to: "alpine.min.js" },
];

mkdirSync(DEST_DIR, { recursive: true });
let copied = 0;
for (const f of FILES) {
  if (!existsSync(f.from)) {
    console.error(`ERROR: ${f.from} not found — did pnpm install run?`);
    process.exit(1);
  }
  const dst = join(DEST_DIR, f.to);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(f.from, dst);
  copied++;
}
console.log(`copy-brain-ui-vendor: copied=${copied} → ${DEST_DIR}`);
