import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
    "brain-ui-server": "src/runtime/brain-ui/cli-server.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: "node scripts/copy-skill-assets.mjs && node scripts/copy-brain-ui-vendor.mjs",
});
