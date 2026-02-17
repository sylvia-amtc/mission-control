# Mission Control Dashboard v2 — Plan
**Author:** Sylvia | **Date:** 2026-02-17 | **Status:** Pending David approval

---

## Problem

Current dashboard (mc.amtc.tv) is a read-only markdown renderer. No interactivity, no timelines, no task management. It shows status but you can't **do** anything from it.

---

## Vision

A professional operations dashboard where David can see **what's happening**, **when things are due**, and **what's stuck** — all in one place, with the ability to act on it.

---

## Architecture

**Frontend:** Single-page app at mc.amtc.tv
**Backend:** Express API reading from structured JSON/markdown + SQLite for task state
**Auth:** Cloudflare Access (existing setup)
**Auto-updates:** WebSocket push from backend, triggered by cron jobs and agent activity

---

## Pages & Features

### 1. Command Center (Home)
- **Live org status** — all 6 departments, health indicators, last activity timestamp
- **Today's agenda** — what's scheduled, what's due, what's overdue
- **Alert bar** — critical blockers, failed cron jobs, agent errors (red/yellow/green)
- **Quick stats** — agents active, tasks completed today, pipeline value, content published

### 2. Kanban Board
- **Columns:** Backlog → In Progress → Review → Done
- **Cards:** Tasks from all departments, color-coded by dept
- **Card details:** Owner (VP/agent), due date, priority, dependencies, blocker flag
- **Drag-and-drop:** Move tasks between columns (writes back to backend)
- **Filters:** By department, priority, owner, status, date range
- **Swimlanes:** Toggle between flat view and department swimlanes

### 3. Timeline / Gantt View
- **Horizontal timeline** — weeks/months view
- **Rows per department** — collapsible to show individual tasks
- **Milestones:** CDN launch, first content published, CRM fully loaded, first MQL, etc.
- **Dependencies:** Visual arrows between linked tasks
- **Today line:** Vertical marker showing current date
- **Zoom:** Day / Week / Month / Quarter

### 4. Department Drill-Down
- **Per-department page** with:
  - VP status + last check-in
  - Active agents + their current task
  - Department KPIs with sparkline trends
  - Task list (filterable)
  - Recent deliverables
  - Blockers specific to this dept

### 5. KPI Dashboard (Enhanced)
- **Sparkline charts** for each KPI over time (not just current value)
- **Red/amber/green thresholds** with automatic alerting
- **Cross-department comparison** view
- **Export to PDF** for weekly reports

### 6. Blockers & Action Items
- **David's action items** pulled from `corporate-setup-todo.md`
- **VP blockers** pulled from `blockers.md`
- **One-click resolve** — mark as done, add notes
- **Aging indicator** — how many days a blocker has been open
- **Escalation timeline** — when it was raised, by whom, current owner

### 7. Pipeline & Revenue
- **Sales pipeline** pulled from Twenty CRM API
- **Funnel visualization** — leads → qualified → opportunity → closed
- **Cross-sell tracker** — SRT customers targeted for CDN
- **Revenue projections** (when data allows)

### 8. Reports & History
- **Auto-generated daily/weekly reports** (already have cron jobs)
- **Report archive** — browse past reports by date
- **Diff view** — what changed since last report

---

## Data Sources

| Source | What | How |
|--------|------|-----|
| `dashboard.md` | Org status, KPIs | Parse markdown (existing) |
| `blockers.md` | Blockers & risks | Parse markdown (existing) |
| `corporate-setup-todo.md` | David's action items | Parse markdown (new) |
| SQLite DB | Tasks, Kanban state, timeline | New — backend manages |
| Twenty CRM API | Pipeline, accounts, contacts | REST API calls |
| Cron job logs | Report status, agent activity | OpenClaw cron API |
| VP workspaces | Deliverables, activity | File system scan |
| Google Drive | Reports archive | Drive API |

---

## Tech Stack

- **Frontend:** Vanilla JS + Tailwind CSS (keep it light, no React overhead)
- **Charts:** Chart.js (sparklines, funnels) + custom timeline/Gantt
- **Kanban:** Custom drag-and-drop (or integrate SortableJS)
- **Backend:** Express.js (existing) + SQLite (better-sqlite3)
- **Real-time:** WebSocket for live updates
- **Auth:** Cloudflare Access (existing)

---

## Build Phases

### Phase 1 — Foundation
- SQLite schema for tasks, milestones, KPI history
- API endpoints: tasks CRUD, KPI snapshots, blocker sync
- Kanban board (basic drag-and-drop)
- Enhanced home page with alerts + today's agenda

### Phase 2 — Timeline & Depth
- Gantt/timeline view with milestones and dependencies
- Department drill-down pages with agent activity
- KPI sparklines (historical tracking starts)
- Action items page (David's todo synced)

### Phase 3 — Integration & Polish
- Twenty CRM pipeline integration
- Revenue/funnel visualization
- Report archive browser
- PDF export for weekly reports
- WebSocket live updates
- Mobile-responsive layout

---

## Effort

Viktor's AntFarm team builds this. **No fixed weekly cadence — ship as fast as possible.** Phases are logical groupings, not time gates. Each feature must work before moving on. Quality over speed, but don't sandbag.

---

## Decision Needed

1. **Approve plan?** — Viktor starts this week.
2. **Priority order?** — Kanban first (recommended) or timeline first?
3. **Any features to add/cut?**
