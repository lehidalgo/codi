import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['projs/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',          // barrel re-exports
        'src/**/types.ts',           // type-only files (no runtime code)
        'src/types/**',              // type-only directory
        'src/cli.ts',                // pure Commander wiring
        'src/cli/watch.ts',          // long-running file watcher process
        'src/cli/contribute.ts',     // requires gh CLI + interactive prompts
        'src/cli/marketplace.ts',    // requires network + interactive prompts
        'src/core/preset/preset-zip.ts',  // requires zip/unzip binary
        'src/core/preset/preset-source.ts', // type-only file
      ],
    },
  },
});
