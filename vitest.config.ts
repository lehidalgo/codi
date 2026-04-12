import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "#src/": resolve(__dirname, "src") + "/",
      "#tests/": resolve(__dirname, "tests") + "/",
    },
  },
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts", "src/templates/skills/**/tests/**/*.test.{ts,js}"],
    exclude: ["projs/**", "node_modules/**"],
    environmentMatchGlobs: [["src/templates/skills/**/tests/**/*.test.{ts,js}", "jsdom"]],
    testTimeout: 10_000,
    server: {
      deps: {
        external: [/astro/, /@astrojs/, /starlight/, /typedoc/, /vitepress/],
      },
    },
    fileParallelism: true,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/templates/skills/**/generators/lib/*.js"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts", // barrel re-exports
        "src/**/types.ts", // type-only files (no runtime code)
        "src/types/**", // type-only directory
        "src/cli.ts", // pure Commander wiring
        "src/cli/watch.ts", // long-running file watcher process
        "src/cli/contribute.ts", // requires gh CLI + interactive prompts

        "src/core/preset/preset-zip.ts", // requires zip/unzip binary
        "src/core/preset/preset-source.ts", // type-only file
        "src/templates/skills/**/scripts/**", // standalone skill runtime scripts with external deps
      ],
      thresholds: {
        statements: 75,
        branches: 66,
        functions: 79,
        lines: 76,
        "src/adapters/**": {
          statements: 93,
          branches: 90,
          functions: 100,
        },
        "src/core/config/**": {
          statements: 76,
          branches: 64,
          functions: 94,
        },
        "src/core/flags/**": {
          statements: 90,
          branches: 85,
          functions: 100,
        },
        "src/core/verify/**": {
          statements: 95,
          branches: 94,
          functions: 93,
        },
        "src/schemas/**": {
          statements: 100,
          branches: 100,
          functions: 100,
        },
        "src/utils/**": {
          statements: 95,
          branches: 92,
          functions: 100,
        },
      },
    },
  },
});
