# Task: Action Items UX v2

## Problems (David's feedback)
1. **Cards take too much space** — 2-col grid of fat cards with inline thread expansion = tons of scrolling
2. **Filters sometimes don't work** — client-side filtering after paginated API fetch means filtered items might be on other pages
3. **Not professional enough** — needs tighter, denser layout

## Design: Compact Table + Slide-Out Panel

### Layout: Replace card grid with a **dense table/list view**
```
┌──────────────────────────────────────────────────────────────────┐
│ Action Items                               [🔍] [Sort ▾] [+ New]│
│                                                                  │
│ ┌─ Summary Bar ───────────────────────────────────────────────┐  │
│ │ 🔴 4 Awaiting David  🟡 8 Awaiting VP  ✅ 36 Resolved  ⏸ 2 │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [All 48] [🔴 Awaiting David 4] [🟣 Awaiting VP 8] [✅ Done 36] │
│                                                                  │
│ ┌──┬──────────────────────────┬────────┬────────┬─────┬────────┐│
│ │  │ Title                    │ Owner  │ Status │ Sev │ Active ││
│ ├──┼──────────────────────────┼────────┼────────┼─────┼────────┤│
│ │🔴│ CDN Pricing Proposal     │ David  │ ⏳ VP  │ 🔴  │ 2h ago ││
│ │🟡│ Configure Brave Search   │ Sylvia │ ⏳ D   │ 🔴  │ 22m    ││
│ │🟡│ Henrik: 10 partners      │ Elena  │ ⏳ VP  │ 🔴  │ 1h ago ││
│ │  │ ...                      │        │        │     │        ││
│ └──┴──────────────────────────┴────────┴────────┴─────┴────────┘│
│                                          Page 1 of 4  [< 1 2 >] │
└──────────────────────────────────────────────────────────────────┘
```

### Click a row → **Slide-out detail panel** (right side, like org page)
```
┌─────────────────────────────────────────────┐
│ ✕                                           │
│ CDN Pricing Proposal         🔴 RED         │
│ Owner: David · Requester: Elena             │
│ Opened: Feb 17 · Last activity: 2h ago      │
│ Status: [Awaiting VP ▾]                     │
│─────────────────────────────────────────────│
│ THREAD                                      │
│ ┌─────────────────────────────────────┐     │
│ │ Elena (opened):                     │     │
│ │ Competitive pricing research and    │     │
│ │ proposed tier structure...          │     │
│ └─────────────────────────────────────┘     │
│ ┌─────────────────────────────────────┐     │
│ │ David:                              │     │
│ │ Looks good, reviewing numbers...    │     │
│ └─────────────────────────────────────┘     │
│                                             │
│ [Type a reply...                    ] [Send]│
│─────────────────────────────────────────────│
│ [📞 Call VP ▾]  [⏸ Defer]  [✅ Resolve]    │
└─────────────────────────────────────────────┘
```

## Specific Changes

### 1. Replace card grid with compact table rows
- Single line per item (no expansion in-place)
- Severity color as left border OR dot
- Title truncated with ellipsis
- Owner, status badge, severity badge, last activity — all on one line
- Unread indicator (blue dot) for items needing David
- Row highlight on hover
- ~20 items visible without scrolling (vs ~4-6 currently)

### 2. Slide-out detail panel (like org page)
- Opens from right on row click
- Shows full title, metadata, description
- Full thread with chat bubbles
- Reply input at bottom
- Action buttons: Call VP, Defer, Resolve, Change Severity, Reopen
- Close with ✕ or Escape
- URL updates to `/actions/:id` when panel opens

### 3. Fix filtering — server-side
- Move ALL filtering to API query params
- Current issue: API returns paginated (12/page), client filters AFTER — items on page 2+ get missed
- API already supports `?status=awaiting_david` etc. — use it properly
- Search should also be server-side (or fetch all then filter)
- Filter chips update counts from unfiltered totals

### 4. Summary bar as clickable quick-filters
- Click "🔴 4 Awaiting David" → applies that filter
- Active filter highlighted
- Counts always show true totals (not post-filter)

### 5. Bulk actions (nice-to-have)
- Checkbox column for multi-select
- "Resolve selected", "Defer selected" buttons appear when items checked

### 6. Keyboard shortcuts
- `j/k` — move up/down in list
- `Enter` — open detail panel
- `Escape` — close panel
- `r` — reply (focus input)

## Technical Notes
- Reuse org-panel pattern (slide-out with `.open` class)
- Keep WebSocket live-update (update rows in-place, don't re-render if panel is open)
- Server-side: add `?search=` query param to `/api/actions` endpoint
- Increase default page size to 25 (from 12)
- Keep the "Go to Action Item" deep-link from Kanban working (`/actions/:id`)

## Files to Modify
- `server.js`: Add `?search=` param, ensure `?status=` and `?severity=` work on API
- `index.html`: Replace sec-actions HTML + JS (renderActionCards → renderActionTable, new panel)

## Definition of Done
- Table view shows all items compactly (20+ visible without scroll)
- Click row → slide-out panel with thread + actions
- All filters work correctly (server-side)
- Search works
- Deep-links work (/actions/:id)
- WebSocket updates don't break open panel
- Dark mode, responsive
- No regressions on other pages
