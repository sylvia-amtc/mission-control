# Feature: Vendor & Account Registry

## Overview
Add a "Vendors & Accounts" page to Mission Control that gives David a single overview of all SaaS subscriptions, external accounts, and services Amtecco is using — who owns each, who has access, what it costs, and current status.

## Why
David is creating many accounts across vendors (Apollo, GoLogin, Figma, Google Workspace, LinkedIn Sales Navigator, etc.) and needs a centralized view. No one should have to remember what's active — it should be in MC.

## Requirements

### Data Model (`vendors` table in SQLite)
- `id` (auto-increment)
- `name` (vendor/service name, e.g. "Apollo.io")
- `category` (enum: lead-gen, design, infrastructure, analytics, social, communication, other)
- `url` (vendor website)
- `plan` (free tier, basic, pro, enterprise, custom — text field)
- `cost_monthly` (decimal, 0 for free)
- `cost_annual` (decimal, nullable — for annual billing)
- `billing_cycle` (monthly / annual / one-time / free)
- `owner` (who manages the account — agent name or "David")
- `users` (JSON array of agent/person names who have access)
- `department` (Engineering, R&I, Marketing, Sales, Design, Docs, MC, Corporate)
- `status` (active / trial / pending-approval / suspended / cancelled)
- `login_email` (which email is used to log in — NOT password)
- `notes` (free text)
- `renewal_date` (nullable date)
- `created_at`, `updated_at` (timestamps)

### API Endpoints
- `GET /api/vendors` — list all, with filters: `?status=active&department=Sales&category=lead-gen`
- `GET /api/vendors/:id` — single vendor detail
- `POST /api/vendors` — create
- `PATCH /api/vendors/:id` — update
- `DELETE /api/vendors/:id` — soft-delete (set status=cancelled)
- `GET /api/vendors/summary` — aggregate: total monthly spend, count by status, count by department

### UI Page (route: `/vendors`)
- Table view with sortable columns: Name, Category, Plan, Cost/mo, Owner, Department, Status
- Color-coded status badges (green=active, yellow=trial, blue=pending, red=cancelled)
- Filter bar: by department, category, status
- Search by name
- "Add Vendor" button → modal form
- Click row → detail/edit panel (slide-in, consistent with action items UX)
- Summary cards at top: Total Monthly Spend, Active Accounts, Pending Approval, By Department (mini bar chart)
- Cost breakdown by department (simple horizontal bar or pie)

### Navigation
- Add "💳 Vendors" to the MC sidebar/nav
- Must use the URL routing system (from Run #3) — `/vendors` route with deep linking

### Seed Data
Pre-populate with known accounts:
1. Google Workspace — $0 (included), Corporate, active, owner: David, users: all VPs
2. Apollo.io — pending-approval, $49/mo, Sales, owner: Elena
3. GoLogin — pending-approval, $49/mo, Sales, owner: Elena  
4. Figma — active, Professional plan, Design, owner: Zara, login: sylvia@amtc.tv
5. LinkedIn Sales Navigator — active, Sales, owner: Elena
6. Cloudflare — active, Infrastructure, owner: David
7. Brave Search API — active, $0 (free tier), Corporate, owner: Sylvia
8. Groq — active, $0 (free tier), Corporate, owner: Sylvia
9. ElevenLabs — if applicable

### MCP Tools (add to mc-api.sh + MCP server)
- `vendor_list`, `vendor_get`, `vendor_create`, `vendor_update`, `vendor_summary`

## Constraints
- Follow existing MC patterns (SQLite WAL, shared logger, PM2 managed)
- Must work with the URL routing from Run #3
- Dark mode, Amtecco brand colors
- No passwords stored — only login email and notes
- Consistent with existing MC UX (card layouts, slide-in panels, filters)

## Out of Scope
- Password vault / secrets management
- Automated billing integration
- SSO management
