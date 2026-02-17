# Amtecco Mission Control

**Purpose:** COO operational dashboard and CEO single pane of glass

**Owner:** Sylvia (COO)

**Audience:** Sylvia (operational command), David (CEO, executive overview)

---

## Quick Start

### For Sylvia (COO)
- **Main dashboard:** `dashboard.md` — org status, KPI overview, blockers
- **Department KPIs:** `kpis/<department>.md` — detailed metrics per department
- **Weekly report:** `reports/weekly-YYYY-MM-DD.md` — generate from template
- **Report to CEO:** `reports/executive-summary-YYYY-MM-DD.md` — high-level for David

### For David (CEO)
- **Read this:** `dashboard.md` — at-a-glance org health
- **Weekly briefing:** `reports/executive-summary-YYYY-MM-DD.md` — delivered weekly by Sylvia

### For Department VPs
- **Update your KPIs:** `kpis/<department>.md` — weekly updates before reporting deadline
- **Flag blockers:** `blockers.md` — escalate issues immediately

---

## File Structure

```
mission-control/
├── README.md                          # This file
├── dashboard.md                       # Main dashboard (org status, KPI summary)
├── org-structure.md                   # Org chart, roles, reporting lines
├── blockers.md                        # Active blockers and risks tracker
├── reporting-schedule.md              # What's due from whom and when
├── kpis/                              # Department KPI tracking
│   ├── research-intelligence.md       # R&I KPIs (Nadia)
│   ├── marketing-content.md           # Marketing KPIs (Max)
│   ├── sales-business-dev.md          # Sales KPIs (Elena)
│   └── engineering-product.md         # Engineering KPIs (Viktor)
├── reports/                           # Generated reports
│   ├── weekly-report-template.md      # Template for COO weekly ops report
│   ├── executive-summary-template.md  # Template for CEO weekly briefing
│   └── [dated reports go here]        # weekly-2026-02-16.md, etc.
└── archive/                           # Old reports and historical data
```

---

## Workflow

### Weekly Reporting Cycle (Example: Reports Due Monday)

**Thursday:**
- VPs update their department KPIs (`kpis/<department>.md`)
- VPs flag any new blockers in `blockers.md`

**Friday:**
- Sylvia reviews all KPI updates
- Sylvia drafts weekly ops report (`reports/weekly-YYYY-MM-DD.md`)
- Sylvia drafts CEO executive summary (`reports/executive-summary-YYYY-MM-DD.md`)

**Monday Morning:**
- Sylvia delivers CEO executive summary to David
- Sylvia posts weekly ops report (shared with VPs)

**Anytime:**
- Critical blockers flagged immediately in `blockers.md`
- Dashboard updated as org status changes

---

## Dashboard Views

### 1. Operational View (Sylvia)
**File:** `dashboard.md`

- Org status (all departments, agent deployment, health)
- KPI summary (all departments, targets vs. current)
- Active blockers and risks
- Top priorities
- Reporting status (what's due, what's late)

### 2. Executive View (David)
**File:** `reports/executive-summary-YYYY-MM-DD.md` (weekly)

- Company health at-a-glance
- Key wins this week
- Critical blockers
- Key metrics trend (revenue indicators, product health, operational efficiency)
- Next week's focus

### 3. Department View (VPs)
**Files:** `kpis/<department>.md`

- Detailed KPI tracking for their department
- Historical trends
- Blocker escalation
- Next sprint priorities

---

## Updating the Dashboard

### Sylvia (COO)
- Update `dashboard.md` daily or as significant changes occur
- Review `blockers.md` daily
- Generate weekly reports (Friday)

### Department VPs
- Update `kpis/<department>.md` weekly (Thursday EOD)
- Add blockers to `blockers.md` immediately when they arise
- Update org status if team structure changes

### David (CEO)
- Read `dashboard.md` anytime for current state
- Receive `reports/executive-summary-YYYY-MM-DD.md` weekly (Monday)

---

## Principles

1. **Single source of truth:** Mission Control is the canonical org status
2. **Update cadence:** Weekly for KPIs, immediate for blockers
3. **Simplicity:** Markdown-based, human-readable, version-controlled
4. **Escalation:** Critical issues flagged in `blockers.md` immediately
5. **Transparency:** All VPs can see all department status (cross-functional visibility)

---

## Future Enhancements

- Automated KPI aggregation (pull from source systems)
- Dashboard web view (render markdown as HTML)
- Slack/Telegram integration (push notifications for blockers)
- Historical trend visualization (charts from KPI data)

For now: markdown files, manual updates, clear structure.

---

**Questions?** Ask Viktor (built this system) or Sylvia (owns it).
