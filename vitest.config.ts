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
      // Reporters:
      //   text          — human-readable table on stdout (also during local dev)
      //   text-summary  — short banner at the bottom of the run
      //   html          — interactive coverage/index.html for local browsing
      //   json-summary  — machine-readable totals for PR-comment scripts
      //   lcov          — Codecov / Coveralls / SonarQube standard format
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts", // barrel re-exports
        "src/**/types.ts", // type-only files (no runtime code)
        "src/types/**", // type-only directory
        // ─── Pure Commander wiring + interactive @clack/prompts UI ───────
        // Logic lives in the matching *-handlers.ts / *-wizard.ts siblings,
        // which ARE covered. Excluded because the .action() callbacks are
        // not unit-testable without a full TTY harness, and the file's
        // remaining content is just option parsing.
        "src/cli.ts", // top-level Commander wiring
        "src/cli/watch.ts", // long-running file watcher process
        "src/cli/contribute.ts", // gh CLI + interactive prompts
        "src/cli/preset.ts", // top-level command — logic in preset-handlers.ts
        "src/cli/add.ts", // top-level command — logic in add-handlers.ts + add-wizard.ts
        "src/cli/hub.ts", // top-level interactive hub — logic in hub-handlers.ts
        "src/cli/skill.ts", // top-level command — logic in skill-evolve-handler.ts
        // ─── Heavy @clack/prompts orchestration ─────────────────────────
        // These files are >70% prompt-driven control flow (multiselect,
        // confirm, text loops with cancel/edit/skip branches). Unit-testing
        // each branch requires a comprehensive prompt-mock harness that does
        // not yet exist in the codebase (tracked as test-debt). The pure
        // helpers within each file are tested separately where they exist.
        "src/cli/wizard-prompts.ts", // wraps @clack/core prompt classes
        "src/cli/wizard-summary.ts", // tooling-defaults interactive screen
        "src/cli/preset-handlers.ts", // preset import/export interactive flow
        "src/cli/hub-handlers.ts", // interactive hub menu actions
        "src/cli/preset-wizard.ts", // interactive preset selection wizard
        // ─── Network / git boundary ─────────────────────────────────────
        // Need msw + git-fixture infrastructure to test meaningfully.
        // Tracked as test-debt; remove from this list when fixtures land.
        "src/cli/contribute-git.ts", // hits real git remotes
        "src/cli/preset-github.ts", // hits GitHub API + git clone
        "src/cli/update-check.ts", // queries npm registry

        "src/core/preset/preset-zip.ts", // requires zip/unzip binary
        "src/core/preset/preset-source.ts", // type-only file
        // Heavy @clack/prompts orchestration — pure helpers
        // (UnresolvableConflictError, makeConflictEntry) are tested in
        // tests/unit/utils/conflict-resolver.test.ts; the interactive
        // resolveConflicts loop needs a prompt-mock harness we don't yet
        // have. Tracked as test-debt; remove from this list once mocks land.
        "src/utils/conflict-resolver.ts",
        "src/templates/skills/**/scripts/**", // standalone skill runtime scripts with external deps
        "src/templates/skills/**/generators/**", // content-factory frontend (browser/worker) JS — not server-side code
        "src/templates/skills/**/static-dir.ts", // skill packaging helper (build-time)
        "src/templates/skills/**/references/**", // illustrative example .ts files inside skill docs
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
