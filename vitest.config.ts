import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["projs/**", "node_modules/**"],
    testTimeout: 10_000,
    fileParallelism: true,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts", // barrel re-exports
        "src/**/types.ts", // type-only files (no runtime code)
        "src/types/**", // type-only directory
        "src/cli.ts", // pure Commander wiring
        "src/cli/watch.ts", // long-running file watcher process
        "src/cli/contribute.ts", // requires gh CLI + interactive prompts
        "src/cli/marketplace.ts", // requires network + interactive prompts
        "src/core/preset/preset-zip.ts", // requires zip/unzip binary
        "src/core/preset/preset-source.ts", // type-only file
      ],
      thresholds: {
        statements: 70,
        branches: 63,
        functions: 73,
        lines: 70,
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
