# Aspect Ratio Presets

Pass these width/height values to `validate.mjs --width W --height H`.

| Format | Ratio | Width | Height | Use Case |
|--------|-------|-------|--------|----------|
| Instagram Post | 4:5 | 1080 | 1350 | Feed post (recommended) |
| Instagram Square | 1:1 | 1080 | 1080 | Legacy feed post |
| Instagram Story | 9:16 | 1080 | 1920 | Story / Reel cover |
| LinkedIn Post | 1.91:1 | 1200 | 628 | Feed post |
| LinkedIn Carousel | 4:5 | 1080 | 1350 | Carousel slide (doc post) |
| Slide 16:9 | 16:9 | 1920 | 1080 | Modern presentation |
| Slide 4:3 | 4:3 | 1440 | 1080 | Legacy presentation |
| A4 Portrait | 1:√2 | 794 | 1123 | Document (96dpi) |
| A4 Landscape | √2:1 | 1123 | 794 | Document (96dpi) |
| US Letter Portrait | 17:22 | 816 | 1056 | Document (96dpi) |
| Twitter/X Post | 16:9 | 1200 | 675 | Inline tweet image |
| Facebook Post | 1.91:1 | 1200 | 630 | Feed post |
| YouTube Thumbnail | 16:9 | 1280 | 720 | Video thumbnail |
| Pinterest Pin | 2:3 | 1000 | 1500 | Standard pin |
| TikTok Cover | 9:16 | 1080 | 1920 | Video cover |

## Notes

- A4 at 96dpi matches the default browser print DPI — use these dimensions
  for any HTML intended to be exported to PDF at A4.
- Instagram's effective upload cap is 1080px wide. Going higher wastes
  bandwidth and triggers Instagram's own downscaler.
- For print-quality PDF, render at 2x (e.g. 2160×2700 for Instagram 4:5) and
  downscale during export — but still validate at the 1x dimensions because
  px are px regardless of device pixel ratio.
