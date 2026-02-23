# Mission Control

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Stack-Node.js%20%2B%20SQLite-orange" alt="Stack">
</p>

Mission Control is an AI-powered operational command center for managing an organization's workflows, KPIs, tasks, and cross-department coordination. It provides a unified dashboard and API for tracking action items, CRM deals, social media posts, vendor management, and more — all accessible via both a web interface and an MCP (Model Context Protocol) server for AI agent integration.

---

## Table of Contents

- [What is Mission Control?](#what-is-mission-control)
- [The MCP Server](#the-mcp-server)
- [Technical Architecture](#technical-architecture)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [MCP Tools Reference](#mcp-tools-reference)
- [Database Schema](#database-schema)

---

## What is Mission Control?

Mission Control serves as the central nervous system for organizational operations. It consolidates multiple operational workflows into a single source of truth:

### Core Features

| Feature | Description |
|---------|-------------|
| **Action Items** | Track cross-functional tasks with severity levels (red/yellow/blue), ownership, and threading |
| **Task Management** | Kanban-style task board with departments, priorities, and blocker tracking |
| **KPI Tracking** | Department-level KPI snapshots with targets, current values, and trend analysis |
| **CRM Pipeline** | Sales pipeline management from lead to close with deal values and stages |
| **Social Media** | Plan, schedule, and track social media posts across X, LinkedIn Company, and LinkedIn Personal |
| **Vendor Management** | Track vendor subscriptions, costs, renewal dates, and department assignments |
| **Research Requests** | Manage research tasks with priority levels and deliverable tracking |
| **Visual Requests** | Design task management linked to social media posts |
| **Organization Tree** | Agent/department hierarchy with status tracking |

### Use Cases

- **COO Dashboard**: Real-time org status, KPI summaries, blockers, and reporting
- **AI Agent Integration**: LLMs can query and manipulate data via the MCP server
- **Cross-Department Coordination**: Single source for VPs to track department health
- **Weekly Reporting**: Templates for executive summaries and operational reports

---

## The MCP Server

The Mission Control MCP (Model Context Protocol) server exposes all Mission Control data and functionality to AI agents. This enables AI systems to:

1. **Query** organizational data (actions, tasks, KPIs, deals, posts, vendors)
2. **Create** new records (deals, tasks, action items, posts)
3. **Update** existing records with full CRUD operations
4. **Trigger** synchronizations with external systems (Twenty CRM, etc.)

### How It Works

```
┌─────────────────┐      SSE (port 3001)       ┌──────────────────┐
│   AI Agent      │ ◄─────────────────────────► │  MCP Server      │
│ (Claude, etc.)  │                            │  (Node.js)        │
└─────────────────┘                            └────────┬─────────┘
                                                         │
                                                         │ SQL
                                                         ▼
                                                  ┌──────────────┐
                                                  │   SQLite DB   │
                                                  └──────────────┘
```

### Transport Options

| Mode | Command | Description |
|------|---------|-------------|
| **SSE** | `node mcp-server.js` | Server-Sent Events on port 3001 (default) |
| **stdio** | `node mcp-server.js --stdio` | Standard I/O for local integration |

### Endpoints

- **SSE**: `http://localhost:3001/sse`
- **Messages**: `http://localhost:3001/messages`
- **Health**: `http://localhost:3001/health`

---

## Technical Architecture

### Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Node.js 22+ |
| **Web Server** | Express.js 5.x |
| **Database** | SQLite 3 (better-sqlite3) with WAL mode |
| **Protocol** | Model Context Protocol (MCP) SDK |
| **Templating** | Marked (Markdown rendering) |
| **Real-time** | WebSockets (ws) |

### Project Structure

```
mission-control/
├── app/
│   ├── db.js            # Database schema & migrations
│   ├── server.js        # Express REST API server (port 3000)
│   ├── mcp-server.js    # MCP server (port 3001)
│   ├── scheduler.js    # Sync jobs & scheduled tasks
│   ├── sync.js         # External system sync (Twenty CRM)
│   ├── package.json    # Node dependencies
│   └── public/         # Static assets & web UI
├── kpis/               # Department KPI definitions
├── reports/            # Report templates & generated reports
├── infrastructure/     # Infrastructure configs (tunnels, etc.)
├── scripts/           # Utility scripts
├── dashboard.md       # Main operational dashboard
├── blockers.md        # Active blockers tracker
└── org-structure.md  # Organization hierarchy
```

### API Servers

| Server | Port | Purpose |
|--------|------|---------|
| **REST API** | 3000 | Web UI, CRUD operations |
| **MCP Server** | 3001 | AI agent integration (SSE) |

### Database Schema

The SQLite database contains these core tables:

- `tasks` - Kanban task board
- `action_items` - Cross-functional action tracking
- `kpi_snapshots` - KPI time-series data
- `crm_pipeline` - Deals and pipeline stages
- `posts` - Social media content calendar
- `vendors` - Vendor subscription management
- `milestones` - Project milestones
- `research_requests` - Research task tracking
- `visual_requests` - Design task management
- `sync_status` - External sync timestamps
- `activity_log` - Audit trail

---

## Getting Started

### Prerequisites

- Node.js 22.x or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sylvia-amtc/mission-control.git
cd mission-control/app

# Install dependencies
npm install

# Start the REST API server (port 3000)
node server.js

# In another terminal, start the MCP server (port 3001)
node mcp-server.js
```

### Quick Start with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start both servers with PM2
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | REST API server port |
| `MCP_PORT` | 3001 | MCP server port |
| `DB_PATH` | `../mission-control.db` | SQLite database path |

### Health Checks

```bash
# REST API
curl http://localhost:3000/health

# MCP Server
curl http://localhost:3001/health
```

---

## API Reference

### REST API Base URL

```
http://localhost:3000/api
```

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/actions` | List action items |
| POST | `/api/actions` | Create action item |
| GET | `/api/tasks` | List tasks (Kanban) |
| POST | `/api/tasks` | Create task |
| GET | `/api/kpis` | Get current KPIs |
| POST | `/api/kpis/push` | Push KPI update |
| GET | `/api/crm/deals` | List CRM deals |
| POST | `/api/crm/deals` | Create deal |
| GET | `/api/posts` | List social posts |
| POST | `/api/posts` | Create post |
| GET | `/api/vendors` | List vendors |
| POST | `/api/vendors` | Create vendor |
| GET | `/api/org` | Organization tree |
| GET | `/api/visual-requests` | List visual requests |
| GET | `/api/research-requests` | List research requests |

---

## MCP Tools Reference

The MCP server exposes these tool categories:

### Read Tools (Query Data)

| Tool | Description |
|------|-------------|
| `list_actions` | List action items with filters |
| `get_action` | Get single action by ID |
| `list_tasks` | List tasks with filters |
| `list_kpis` | Get current KPI snapshots |
| `list_deals` | List CRM deals |
| `list_posts` | List social media posts |
| `vendor_list` | List vendors |
| `dashboard_summary` | High-level org overview |
| `crm_pipeline_summary` | Pipeline stats |
| `get_department` | Department detail |
| `list_agents` | List all agents |
| `get_sync_status` | External sync status |

### Write Tools (Mutate Data)

| Tool | Description |
|------|-------------|
| `create_action` | Create action item |
| `update_action` | Update action |
| `resolve_action` | Resolve action |
| `create_task` | Create task |
| `update_task` | Update task |
| `move_task` | Change task status |
| `create_post` | Create social post |
| `approve_post` | Approve post |
| `create_deal` | Create CRM deal |
| `move_deal_stage` | Move deal stage |
| `vendor_create` | Create vendor |
| `vendor_update` | Update vendor |
| `wake_agent` | Wake an agent |
| `trigger_sync` | Trigger full sync |

### Example MCP Query

```json
{
  "tool": "list_actions",
  "arguments": {
    "status": "open",
    "severity": "red"
  }
}
```

---

## License

MIT License - See LICENSE file for details.

---

## Credits

Built for Amtecco B.V. — AI-powered operational command for modern organizations.
