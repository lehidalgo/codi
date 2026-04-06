# Brand Identity — Implementation Reference

## Color Palette Scaffold

Replace the placeholder values with your brand's actual colors. All colors must also be defined in `scripts/brand_tokens.json`.

| Token | Placeholder Hex | Usage |
|-------|----------------|-------|
| `primary` | `#000000` | Main accent color — replace with brand primary |
| `background` | `#ffffff` | Default light background |
| `background_dark` | `#000000` | Dark background variant |
| `text_primary` | `#1a1a2e` | Primary text on light surfaces |
| `text_secondary` | `#4a4a68` | Secondary/muted text |

### CSS Variables Template (web outputs)

```css
:root {
  --brand-primary:    #000000;   /* replace */
  --brand-bg:         #ffffff;   /* replace */
  --brand-bg-dark:    #000000;   /* replace */
  --brand-text:       #1a1a2e;   /* replace */
  --brand-text-muted: #4a4a68;   /* replace */
  --brand-heading-font: 'Arial', sans-serif;    /* replace */
  --brand-body-font:    system-ui, sans-serif;  /* replace */
}
```

---

## Typography Scaffold

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| **Headlines** | Replace with brand font | 600-700 | Arial, sans-serif |
| **Body** | Replace with brand font | 400-500 | system-ui, sans-serif |
| **Monospace** | Replace with mono font | 400 | 'Courier New', monospace |

---

## Logo

Place logo files in `assets/`. Provide SVG for both light and dark backgrounds:
- `assets/logo-dark.svg` — logo for use on light backgrounds
- `assets/logo-light.svg` — logo for use on dark backgrounds

---

## Tone of Voice

Describe the brand personality, writing patterns, and communication style.

### Phrases to Use

- Add characteristic brand phrases here (update `brand_tokens.json` → `voice.phrases_use`)

### Phrases to Avoid

- Add phrases that don't match the brand voice (update `brand_tokens.json` → `voice.phrases_avoid`)

---

## Adapter Patterns

### TypeScript adapter (`scripts/ts/brand_tokens.ts`)

Reads `../brand_tokens.json` and exports typed constants:

```typescript
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(
  readFileSync(resolve(__dirname, "../brand_tokens.json"), "utf8")
);

export const COLORS = tokens.colors as Record<string, string>;
export const FONTS  = tokens.fonts  as Record<string, string>;
export const LAYOUT = tokens.layout as Record<string, string>;
export const VOICE  = tokens.voice  as { phrases_use: string[]; phrases_avoid: string[] };
```

### Python adapter (`scripts/python/brand_tokens.py`)

```python
import json
from pathlib import Path

_data = json.loads((Path(__file__).parent.parent / "brand_tokens.json").read_text())

COLORS = _data["colors"]
FONTS  = _data["fonts"]
LAYOUT = _data["layout"]
VOICE  = _data["voice"]
```

---

## Validation Checklist

Before shipping a brand skill, verify:

- [ ] `brand_tokens.json` has all required color, font, layout, and voice keys
- [ ] TypeScript generator produces a valid PPTX/DOCX from `content.json`
- [ ] Python fallback produces the same output when `npx` is unavailable
- [ ] Validator scripts reject outputs missing required brand elements
- [ ] All scripts read from `brand_tokens.json` — no hardcoded hex values
