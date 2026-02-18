# Task: Figma Sidecar Plugin v2 — Full Designer Toolkit for Zara

## Current State
7 basic commands: ping, create-rect, create-text, create-frame, import-svg, get-selection, export-image, clear.
No: gradients on shapes, rounded corners, effects, groups, components, styles, auto-layout, images, font variants, node manipulation, page management, reading the canvas.

## Goal
Make Zara a **full Figma designer** — she should be able to create production-quality designs, use templates, manipulate existing work, and export assets. The sidecar should expose everything a human designer can do.

---

## Phase 1: Core Design Primitives (must-have)

### 1.1 Shape Creation — Enhanced
```
create-ellipse    { x, y, width, height, fill, stroke, name }
create-polygon    { x, y, sides, radius, fill, name }
create-star       { x, y, points, innerRadius, outerRadius, fill, name }
create-line       { x1, y1, x2, y2, stroke, strokeWeight, name }
create-vector     { x, y, vectorPaths, fill, name }  // arbitrary paths
```

### 1.2 Advanced Fills & Strokes
Upgrade ALL shape/frame creation to support:
```json
{
  "fills": [
    { "type": "SOLID", "color": "#2563EB", "opacity": 0.8 },
    { "type": "GRADIENT_LINEAR", "stops": [
      { "position": 0, "color": "#0A192F" },
      { "position": 0.5, "color": "#2563EB" },
      { "position": 1, "color": "#06B6D4" }
    ], "angle": 135 },
    { "type": "GRADIENT_RADIAL", "stops": [...] },
    { "type": "IMAGE", "imageHash": "..." }
  ],
  "strokes": [{ "type": "SOLID", "color": "#fff" }],
  "strokeWeight": 2,
  "strokeAlign": "INSIDE",
  "dashPattern": [10, 5],
  "cornerRadius": 12,
  "topLeftRadius": 12,  // individual corners
  "opacity": 0.9
}
```

### 1.3 Text — Full Typography Control
```
create-text  {
  text, x, y,
  fontFamily: "Inter",          // any loaded font
  fontStyle: "Bold",            // Regular, Medium, SemiBold, Bold, Black, Italic...
  fontSize: 48,
  lineHeight: { value: 56, unit: "PIXELS" },
  letterSpacing: { value: -2, unit: "PERCENT" },
  textAlignHorizontal: "CENTER",
  textAlignVertical: "CENTER",
  textDecoration: "UNDERLINE",
  textCase: "UPPER",
  fill: "#FFFFFF",
  // Mixed styles within text:
  ranges: [
    { start: 0, end: 7, fontStyle: "Bold", fill: "#2563EB" },
    { start: 7, end: 15, fontStyle: "Regular", fill: "#94A3B8" }
  ]
}
list-fonts  // return available fonts
load-font   { family, style }  // preload before use
```

### 1.4 Effects (Shadows, Blur, etc.)
Apply to any node:
```
set-effects  { nodeId, effects: [
  { type: "DROP_SHADOW", color: "#000000", offset: {x:0,y:4}, radius: 16, spread: 0, opacity: 0.25 },
  { type: "INNER_SHADOW", ... },
  { type: "LAYER_BLUR", radius: 8 },
  { type: "BACKGROUND_BLUR", radius: 20 }
]}
```

### 1.5 Node Manipulation
```
move-node       { nodeId, x, y }
resize-node     { nodeId, width, height }
rotate-node     { nodeId, rotation }
rename-node     { nodeId, name }
delete-node     { nodeId }
duplicate-node  { nodeId, offsetX?, offsetY? }
set-opacity     { nodeId, opacity }
set-visible     { nodeId, visible }
set-locked      { nodeId, locked }
set-fills       { nodeId, fills }
set-strokes     { nodeId, strokes }
set-corner-radius { nodeId, radius }  // or per-corner
reorder-node    { nodeId, direction: "front"|"back"|"forward"|"backward" }
flatten-node    { nodeId }  // flatten to vector
```

---

## Phase 2: Layout & Structure

### 2.1 Groups & Frames
```
group-nodes     { nodeIds: [...], name }
ungroup-node    { nodeId }
create-frame    // already exists, enhance with:
  - auto-layout support
  - clip content
  - constraints
  - padding

frame-from-selection  { name }  // frame around selected nodes
```

### 2.2 Auto Layout
```
set-auto-layout  { nodeId, 
  mode: "HORIZONTAL"|"VERTICAL",
  spacing: 16,
  paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 24,
  primaryAxisAlignItems: "CENTER",
  counterAxisAlignItems: "CENTER",
  primaryAxisSizingMode: "AUTO"|"FIXED",
  counterAxisSizingMode: "AUTO"|"FIXED",
  itemSpacing: 12
}
remove-auto-layout  { nodeId }
```

### 2.3 Constraints
```
set-constraints  { nodeId,
  horizontal: "LEFT"|"RIGHT"|"CENTER"|"STRETCH"|"SCALE",
  vertical: "TOP"|"BOTTOM"|"CENTER"|"STRETCH"|"SCALE"
}
```

---

## Phase 3: Components & Templates

### 3.1 Components
```
create-component        { nodeId }  // convert node to component
create-instance         { componentId, x, y }  // place instance
detach-instance         { nodeId }
list-components         // all local components
list-component-sets     // variant sets
set-variant-property    { nodeId, property, value }

// Component properties (text, boolean, instance swap)
set-component-property  { instanceId, property, value }
get-component-properties { instanceId }
```

### 3.2 Styles
```
create-style    { name, type: "PAINT"|"TEXT"|"EFFECT"|"GRID", value }
list-styles     // all local styles by type
apply-style     { nodeId, styleId, type }
get-style       { styleId }
```

### 3.3 Template Library
Build a **server-side template system** (on the sidecar server, not in Figma):
```
GET  /templates                    // list available templates
GET  /templates/:id                // get template details
POST /templates/:id/instantiate    // create from template in Figma

Templates stored as JSON blueprints:
{
  "id": "sales-deck-slide",
  "name": "Sales Deck Slide",
  "category": "presentations",
  "description": "Dark mode slide with title, subtitle, and content area",
  "nodes": [
    { "type": "frame", "width": 1920, "height": 1080, "fill": "#0A192F", "children": [
      { "type": "text", "text": "{{title}}", "x": 120, "y": 80, ... },
      { "type": "text", "text": "{{subtitle}}", "x": 120, "y": 150, ... },
      { "type": "frame", "name": "content-area", "x": 120, "y": 240, ... }
    ]}
  ],
  "variables": {
    "title": { "default": "Slide Title", "type": "string" },
    "subtitle": { "default": "Supporting text", "type": "string" }
  }
}
```

**Pre-built templates Zara needs:**
- Sales deck slide (title, body, CTA)
- Social media post (X: 1200x675, LinkedIn: 1200x627)
- Blog header image (1200x630)
- Product screenshot frame (with device mockup)
- Comparison table layout
- Pricing card (single tier)
- Feature highlight card
- Team member card
- Logo lockup variations
- Landing page section (hero, features, pricing, CTA)
- Email header banner
- Presentation cover slide
- Icon grid layout

### 3.4 Figma Variables (Design Tokens)
```
create-variable-collection  { name }
create-variable            { collectionId, name, type, value }
list-variables             // all variable collections
set-variable-value         { variableId, modeId, value }
bind-variable              { nodeId, property, variableId }
```

Use for: brand colors, spacing scale, typography scale — so Zara can update the entire file by changing one variable.

---

## Phase 4: Reading & Understanding the Canvas

### 4.1 Scene Inspection
```
get-page-nodes     { depth: 2 }  // tree of all nodes (configurable depth)
get-node           { nodeId }     // full properties of one node
get-children       { nodeId }     // children of a frame/group
find-by-name       { name, type? }  // search nodes by name
find-by-type       { type }       // all nodes of a type
get-page-list      // all pages in file
set-current-page   { pageId }
create-page        { name }
```

### 4.2 Viewport & Navigation
```
zoom-to-node       { nodeId }
zoom-to-fit        // fit all
set-viewport       { x, y, zoom }
get-viewport       // current view position
```

### 4.3 Export & Assets
```
export-node        { nodeId, format: "PNG"|"SVG"|"PDF"|"JPG", scale: 2 }
  → returns base64 data (solve the binary transfer issue)
export-page        { format, scale }
get-image-fills    { nodeId }  // list image fills
set-image-fill     { nodeId, imageData }  // upload image as fill (base64)
```

**Binary transfer solution:** Base64 encode in plugin, send as JSON string. Server decodes and saves to file. For large images, chunk the transfer.

---

## Phase 5: Smart Workflows

### 5.1 Batch Operations
```
batch  { commands: [
  { type: "create-frame", ... },
  { type: "create-text", ... },
  { type: "group-nodes", nodeIds: ["$0", "$1"] }  // reference previous results
]}
```
`$0`, `$1` etc. reference the node IDs from previous commands in the batch. This lets Zara build complex layouts in a single round-trip.

### 5.2 Snapshot & Diff
```
snapshot    // capture current page state as JSON tree
diff        { before, after }  // compare two snapshots
undo        { steps: 1 }
redo        { steps: 1 }
```

### 5.3 Smart Alignment
```
align-nodes     { nodeIds, axis: "horizontal"|"vertical", align: "start"|"center"|"end" }
distribute-nodes { nodeIds, axis, spacing? }
smart-arrange   { nodeIds, columns, spacing }  // grid arrangement
```

### 5.4 Boolean Operations
```
boolean-operation  { nodeIds, operation: "UNION"|"SUBTRACT"|"INTERSECT"|"EXCLUDE" }
```

---

## Phase 6: Server Enhancements

### 6.1 Template Engine (server.js)
```
/templates           GET     list templates
/templates/:id       GET     template detail
/templates/:id/apply POST    instantiate (converts to batch commands)
/templates           POST    save current selection as template
```

Templates stored as JSON files in `templates/` directory on the server.

### 6.2 Asset Library (server.js)
```
/assets              GET     list stored assets (SVGs, images)
/assets/:id          GET     get asset
/assets              POST    upload asset
```

Pre-load with: Amtecco logos, brand patterns, icons, stock photos.

### 6.3 Design System Sync
```
/design-system       GET     current tokens (colors, fonts, spacing)
/design-system       PUT     update tokens
/design-system/apply POST    push tokens to Figma variables
```

Zara updates the design system once → all templates and files inherit.

---

## Implementation Priority

**Week 1:** Phase 1 (primitives) + Phase 4.1 (reading canvas) + Phase 5.1 (batch)
- This alone makes Zara 10x more capable

**Week 2:** Phase 2 (layout) + Phase 3.3 (templates) + Phase 5.3 (alignment)
- Templates are the game-changer — one command to create a full slide

**Week 3:** Phase 3.1-3.2 (components/styles) + Phase 4.3 (export) + Phase 6
- Full design system integration

**Ongoing:** Phase 3.4 (variables) + Phase 5.2 (snapshot) as needed

## Files
- `code.js` — plugin commands (the big one, grows from ~100 to ~800 lines)
- `server.js` — template engine, asset library, design system endpoints
- `templates/` — JSON template files
- `assets/` — stored SVGs, images
- `COMMANDS.md` — full command reference for Zara

## Testing
Each new command: test via curl to sidecar, verify in Figma.
Zara should have `COMMANDS.md` in her workspace as the definitive reference.
