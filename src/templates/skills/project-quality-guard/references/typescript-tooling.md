# TypeScript/Frontend Tooling Reference

## TypeScript — Strict Config

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

**`strict: true` enables:**
- `strictNullChecks` — null/undefined are distinct types
- `noImplicitAny` — no implicit any type
- `strictFunctionTypes` — contravariant function params
- `strictPropertyInitialization` — class props must be initialized

---

## ESLint — Linting (Flat Config)

ESLint 9+ uses flat config (`eslint.config.js`), NOT `.eslintrc` (legacy).

### eslint.config.js

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

### Commands

```bash
npm run lint           # eslint src/
npx eslint --fix src/  # Auto-fix what's possible
```

**Tips:**
- `argsIgnorePattern: "^_"` allows `_event` without unused warning
- ESLint does NOT format — that's Prettier's job. Don't mix format rules in ESLint.

---

## Prettier — Code Formatting

### .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf",
  "tabWidth": 2
}
```

### .prettierignore

```
dist/
node_modules/
package-lock.json
*.min.js
```

### package.json Scripts

```json
{
  "scripts": {
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css}\""
  }
}
```

**Tips:**
- `endOfLine: "lf"` reinforces LF (complements .gitattributes)
- Prettier and ESLint must not conflict — Prettier formats, ESLint lints
- VS Code: install Prettier extension, set as default formatter, enable format on save

---

## Vitest — Testing

Native to Vite. Same config, same aliases, no duplicate setup.

### vite.config.ts (test section)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

### src/test/setup.ts

```ts
import '@testing-library/jest-dom/vitest';
```

### package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Testing Libraries

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Test Conventions

- Tests next to source: `utils.test.ts` beside `utils.ts`
- Use `userEvent` over `fireEvent` (realistic interactions)
- `globals: true` — use `describe/it/expect` without imports
- Path aliases (`@/`) work because Vitest reuses vite.config.ts

---

## Vite — Build Tool

### vite.config.ts (essentials)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',  // Avoid CORS in dev
    },
  },
});
```

---

## Node Version Pinning

### .nvmrc
```
22
```

### package.json
```json
{
  "engines": {
    "node": ">=22"
  }
}
```

Always pin to LTS. Node 22 has support until April 2027.
