# Astro Starlight Documentation Site — Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Astro Starlight as a root-level devDependency and publish a documentation site at `https://lehidalgo.github.io/codi` that auto-generates an API reference from TypeScript source and serves the existing project guides.

**Architecture:** Option B (root-level single package.json). `astro.config.mjs` lives at the project root and points `srcDir` to `./docs`. Starlight content lives in `docs/src/content/docs/`. TypeDoc reads `src/` directly (no build prerequisite). The existing `docs/project/` directory is untouched — migrated pages land in `docs/src/content/docs/`.

**Tech Stack:** Astro 5, `@astrojs/starlight`, `starlight-typedoc`, `typedoc`, `typedoc-plugin-markdown`, `typedoc-plugin-zod`, GitHub Actions → GitHub Pages.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add devDependencies + docs scripts |
| `astro.config.mjs` | Create | Astro + Starlight + TypeDoc configuration |
| `docs/src/content/docs/index.mdx` | Create | Site home page |
| `docs/src/assets/logo.svg` | Create | Minimal placeholder logo |
| `docs/src/content/docs/guides/getting-started.md` | Create | Migrated from `docs/project/getting-started.md` |
| `docs/src/content/docs/guides/installation.md` | Create | New installation guide |
| `docs/src/content/docs/reference/cli-reference.md` | Create | Migrated from `docs/project/cli-reference.md` |
| `docs/src/content/docs/reference/configuration.md` | Create | Migrated from `docs/project/configuration.md` |
| `.github/workflows/docs.yml` | Create | CI/CD — build and deploy to GitHub Pages |
| `.gitignore` | Modify | Add `docs/dist/` and `.astro/` |

---

## Task 1: Install Astro Starlight and TypeDoc as devDependencies

**Files**: `package.json`
**Est**: 3 min

**Steps**:
- [ ] 1. Run install:
  ```bash
  npm install --save-dev astro @astrojs/starlight starlight-typedoc typedoc typedoc-plugin-markdown typedoc-plugin-zod
  ```

- [ ] 2. Verify packages are in `package.json` devDependencies:
  ```bash
  node -e "const p=require('./package.json'); ['astro','@astrojs/starlight','starlight-typedoc','typedoc','typedoc-plugin-markdown','typedoc-plugin-zod'].forEach(k => { if(!p.devDependencies[k]) throw new Error('missing: '+k); console.log('ok:', k, p.devDependencies[k]); })"
  ```
  Expected: six `ok:` lines, no errors.

- [ ] 3. Verify Astro binary is accessible:
  ```bash
  npx astro --version
  ```
  Expected: prints a version number (e.g. `5.x.x`).

- [ ] 4. Commit:
  ```bash
  git add package.json package-lock.json
  git commit -m "chore(docs): add astro starlight and typedoc devdependencies"
  ```

---

## Task 2: Add docs scripts to package.json

**Files**: `package.json`
**Est**: 2 min

**Steps**:
- [ ] 1. Open `package.json` and add the following four entries to the `"scripts"` block:
  ```json
  "docs:dev":   "astro dev",
  "docs:build": "astro build",
  "docs:check": "astro check",
  "docs:preview": "astro preview"
  ```
  The final scripts section should contain these alongside the existing entries. Do **not** remove `docs:generate` or `docs:validate`.

- [ ] 2. Verify the scripts resolve without error:
  ```bash
  node -e "const p=require('./package.json'); ['docs:dev','docs:build','docs:check','docs:preview'].forEach(k=>{ if(!p.scripts[k]) throw new Error('missing script: '+k); console.log('ok:',k); })"
  ```
  Expected: four `ok:` lines.

- [ ] 3. Commit:
  ```bash
  git add package.json
  git commit -m "chore(docs): add astro docs scripts to package.json"
  ```

---

## Task 3: Create astro.config.mjs

**Files**: `astro.config.mjs`
**Est**: 5 min

**Steps**:
- [ ] 1. Create `astro.config.mjs` at the project root with the following content:
  ```js
  // astro.config.mjs
  import { defineConfig } from 'astro/config';
  import starlight from '@astrojs/starlight';
  import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

  export default defineConfig({
    site: 'https://lehidalgo.github.io',
    base: '/codi',
    srcDir: './docs',
    outDir: './docs/dist',
    integrations: [
      starlight({
        title: 'Codi',
        description: 'Unified configuration platform for AI coding agents',
        social: [
          { icon: 'github', label: 'GitHub', href: 'https://github.com/lehidalgo/codi' },
        ],
        sidebar: [
          {
            label: 'Guides',
            autogenerate: { directory: 'guides' },
          },
          {
            label: 'Reference',
            autogenerate: { directory: 'reference' },
          },
          typeDocSidebarGroup,
        ],
        plugins: [
          starlightTypeDoc({
            entryPoints: [
              './src/types/index.ts',
              './src/schemas/index.ts',
              './src/adapters/index.ts',
              './src/core/config/index.ts',
            ],
            tsconfig: './tsconfig.json',
            output: 'api',
            typeDoc: {
              excludePrivate: true,
              excludeInternal: true,
              parametersFormat: 'htmlTable',
              propertyMembersFormat: 'htmlTable',
              useCodeBlocks: true,
              plugin: ['typedoc-plugin-zod'],
            },
          }),
        ],
      }),
    ],
  });
  ```

- [ ] 2. Verify the file parses as valid ESM:
  ```bash
  node --input-type=module <<'EOF'
  import('./astro.config.mjs').then(() => console.log('ok: astro.config.mjs parses')).catch(e => { console.error(e.message); process.exit(1); });
  EOF
  ```
  Expected: `ok: astro.config.mjs parses`

- [ ] 3. Commit:
  ```bash
  git add astro.config.mjs
  git commit -m "chore(docs): add astro.config.mjs with starlight and typedoc integration"
  ```

---

## Task 4: Create docs/ content skeleton

**Files**: `docs/src/content/docs/index.mdx`, `docs/src/assets/logo.svg`, `docs/src/content/config.ts`
**Est**: 5 min

**Steps**:
- [ ] 1. Check for an existing `docs/_site/` directory from a prior site attempt, and confirm it won't conflict:
  ```bash
  ls docs/_site/ 2>/dev/null && echo "WARNING: docs/_site/ exists — review before continuing" || echo "ok: no _site/ conflict"
  ```
  If the warning fires, inspect `docs/_site/` and delete it if it is stale generated output.

- [ ] 2. Create the directory structure:
  ```bash
  mkdir -p docs/src/content/docs/guides
  mkdir -p docs/src/content/docs/reference
  mkdir -p docs/src/assets
  ```

- [ ] 2. Create `docs/src/content/config.ts` (required by Astro content collections):
  ```typescript
  import { defineCollection } from 'astro:content';
  import { docsSchema } from '@astrojs/starlight/schema';

  export const collections = {
    docs: defineCollection({ schema: docsSchema() }),
  };
  ```

- [ ] 3. Create `docs/src/content/docs/index.mdx` (site home page):
  ```mdx
  ---
  title: Codi
  description: Unified configuration platform for AI coding agents
  template: splash
  hero:
    tagline: One config. Every AI agent.
    actions:
      - text: Get started
        link: /codi/guides/getting-started/
        icon: right-arrow
        variant: primary
      - text: View on GitHub
        link: https://github.com/lehidalgo/codi
        icon: external
  ---

  ## What is Codi?

  Codi manages your AI coding agent configuration as code. Define rules, skills, and agents
  once in `.codi/` — Codi generates the native config files for Claude Code, Cursor, Codex,
  Windsurf, and Cline automatically.

  ## Supported Agents

  | Agent | Config file generated |
  |-------|-----------------------|
  | Claude Code | `CLAUDE.md` |
  | Cursor | `.cursorrules` |
  | Codex | `AGENTS.md` |
  | Windsurf | `.windsurfrules` |
  | Cline | `.clinerules` |
  ```

- [ ] 4. Create a minimal placeholder asset `docs/src/assets/logo.svg`:
  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <text y=".9em" font-size="90">🤖</text>
  </svg>
  ```

- [ ] 5. Verify the directory tree is correct:
  ```bash
  find docs/src -type f | sort
  ```
  Expected output includes:
  ```
  docs/src/assets/logo.svg
  docs/src/content/config.ts
  docs/src/content/docs/index.mdx
  ```

- [ ] 6. Commit:
  ```bash
  git add docs/src/
  git commit -m "chore(docs): scaffold astro starlight content structure"
  ```

---

## Task 5: Update .gitignore for Astro build artifacts

**Files**: `.gitignore`
**Est**: 2 min

**Steps**:
- [ ] 1. Read `.gitignore` and append the following lines if not already present:
  ```
  # Astro docs build
  docs/dist/
  docs/src/content/docs/api/
  .astro/
  ```
  `docs/src/content/docs/api/` is auto-generated by starlight-typedoc on every build — it must not be committed.

- [ ] 2. Verify:
  ```bash
  grep -n "docs/dist" .gitignore && grep -n ".astro/" .gitignore
  ```
  Expected: both lines found.

- [ ] 3. Commit:
  ```bash
  git add .gitignore
  git commit -m "chore(docs): gitignore astro build output and typedoc generated api pages"
  ```

---

## Task 6: Run first docs build and verify TypeDoc output

**Files**: none (verification only)
**Est**: 5 min

**Steps**:
- [ ] 1. Run the docs build:
  ```bash
  npm run docs:build 2>&1 | tee /tmp/docs-build.log
  echo "Exit code: $?"
  ```
  Expected: exit code 0. If TypeDoc throws a resolution error for `#src/*` paths, proceed to step 2. If it succeeds, skip to step 4.

- [ ] 2. (Only if `#src/*` resolution fails) Create `tsconfig.typedoc.json` at the project root:
  ```json
  {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "moduleResolution": "Bundler",
      "noUnusedLocals": false,
      "noUnusedParameters": false
    }
  }
  ```
  Then update `astro.config.mjs` — change the `tsconfig` line inside `starlightTypeDoc({...})`:
  ```js
  tsconfig: './tsconfig.typedoc.json',
  ```
  Re-run step 1.

- [ ] 3. (Only if Zod plugin fails) If `typedoc-plugin-zod` throws an error, remove `'typedoc-plugin-zod'` from the `plugin` array in `astro.config.mjs` and re-run. Note the issue for a follow-up.

- [ ] 4. Verify the TypeDoc API output exists:
  ```bash
  ls docs/src/content/docs/api/ 2>/dev/null || echo "api/ not generated"
  find docs/src/content/docs/api -name "*.md" | wc -l
  ```
  Expected: at least 10 `.md` files in `api/`.

- [ ] 5. Verify the built site HTML exists:
  ```bash
  ls docs/dist/index.html && echo "home page ok"
  ls docs/dist/api/ 2>/dev/null && echo "api pages ok"
  ```
  Expected: both lines printed.

- [ ] 6. Check the content of one generated schema page:
  ```bash
  find docs/dist -path "*/schemas*" -name "*.html" | head -3
  ```
  Expected: HTML files for schema pages (e.g. `project-manifest-schema/index.html`).

- [ ] 7. Commit if any config changes were made in steps 2-3:
  ```bash
  git add astro.config.mjs tsconfig.typedoc.json 2>/dev/null || true
  git diff --cached --quiet || git commit -m "fix(docs): adjust typedoc tsconfig for module resolution compatibility"
  ```

---

## Task 7: Migrate three key existing docs to Starlight format

**Files**: `docs/src/content/docs/guides/getting-started.md`, `docs/src/content/docs/reference/cli-reference.md`, `docs/src/content/docs/reference/configuration.md`
**Est**: 10 min

**Steps**:
- [ ] 1. Create `docs/src/content/docs/guides/getting-started.md` by copying content from `docs/project/getting-started.md` and prepending the Starlight frontmatter:
  ```markdown
  ---
  title: Getting Started
  description: Install Codi and generate your first agent configuration in under 5 minutes
  sidebar:
    order: 1
  ---
  ```
  Paste the full body of `docs/project/getting-started.md` after the frontmatter. Remove any YAML frontmatter that may already exist at the top of the source file.

- [ ] 2. Create `docs/src/content/docs/reference/cli-reference.md` from `docs/project/cli-reference.md`:
  ```markdown
  ---
  title: CLI Reference
  description: Complete reference for all codi commands, options, and flags
  sidebar:
    order: 1
  ---
  ```
  Paste the full body of `docs/project/cli-reference.md` after the frontmatter.

- [ ] 3. Create `docs/src/content/docs/reference/configuration.md` from `docs/project/configuration.md`:
  ```markdown
  ---
  title: Configuration
  description: Reference for codi.yaml manifest, flags, layers, and MCP server configuration
  sidebar:
    order: 2
  ---
  ```
  Paste the full body of `docs/project/configuration.md` after the frontmatter.

- [ ] 4. Re-run the docs build to verify migrated pages render without errors:
  ```bash
  npm run docs:build 2>&1 | grep -E "(error|warning|Error)" | head -20
  echo "Build exit: $?"
  ```
  Expected: exit 0. Warnings about external links are acceptable. Errors about broken internal links must be fixed by removing or updating the link.

- [ ] 5. Verify pages appear in the built output:
  ```bash
  ls docs/dist/guides/getting-started/ && echo "getting-started ok"
  ls docs/dist/reference/cli-reference/ && echo "cli-reference ok"
  ls docs/dist/reference/configuration/ && echo "configuration ok"
  ```
  Expected: all three `ok` lines.

- [ ] 6. Commit:
  ```bash
  git add docs/src/content/docs/guides/ docs/src/content/docs/reference/
  git commit -m "docs: migrate getting-started, cli-reference, and configuration to starlight"
  ```

---

## Task 8: Add GitHub Actions workflow for GitHub Pages deployment

**Files**: `.github/workflows/docs.yml`
**Est**: 5 min

**Steps**:
- [ ] 1. Verify the `.github/workflows/` directory exists:
  ```bash
  ls .github/workflows/ | head -5
  ```

- [ ] 2. Create `.github/workflows/docs.yml`:
  ```yaml
  name: Deploy Docs

  on:
    push:
      branches:
        - main
      paths:
        - 'src/**'
        - 'docs/src/**'
        - 'astro.config.mjs'
        - 'CHANGELOG.md'

  permissions:
    contents: read
    pages: write
    id-token: write

  concurrency:
    group: pages
    cancel-in-progress: false

  jobs:
    build:
      name: Build docs
      runs-on: ubuntu-latest
      steps:
        - name: Checkout
          uses: actions/checkout@v4

        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version: '22'
            cache: 'npm'

        - name: Install dependencies
          run: npm ci

        - name: Build TypeScript (emit .d.ts for TypeDoc)
          run: npm run build

        - name: Build docs
          run: npm run docs:build

        - name: Upload Pages artifact
          uses: actions/upload-pages-artifact@v3
          with:
            path: docs/dist

    deploy:
      name: Deploy to GitHub Pages
      needs: build
      runs-on: ubuntu-latest
      environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
      steps:
        - name: Deploy
          id: deployment
          uses: actions/deploy-pages@v4
  ```

- [ ] 3. Verify the YAML is valid:
  ```bash
  node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  yaml.parse(fs.readFileSync('.github/workflows/docs.yml', 'utf8'));
  console.log('ok: docs.yml is valid YAML');
  " 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/docs.yml')); print('ok: docs.yml is valid YAML')"
  ```
  Expected: `ok: docs.yml is valid YAML`

- [ ] 4. Commit:
  ```bash
  git add .github/workflows/docs.yml
  git commit -m "ci(docs): add github actions workflow for github pages deployment"
  ```

---

## Task 9: Enable GitHub Pages in repository settings (manual step)

**Files**: none (GitHub web UI)
**Est**: 2 min

This task cannot be automated — it requires the GitHub web UI.

**Steps**:
- [ ] 1. Go to `https://github.com/lehidalgo/codi/settings/pages`
- [ ] 2. Under **Source**, select **GitHub Actions**
- [ ] 3. Save. The next push to `main` that touches `src/**` or `docs/src/**` will trigger the workflow and publish to `https://lehidalgo.github.io/codi`.

---

## Verification

After all tasks complete, run the full local build and confirm the output:

```bash
npm run docs:build

# Check output structure
echo "=== Home page ===" && ls docs/dist/index.html
echo "=== API pages ===" && find docs/dist/api -name "index.html" | head -10
echo "=== Guide pages ===" && find docs/dist/guides -name "index.html"
echo "=== Reference pages ===" && find docs/dist/reference -name "index.html"
echo "=== Search index ===" && ls docs/dist/pagefind/

# Preview locally
npm run docs:preview
# Open http://localhost:4321/codi in the browser
```

Expected output:
- `docs/dist/index.html` — home page
- `docs/dist/api/` — TypeDoc-generated API reference (types, schemas, adapters, config)
- `docs/dist/guides/getting-started/index.html`
- `docs/dist/reference/cli-reference/index.html`
- `docs/dist/reference/configuration/index.html`
- `docs/dist/pagefind/` — Pagefind search index

---

## What TypeDoc Will Generate (Expected Pages)

From the four entry points, TypeDoc will produce pages at `docs/dist/api/`:

| Source | Expected pages |
|--------|---------------|
| `src/types/index.ts` | `NormalizedConfig`, `NormalizedRule`, `NormalizedSkill`, `NormalizedAgent`, `Result`, `FlagDefinition`, `AgentAdapter`, etc. |
| `src/schemas/index.ts` | `ProjectManifestSchema`, `RuleFrontmatterSchema`, `SkillFrontmatterSchema`, `FlagDefinitionSchema`, `McpConfigSchema`, `AgentFrontmatterSchema`, etc. |
| `src/adapters/index.ts` | `claudeCodeAdapter`, `cursorAdapter`, `ALL_ADAPTERS`, `registerAllAdapters` |
| `src/core/config/index.ts` | `resolveConfig`, `validateConfig`, `StateManager`, `ParsedProjectDir`, `DriftReport`, etc. |

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| `#src/*` path aliases not resolved by TypeDoc | Create `tsconfig.typedoc.json` per Task 6 step 2 |
| `typedoc-plugin-zod` incompatible with installed Zod v4 | Remove from plugin list; Zod schemas still render but without field descriptions |
| Astro `content/config.ts` import errors | Ensure `@astrojs/starlight/schema` is importable after install |
| `typeDocSidebarGroup` not exported by installed version | Check `node_modules/starlight-typedoc/dist/index.d.ts` for actual export name |
| GitHub Pages 404 on `base: '/codi'` | Verify repo name matches `base` path exactly |
