# codi-slack-gif-creator

Creates animated GIFs optimized for Slack — emoji (128x128) and message (480x480) sizes. Provides validation tools, easing functions, and size-optimized output. Scripts are available in both Python and TypeScript.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Python 3.9+ | optional | GIF creation with PIL/Pillow + imageio |
| Pillow | `pip install Pillow imageio` | frame drawing and GIF assembly (Python) |
| imageio | `pip install imageio` | GIF file writing (Python) |
| Node.js 18+ | required (fallback) | TypeScript GIF creation with sharp |
| sharp | `npm install sharp` | PNG frame rendering (TypeScript) |

Detect runtime availability and use whichever is present:

```bash
which python3 > /dev/null 2>&1 && echo "Python available" || echo "Use TypeScript"
```

## Scripts

| Path | Runtime | Purpose |
|------|---------|---------|
| `scripts/python/gif_builder.py` | Python | GIF assembly with Pillow |
| `scripts/python/validate.py` | Python | Check file size against Slack limits |
| `scripts/ts/gif-builder.ts` | TypeScript | GIF assembly with sharp |
| `scripts/ts/frame-composer.ts` | TypeScript | SVG-based frame composition |

## Slack Size Limits

| Use | Dimensions | Max file size |
|-----|------------|---------------|
| Emoji | 128x128 px | 128 KB |
| Message | 480x480 px | 2 MB |

## Quick Start (Python)

```bash
pip install Pillow imageio

python3 - <<'EOF'
from scripts.python.gif_builder import GIFBuilder
from PIL import Image, ImageDraw

builder = GIFBuilder(width=128, height=128, fps=10)
for i in range(12):
    frame = Image.new('RGB', (128, 128), (30, 30, 40))
    builder.add_frame(frame)
builder.save('emoji.gif', num_colors=48, optimize_for_emoji=True)
EOF
```

## Quick Start (TypeScript)

```bash
npm install sharp
npx tsx scripts/ts/gif-builder.ts
```
