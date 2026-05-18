import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: "Visual layer of the wiki. Add images, text cards, PDFs, and wiki pages to Obsidian canvas files with auto-positioning inside zones. Triggers on: /canvas, canvas new, canvas add image, canvas add text, canvas add pdf, canvas add note, canvas zone, canvas list, canvas from banana, add to canvas, put this on the canvas, open canvas, create canvas."
category: ${SKILL_CATEGORY.PRODUCTIVITY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
allowed-tools: Read Write Edit Glob Grep
version: 1
maintainers: ["@lehidalgo"]
---

# canvas: Visual Reference Layer

The three knowledge capture layers:
- \`/save\` → text synthesis (wiki/questions/, wiki/concepts/)
- \`/autoresearch\` → structured knowledge (wiki/sources/, wiki/concepts/)
- \`/canvas\` → visual references (wiki/canvases/)

A canvas is a JSON file Obsidian renders as an infinite visual board. This skill reads and writes canvas JSON directly. Read \`references/canvas-spec.md\` for the full format reference before making any edits. This spec aligns with the [JSON Canvas open standard](https://jsoncanvas.org/).

---

## Default Canvas

\`wiki/canvases/main.canvas\`

If it does not exist, create it with a title text node + a "General" group node (color 4). Coordinate origin (-400, -300) for the title.

---

## Operations

### open / status (\`/canvas\` with no args)

1. Check if \`wiki/canvases/main.canvas\` exists.
2. If yes: read it, count nodes by type, list all group node labels (zone names). Report node count and zone list.
3. If no: create it with the starter structure above. Report creation.
4. Tell user: "Open \`wiki/canvases/main.canvas\` in Obsidian to view."

### new (\`/canvas new [name]\`)

1. Slugify the name: lowercase, spaces → hyphens, strip special chars.
2. Create \`wiki/canvases/[slug].canvas\` with the starter structure, title updated.
3. Add entry to \`wiki/overview.md\` under a "## Canvases" subsection. Do not modify \`wiki/index.md\` (fixed section schema).
4. Report path.

### add image (\`/canvas add image [path or url]\`)

**Resolve the image**:
- If URL (starts with \`http\`): download with curl to \`_attachments/images/canvas/[filename]\`.
- If local path outside vault: copy into \`_attachments/images/canvas/\`.
- If already vault-relative: use as-is.

**Detect aspect ratio**: use \`python3 -c "from PIL import Image; img=Image.open('[path]'); print(img.width, img.height)"\` or \`identify -format '%w %h' [path]\`. See \`references/canvas-spec.md\` for the aspect ratio → canvas size table.

**Position using auto-layout** (see below). **Append node to canvas JSON and write.** Report filename, zone, position.

### add text (\`/canvas add text [content]\`)

Create a text node with auto-layout position, width 300, height 120, color 4. Write and report.

### add pdf (\`/canvas add pdf [path]\`)

Same flow as add image: copy to \`_attachments/pdfs/canvas/\` if outside vault. Fixed size width 400, height 520. Report page count if determinable.

### add note (\`/canvas add note [wiki-page]\`)

1. Search \`wiki/\` for a file matching the page name (case-insensitive, partial match ok).
2. Use the vault-relative path as the \`file\` field.
   - Use \`"type": "file"\` (NOT \`"type": "link"\`): \`.md\` files use file nodes. \`link\` takes a \`url\` and is for web URLs only.
3. Create a file node: width 300, height 100. Position via auto-layout.

### zone (\`/canvas zone [name] [color]\`)

1. Read canvas JSON.
2. Find max_y across all nodes + 60 padding. Use 280 if no nodes (leaves room above the starter title).
3. Create a group node at \`x: -400, y: max_y, width: 1000, height: 400, color: <user choice or '3'>\`.

Valid colors: \`"1"\` red, \`"2"\` orange, \`"3"\` yellow, \`"4"\` green, \`"5"\` cyan, \`"6"\` purple.

### list (\`/canvas list\`)

1. Glob \`wiki/canvases/*.canvas\`.
2. For each: read JSON, count nodes by type.
3. Report path + counts per canvas.

### from banana (\`/canvas from banana\`)

If a \`banana-claude\` plugin is installed:
1. Check \`wiki/canvases/.recent-images.txt\` first (session log of newly written images).
2. Else use \`find _attachments/images -newer /tmp/ten-min-ago \\( -name "*.png" -o -name "*.jpg" \\)\` (parentheses required for correct precedence).
3. Else show the 5 most recently modified images.
4. Present list and ask: "Found N recent images. Add to canvas? Which zone?"
5. On confirmation: add each via the add image logic.

---

## Auto-Positioning Algorithm

Read \`references/canvas-spec.md\` for the full coordinate system.

Pseudo-code:

\`\`\`python
def next_position(canvas_nodes, target_zone_label, new_w, new_h):
    # Find zone group node
    zone = next((n for n in canvas_nodes
                 if n.get('type') == 'group'
                 and n.get('label') == target_zone_label), None)

    if zone is None:
        # No zone: place below all content
        max_y = max((n['y'] + n.get('height', 0) for n in canvas_nodes), default=-140)
        return -400, max_y + 60

    zx, zy = zone['x'], zone['y']
    zw, zh = zone['width'], zone['height']

    # Nodes inside this zone
    inside = [n for n in canvas_nodes
              if n.get('type') != 'group'
              and zx <= n['x'] < zx + zw
              and zy <= n['y'] < zy + zh]

    if not inside:
        return zx + 20, zy + 20

    rightmost_x = max(n['x'] + n.get('width', 0) for n in inside)
    next_x = rightmost_x + 40

    if next_x + new_w > zx + zw:
        # New row
        max_row_y = max(n['y'] + n.get('height', 0) for n in inside)
        return zx + 20, max_row_y + 20

    # Same row: align to top of all existing nodes in the zone
    current_row_y = min(n['y'] for n in inside)
    return next_x, current_row_y
\`\`\`

---

## ID Generation

Read the canvas, collect all existing IDs. Never reuse one.

Safe ID pattern: \`[type]-[content-slug]-[full-unix-timestamp]\` (10-digit timestamp avoids collisions in batch ops).

Examples: \`img-cover-1744032823\`, \`text-note-1744032845\`, \`zone-branding-1744032901\`. On collision, append \`-2\`, \`-3\`, etc.

---

## Session Log (optional hook)

If \`wiki/canvases/.recent-images.txt\` exists, append any new image path written to \`_attachments/images/\` during this session (one path per line, keep last 20).

---

## Summary

1. Read \`canvas-spec.md\` before editing any canvas JSON.
2. Always read the canvas file before writing. Parse existing nodes to avoid ID collisions and calculate auto-positions.
3. Create \`_attachments/images/canvas/\` for downloaded/copied images.
4. Update \`wiki/overview.md\` (not \`wiki/index.md\`) when creating new canvases.
5. Report position and zone after every add operation.
`;
