import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../../types/result.js";
import type { Result } from "../../types/result.js";
import { createError } from "../output/errors.js";
import { MAX_NAME_LENGTH, NAME_PATTERN_STRICT } from "../../constants.js";

const DEFAULT_CONTENT = `---
name: {{name}}
description: Brand identity for {{name}}
managed_by: user
---

# {{name}} — Brand Identity

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| \`--brand-primary\` | \`#000000\` | Main accent color |
| \`--brand-primary-dark\` | \`#000000\` | Darker variant |
| \`--brand-primary-muted\` | \`#00000015\` | Subtle backgrounds |
| \`--brand-bg\` | \`#ffffff\` | Default background |
| \`--brand-bg-alt\` | \`#000000\` | Alternate/inverted background |
| \`--brand-text\` | \`#1a1a2e\` | Primary text color |
| \`--brand-text-secondary\` | \`#4a4a68\` | Secondary text color |

### CSS Variables

\\\`\\\`\\\`css
:root {
  --brand-primary: #000000;
  --brand-primary-dark: #000000;
  --brand-primary-muted: #00000015;
  --brand-bg: #ffffff;
  --brand-bg-alt: #000000;
  --brand-text: #1a1a2e;
  --brand-text-secondary: #4a4a68;
  --brand-heading-font: 'Arial', sans-serif;
  --brand-body-font: system-ui, sans-serif;
  --brand-mono-font: 'Courier New', monospace;
}
\\\`\\\`\\\`

## Typography

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| **Headlines** | Sans-serif | 600-700 | Arial, sans-serif |
| **Body** | Sans-serif | 400-500 | system-ui, sans-serif |
| **Monospace** | Monospace | 400 | 'Courier New', monospace |

## Logo

Provide inline SVG for both light and dark backgrounds.
Place logo files in the \`assets/\` directory.

## Tone of Voice

Describe the brand personality, writing patterns, and communication style.

### Phrases to Use

- Add characteristic brand phrases here

### Phrases to Avoid

- Add phrases that don't match the brand voice`;

export interface CreateBrandOptions {
  name: string;
  codiDir: string;
}

export async function createBrand(
  options: CreateBrandOptions,
): Promise<Result<string>> {
  const { name, codiDir } = options;

  if (!NAME_PATTERN_STRICT.test(name) || name.length > MAX_NAME_LENGTH) {
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Invalid brand name "${name}". Use lowercase letters, digits, and hyphens only (max ${MAX_NAME_LENGTH} chars).`,
      }),
    ]);
  }

  const brandDir = path.join(codiDir, "brands", name);
  const filePath = path.join(brandDir, "BRAND.md");

  try {
    await fs.mkdir(brandDir, { recursive: true });
  } catch (cause) {
    return err([
      createError("E_PERMISSION_DENIED", { path: brandDir }, cause as Error),
    ]);
  }

  try {
    await fs.access(filePath);
    return err([
      createError("E_CONFIG_INVALID", {
        message: `Brand already exists: ${filePath}`,
      }),
    ]);
  } catch {
    // File does not exist, good to proceed
  }

  const content = DEFAULT_CONTENT.replace(/\{\{name\}\}/g, name);

  try {
    await fs.writeFile(filePath, content + "\n", "utf-8");
  } catch (cause) {
    return err([
      createError("E_PERMISSION_DENIED", { path: filePath }, cause as Error),
    ]);
  }

  // Create supporting directories
  for (const sub of ["assets", "references"]) {
    const subDir = path.join(brandDir, sub);
    await fs.mkdir(subDir, { recursive: true });
    const gitkeep = path.join(subDir, ".gitkeep");
    await fs.writeFile(gitkeep, "", "utf-8").catch(() => {});
  }

  return ok(filePath);
}
