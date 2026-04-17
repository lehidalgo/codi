# p5.js Implementation Patterns

Reference for the implementation phase. Read when the main flow reaches
Step 3 (p5.js Implementation).

## Seeded Randomness (Art Blocks pattern)

Always use a seed for reproducibility — the same seed must produce the same
output on every run.

```javascript
let seed = 12345; // or hash from user input
randomSeed(seed);
noiseSeed(seed);
```

## Parameter Object

Parameters should emerge from the philosophy, not from a preset menu.
Ask: "What qualities of this system should be tunable?"

```javascript
let params = {
  seed: 12345,
  // Quantities  (how many?)
  // Scales      (how big? how fast?)
  // Probabilities (how likely?)
  // Ratios      (what proportions?)
  // Angles      (what direction?)
  // Thresholds  (when does behavior change?)
};
```

## Canvas Setup

```javascript
function setup() {
  createCanvas(1200, 1200);
  // Initialize the system
}

function draw() {
  // Generative algorithm — static (noLoop) or animated
}
```

## Single-Artifact HTML Skeleton

Everything embedded inline. p5.js from CDN. No external files.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"></script>
  <style>
    /* inline styling */
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="controls">
    <!-- parameter controls -->
  </div>
  <script>
    // parameter objects, classes, setup(), draw(), UI handlers
  </script>
</body>
</html>
```

## Sidebar Structure (from viewer.html)

Four sections, in order:

1. **Seed (FIXED)** — seed display, Prev / Next / Random, Jump-to-seed input
2. **Parameters (VARIABLE)** — one `control-group` div per parameter:
   ```html
   <div class="control-group">
     <label>Parameter Name</label>
     <input type="range" id="param" min="..." max="..." step="..." value="..."
            oninput="updateParam('param', this.value)">
     <span class="value-display" id="param-value">...</span>
   </div>
   ```
3. **Colors (OPTIONAL)** — color pickers only if the art needs them; omit for
   monochrome or fixed-palette pieces
4. **Actions (FIXED)** — Regenerate, Reset, Download PNG

## Algorithm Shape by Philosophy Type

**Organic emergence** — elements that accumulate or grow over time, random
processes constrained by natural rules, feedback loops and interactions.

**Mathematical beauty** — geometric relationships and ratios, trigonometric
functions and harmonics, precise calculations creating unexpected patterns.

**Controlled chaos** — random variation within strict boundaries, bifurcation
and phase transitions, order emerging from disorder.

The algorithm flows from the philosophy, not from a menu of options.

## Craftsmanship Checklist

- **Balance** — complexity without visual noise, order without rigidity
- **Color harmony** — thoughtful palettes, not random RGB values
- **Composition** — visual hierarchy and flow even within randomness
- **Performance** — smooth execution; optimize for real-time if animated
- **Reproducibility** — same seed always produces identical output
