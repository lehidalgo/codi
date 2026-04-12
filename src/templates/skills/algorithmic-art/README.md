# codi-algorithmic-art

Creates generative algorithmic art using p5.js with seeded randomness. The workflow has two phases: first write an algorithmic philosophy (a design manifesto), then express it as a p5.js sketch with interactive seed and parameter controls.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Web browser | any modern browser | view and interact with generated sketches |
| p5.js | loaded via CDN | no local install needed |

No build tools, no npm install, no Python. Output is a self-contained `.html` file that runs in any browser.

## Output Files

| File | Purpose |
|------|---------|
| `<name>-philosophy.md` | Algorithmic philosophy — the design manifesto |
| `<name>.html` | Interactive p5.js viewer with seed input |
| `<name>.js` | The generative algorithm (90% algorithmic, 10% parameters) |

## Concepts

The skill implements two sequential steps:

1. **Philosophy creation** — writes a movement manifesto describing the computational aesthetic: noise fields, particle dynamics, emergent behavior, mathematical relationships, temporal evolution.

2. **Code expression** — translates the philosophy into a p5.js sketch. The algorithm drives 90% of the visual output; the remaining 10% is adjustable through seed and parameter inputs in the viewer.

## Viewer Controls

Generated `.html` files include:

| Control | Purpose |
|---------|---------|
| Seed input | Deterministic variation — same seed always produces same output |
| Parameter sliders | Adjust density, speed, color intensity, or algorithm-specific variables |
| Export button | Save current frame as PNG |

## p5.js CDN

Sketches load p5.js from the official CDN. An internet connection is required the first time; after that the browser caches the library:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
```
