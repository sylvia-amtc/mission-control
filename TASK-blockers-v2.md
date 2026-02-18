# Task: Blockers Page v2 — Interactive Dependency Visualization

## Context
David wants the Blockers page to visually show which blocker blocks which action items/tasks, with multiple view options. Must be interactive, dynamic, and professional.

## Database Changes Required

### New table: `dependencies`
```sql
CREATE TABLE dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_type TEXT NOT NULL,        -- 'task' or 'action'
  blocker_id INTEGER NOT NULL,       -- ID of the blocking item
  blocked_type TEXT NOT NULL,         -- 'task' or 'action'  
  blocked_id INTEGER NOT NULL,       -- ID of the blocked item
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(blocker_type, blocker_id, blocked_type, blocked_id)
);
```

This enables: Task #72 blocks Action #147, Action #105 blocks Task #65, etc.

### New API endpoints
- `GET /api/dependencies` — all dependencies (with joined titles)
- `POST /api/dependencies` — create a dependency link
- `DELETE /api/dependencies/:id` — remove a link
- `GET /api/blockers/graph` — full graph data (nodes + edges) for visualization
- `GET /api/blockers/impact/:type/:id` — cascade: everything blocked by this item (recursive)

## Views (switchable via tabs at top)

### 1. 🕸️ Dependency Graph (default)
Interactive force-directed graph using Canvas 2D (no external libs — keep it lightweight).

- **Nodes** = tasks and action items (circle for tasks, diamond for actions)
- **Edges** = dependency arrows (blocker → blocked)
- **Color coding**: 
  - 🔴 Red node = active blocker (blocking something right now)
  - 🟡 Yellow node = blocked item (waiting on a blocker)
  - 🟢 Green node = resolved/unblocked
  - ⚪ Grey node = no dependencies
- **Node size** = based on impact (how many things it blocks, recursively)
- **Interactions**:
  - Drag nodes to rearrange
  - Hover node → highlight all connected edges + tooltip with details
  - Click node → side panel with full details + list of what it blocks/is blocked by
  - Zoom/pan with mouse wheel + drag
  - Double-click → navigate to that task/action item
- **Cluster by department** — nodes grouped by dept with subtle background regions
- **Physics toggle** — button to freeze/unfreeze the simulation

### 2. 📊 Impact Matrix
Table showing blockers as rows and blocked items as columns. Cells marked where dependencies exist.

```
                    │ Task #56 │ Task #62 │ Action #147 │ Task #71 │
────────────────────┼──────────┼──────────┼─────────────┼──────────┤
Action #105 (SRT CSV) │    ●     │          │      ●      │          │
Action #107 (SEMrush) │          │    ●     │             │    ●     │
Action #137 (Outreach)│    ●     │    ●     │             │          │
```

- Click any cell to see/edit the dependency
- Row headers show blocker severity + owner
- Column headers show blocked item status
- Sort by: most blocking, severity, department
- Highlight entire row on hover

### 3. 🌊 Cascade / Waterfall View
Horizontal tree layout showing the ripple effect of each blocker.

```
🔴 Action #105: SRT Customer CSV ──┬── Task #65: Cross-sell campaign
   (David, awaiting_david)          ├── Action #129: Legacy SRT CSV
                                    └── Task #68: Customer segmentation
                                         └── Task #73: Email campaign

🔴 Action #107: SEMrush/Ahrefs ────┬── Task #62: Keyword research
   (David, awaiting_david)          └── Task #71: SEO content plan
                                         └── Task #75: Blog posts
```

- Expandable/collapsible branches
- Depth indicator (how deep the cascade goes)
- Critical path highlighting (longest chain)
- Click any node to see details
- "Resolve" button on blocker items — shows what gets unblocked

### 4. 📋 List View (improved current)
Compact table like the new Action Items page, but focused:
- Only shows blockers and their blocked items
- Expandable rows: click blocker → see all items it blocks
- Inline "Link dependency" button to connect items
- Quick-resolve with impact preview ("Resolving this unblocks 3 items")

## Shared Features (all views)

### Header / Controls
- View switcher: [🕸️ Graph] [📊 Matrix] [🌊 Cascade] [📋 List]
- Stats bar: "X active blockers · Y items blocked · Z resolved this week"
- Filter: by department, severity, owner
- "Add Dependency" button → modal to link blocker ↔ blocked item

### Side Panel (slide-out, reuse pattern)
When clicking any node/row:
- Full item details (title, description, owner, severity, status)
- **Blocks** section: list of items this blocks (with links)
- **Blocked by** section: list of items blocking this (with links)
- "Add dependency" inline
- Quick actions: resolve, defer, call VP

### Auto-detect Dependencies
Seed initial dependencies by scanning:
- Action items with "blocked" or "waiting for" in descriptions
- Tasks linked to action items via `action_item_id`
- Known relationships (e.g., SRT CSV blocks cross-sell, SEMrush blocks SEO)

Create a seed script that populates the `dependencies` table with obvious relationships.

## Technical Notes
- Canvas 2D for the graph (no D3.js — keep dependencies zero)
- Force simulation: simple spring physics in JS (~100 lines)
- All views share the same data fetch (`/api/blockers/graph`)
- WebSocket: broadcast `dependency_update` events for live updates
- URL routes: `/blockers`, `/blockers?view=graph`, `/blockers?view=matrix`, etc.
- Dark mode, matches MC theme
- Responsive (graph scales, matrix scrolls horizontally)

## Files to Modify
- `server.js` — new table + 5 API endpoints + WebSocket event
- `index.html` — replace sec-blockers with new views + JS
- New: `scripts/seed-dependencies.js` — initial dependency seeding

## Definition of Done
- All 4 views render correctly with real data
- Dependencies can be created and deleted
- Graph is interactive (drag, zoom, hover, click)
- Cascade shows recursive impact
- Seed script populates initial relationships
- Dark mode, responsive, no regressions
