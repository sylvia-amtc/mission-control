#!/usr/bin/env node
/**
 * Mission Control MCP Server
 * Exposes MC data via Model Context Protocol for agent queries.
 * Transport: SSE on port 3001 (or stdio with --stdio flag)
 */

const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const express = require('express');
const { z } = require('zod');

// Import DB
const { db, stmts } = require('./db');

const server = new McpServer({
  name: 'mission-control',
  version: '1.0.0',
});

// ─── TOOLS ──────────────────────────────────────────────────────

// 1. Action Items
server.tool('list_actions', 'List action items with optional filters',
  { status: z.enum(['all', 'open', 'resolved', 'deferred', 'awaiting_david', 'awaiting_vp']).optional().describe('Filter by status (default: all)'),
    severity: z.enum(['red', 'yellow', 'blue']).optional().describe('Filter by severity'),
    requester: z.string().optional().describe('Filter by requester/VP name'),
    limit: z.number().optional().describe('Max results (default 50)') },
  async ({ status, severity, requester, limit }) => {
    let actions;
    if (status === 'open') actions = stmts.getOpenActions.all();
    else if (status && status !== 'all') actions = stmts.getActionsByStatus.all(status);
    else actions = stmts.getAllActions.all();
    if (severity) actions = actions.filter(a => a.severity === severity);
    if (requester) actions = actions.filter(a => a.requester && a.requester.toLowerCase().includes(requester.toLowerCase()));
    actions = actions.slice(0, limit || 50);
    return { content: [{ type: 'text', text: JSON.stringify(actions, null, 2) }] };
  }
);

server.tool('get_action', 'Get a single action item by ID',
  { id: z.number().describe('Action item ID') },
  async ({ id }) => {
    const action = stmts.getAction.get(id);
    if (!action) return { content: [{ type: 'text', text: 'Action not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(action, null, 2) }] };
  }
);

server.tool('get_action_messages', 'Get conversation thread for an action item',
  { id: z.number().describe('Action item ID') },
  async ({ id }) => {
    const messages = stmts.getActionMessages.all(id);
    return { content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }] };
  }
);

server.tool('get_action_counts', 'Get action item counts by status and severity',
  {},
  async () => {
    const all = stmts.getAllActions.all();
    const counts = { open: 0, awaiting_david: 0, awaiting_vp: 0, resolved: 0, deferred: 0, red: 0, yellow: 0, blue: 0, total: all.length };
    all.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; counts[a.severity] = (counts[a.severity] || 0) + 1; });
    const requesters = {};
    all.forEach(a => { if (a.requester) requesters[a.requester] = (requesters[a.requester] || 0) + 1; });
    counts.requesters = requesters;
    return { content: [{ type: 'text', text: JSON.stringify(counts, null, 2) }] };
  }
);

// 2. KPIs
server.tool('list_kpis', 'Get current KPI snapshots, optionally filtered by department',
  { department: z.string().optional().describe('Department name filter') },
  async ({ department }) => {
    const kpis = department ? stmts.getKPIByDept.all(department, department) : stmts.getKPILatest.all();
    return { content: [{ type: 'text', text: JSON.stringify(kpis, null, 2) }] };
  }
);

server.tool('get_kpi_history', 'Get historical KPI data for a department and KPI name',
  { department: z.string().describe('Department name'), kpi_name: z.string().describe('KPI name') },
  async ({ department, kpi_name }) => {
    const history = stmts.getKPIHistory.all(department, kpi_name);
    return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
  }
);

// 3. Tasks/Kanban
server.tool('list_tasks', 'List tasks with optional filters',
  { status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional(),
    department: z.string().optional(),
    limit: z.number().optional() },
  async ({ status, department, limit }) => {
    let tasks;
    if (status) tasks = stmts.getTasksByStatus.all(status);
    else if (department) tasks = stmts.getTasksByDept.all(department);
    else tasks = stmts.getAllTasks.all();
    tasks = tasks.slice(0, limit || 100);
    return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
  }
);

server.tool('get_task', 'Get a single task by ID',
  { id: z.number().describe('Task ID') },
  async ({ id }) => {
    const task = stmts.getTask.get(id);
    if (!task) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
  }
);

server.tool('get_task_stats', 'Get task statistics (counts by status, blockers, overdue)',
  {},
  async () => {
    const byStatus = {};
    for (const row of stmts.taskStats.all()) byStatus[row.status] = row.count;
    const blockers = stmts.blockerCount.get().count;
    const overdue = stmts.overdueCount.get().count;
    const overdueTasks = stmts.overdueTasks.all();
    return { content: [{ type: 'text', text: JSON.stringify({ byStatus, totalTasks: Object.values(byStatus).reduce((a,b)=>a+b,0), blockers, overdue, overdueTasks }, null, 2) }] };
  }
);

// 4. Sync Status
server.tool('get_sync_status', 'Get last sync times for all data sources',
  {},
  async () => {
    const statuses = stmts.getAllSyncStatus.all();
    return { content: [{ type: 'text', text: JSON.stringify(statuses, null, 2) }] };
  }
);

server.tool('trigger_sync', 'Trigger a full sync of all data sources',
  {},
  async () => {
    try {
      const { syncAllSources } = require('./scheduler');
      const results = await syncAllSources();
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, results }, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e.message }) }], isError: true };
    }
  }
);

// 5. Dashboard Summary
server.tool('dashboard_summary', 'Get high-level overview: blockers, stale items, department health, open actions',
  {},
  async () => {
    const byStatus = {};
    for (const row of stmts.taskStats.all()) byStatus[row.status] = row.count;
    const blockers = stmts.blockerCount.get().count;
    const overdue = stmts.overdueCount.get().count;
    const openActions = stmts.getOpenActions.all();
    const kpis = stmts.getKPILatest.all();
    const syncStatus = stmts.getAllSyncStatus.all();
    const milestones = db.prepare("SELECT * FROM milestones WHERE status != 'completed' ORDER BY target_date").all();

    // Department health from KPIs
    const deptHealth = {};
    for (const k of kpis) {
      if (!deptHealth[k.department]) deptHealth[k.department] = { kpis: [], onTrack: 0, atRisk: 0, behind: 0 };
      deptHealth[k.department].kpis.push({ name: k.kpi_name, value: k.current_value, target: k.target, status: k.status });
      const s = (k.status || '').toLowerCase();
      if (s.includes('on track') || s.includes('✅') || s.includes('🟢')) deptHealth[k.department].onTrack++;
      else if (s.includes('at risk') || s.includes('⚠') || s.includes('🟡')) deptHealth[k.department].atRisk++;
      else deptHealth[k.department].behind++;
    }

    // Stale actions (no activity in 7+ days)
    const staleActions = openActions.filter(a => {
      if (!a.last_activity) return true;
      const diff = Date.now() - new Date(a.last_activity).getTime();
      return diff > 7 * 24 * 60 * 60 * 1000;
    });

    const summary = {
      tasks: { ...byStatus, total: Object.values(byStatus).reduce((a,b)=>a+b,0), blockers, overdue },
      actions: { total: openActions.length, red: openActions.filter(a=>a.severity==='red').length, yellow: openActions.filter(a=>a.severity==='yellow').length, blue: openActions.filter(a=>a.severity==='blue').length, stale: staleActions.length },
      staleActions: staleActions.map(a => ({ id: a.id, title: a.title, severity: a.severity, lastActivity: a.last_activity })),
      departmentHealth: deptHealth,
      upcomingMilestones: milestones.slice(0, 10),
      syncStatus,
    };
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  }
);

// 6. CRM Data
server.tool('crm_pipeline_summary', 'Get CRM pipeline summary with stage counts and values',
  {},
  async () => {
    const stats = stmts.pipelineStats.all();
    const deals = stmts.getAllDeals.all();
    const stages = ['lead', 'qualified', 'opportunity', 'proposal', 'closed_won'];
    const pipeline = stages.map(s => {
      const st = stats.find(x => x.stage === s) || { count: 0, total_value: 0 };
      return { stage: s, count: st.count, value: st.total_value || 0 };
    });
    const totalValue = pipeline.reduce((a, s) => a + s.value, 0);
    const companyCount = new Set(deals.map(d => d.company_name)).size;
    const contactCount = new Set(deals.filter(d => d.contact_name).map(d => d.contact_name)).size;
    return { content: [{ type: 'text', text: JSON.stringify({ pipeline, totalValue, totalDeals: deals.length, uniqueCompanies: companyCount, uniqueContacts: contactCount }, null, 2) }] };
  }
);

server.tool('list_deals', 'List CRM deals, optionally filtered by stage',
  { stage: z.enum(['lead', 'qualified', 'opportunity', 'proposal', 'closed_won', 'closed_lost']).optional() },
  async ({ stage }) => {
    const deals = stage ? stmts.getDealsByStage.all(stage) : stmts.getAllDeals.all();
    return { content: [{ type: 'text', text: JSON.stringify(deals, null, 2) }] };
  }
);

// 7. Department detail
server.tool('get_department', 'Get detailed info for a department (tasks, KPIs, actions, milestones)',
  { name: z.string().describe('Department name') },
  async ({ name }) => {
    const tasks = stmts.getTasksByDept.all(name);
    const kpis = stmts.getKPIByDept.all(name, name);
    const actions = db.prepare("SELECT * FROM action_items WHERE requester LIKE ? OR description LIKE ? ORDER BY severity, opened_date").all(`%${name.split(' ')[0]}%`, `%${name.split(' ')[0]}%`);
    const milestones = db.prepare('SELECT * FROM milestones WHERE department = ? ORDER BY target_date').all(name);
    return { content: [{ type: 'text', text: JSON.stringify({ department: name, tasks: tasks.length, tasksByStatus: tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {}), kpis, openActions: actions.filter(a => a.status !== 'resolved' && a.status !== 'deferred'), milestones }, null, 2) }] };
  }
);

// 8. Social Calendar Posts
server.tool('list_posts', 'List social media posts with optional filters',
  { status: z.enum(['draft', 'pending_review', 'approved', 'declined', 'changes_requested', 'posted']).optional(),
    platform: z.enum(['x', 'linkedin_company', 'linkedin_personal']).optional(),
    limit: z.number().optional() },
  async ({ status, platform, limit }) => {
    let posts;
    if (status) posts = stmts.getPostsByStatus.all(status);
    else if (platform) posts = stmts.getPostsByPlatform.all(platform);
    else posts = stmts.getAllPosts.all();
    posts = posts.slice(0, limit || 50);
    return { content: [{ type: 'text', text: JSON.stringify(posts, null, 2) }] };
  }
);

server.tool('get_post', 'Get a single social media post by ID',
  { id: z.number().describe('Post ID') },
  async ({ id }) => {
    const post = stmts.getPost.get(id);
    if (!post) return { content: [{ type: 'text', text: 'Post not found' }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(post, null, 2) }] };
  }
);

server.tool('get_post_messages', 'Get conversation thread for a social media post',
  { id: z.number().describe('Post ID') },
  async ({ id }) => {
    const messages = stmts.getPostMessages.all(id);
    return { content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }] };
  }
);

// ─── WRITE TOOLS (proxy to REST API) ────────────────────────────

const API = 'http://localhost:3000';
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}
function apiResult(r) {
  return { content: [{ type: 'text', text: JSON.stringify(r.data, null, 2) }], isError: r.status >= 400 };
}

// Actions
server.tool('create_action', 'Create a new action item',
  { title: z.string(), description: z.string().min(20), severity: z.enum(['red', 'yellow', 'blue']).optional(), requester: z.string().optional(), department: z.string().optional() },
  async (args) => apiResult(await api('POST', '/api/actions', args))
);

server.tool('update_action', 'Update an existing action item',
  { id: z.number(), title: z.string().optional(), description: z.string().optional(), severity: z.enum(['red', 'yellow', 'blue']).optional(), status: z.string().optional(), owner: z.string().optional(), requester: z.string().optional(), notes: z.string().optional() },
  async ({ id, ...body }) => apiResult(await api('PUT', `/api/actions/${id}`, body))
);

server.tool('add_action_message', 'Add a message to an action item thread',
  { id: z.number(), author: z.string(), message: z.string() },
  async ({ id, author, message }) => apiResult(await api('POST', `/api/actions/${id}/messages`, { sender: author, message }))
);

server.tool('resolve_action', 'Resolve an action item',
  { id: z.number(), notes: z.string().optional(), sender: z.string().optional() },
  async ({ id, ...body }) => apiResult(await api('PATCH', `/api/actions/${id}/resolve`, body))
);

server.tool('defer_action', 'Defer an action item',
  { id: z.number(), defer_until: z.string().optional(), reason: z.string().optional() },
  async ({ id, defer_until, reason }) => apiResult(await api('PATCH', `/api/actions/${id}/defer`, { notes: reason || defer_until || '' }))
);

server.tool('reopen_action', 'Reopen a resolved/deferred action item',
  { id: z.number(), sender: z.string().optional() },
  async ({ id, sender }) => apiResult(await api('PATCH', `/api/actions/${id}/reopen`, { sender }))
);

// Tasks
server.tool('create_task', 'Create a new task',
  { title: z.string(), description: z.string().optional(), department: z.string().optional(), owner: z.string().optional(), priority: z.enum(['low', 'medium', 'high', 'critical']).optional(), status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional(), due_date: z.string().optional(), is_blocker: z.boolean().optional(), blocker_note: z.string().optional(), milestone: z.string().optional() },
  async (args) => apiResult(await api('POST', '/api/tasks', args))
);

server.tool('update_task', 'Update an existing task',
  { id: z.number(), title: z.string().optional(), description: z.string().optional(), department: z.string().optional(), owner: z.string().optional(), priority: z.enum(['low', 'medium', 'high', 'critical']).optional(), status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional(), due_date: z.string().optional(), is_blocker: z.boolean().optional(), blocker_note: z.string().optional(), milestone: z.string().optional() },
  async ({ id, ...body }) => apiResult(await api('PUT', `/api/tasks/${id}`, body))
);

server.tool('move_task', 'Move a task to a different status',
  { id: z.number(), status: z.enum(['backlog', 'in_progress', 'review', 'done']) },
  async ({ id, status }) => apiResult(await api('PATCH', `/api/tasks/${id}/move`, { status }))
);

server.tool('delete_task', 'Delete a task',
  { id: z.number() },
  async ({ id }) => apiResult(await api('DELETE', `/api/tasks/${id}`))
);

// KPIs
server.tool('push_kpis', 'Push/update a KPI value',
  { department: z.string(), kpi_name: z.string(), current_value: z.string(), target: z.string().optional(), status: z.string().optional(), trend: z.string().optional() },
  async (args) => apiResult(await api('POST', '/api/kpis/push', args))
);

// Posts
server.tool('create_post', 'Create a social media post',
  { title: z.string(), content: z.string().optional(), platform: z.enum(['x', 'linkedin_company', 'linkedin_personal']).optional(), scheduled_at: z.string().optional(), status: z.enum(['draft', 'pending_review', 'approved', 'declined', 'changes_requested', 'posted']).optional(), hashtags: z.string().optional(), media_urls: z.array(z.string()).optional(), author: z.string().optional() },
  async (args) => apiResult(await api('POST', '/api/posts', args))
);

server.tool('update_post', 'Update a social media post',
  { id: z.number(), title: z.string().optional(), content: z.string().optional(), platform: z.enum(['x', 'linkedin_company', 'linkedin_personal']).optional(), scheduled_at: z.string().optional(), status: z.string().optional(), hashtags: z.string().optional(), media_urls: z.array(z.string()).optional() },
  async ({ id, ...body }) => apiResult(await api('PATCH', `/api/posts/${id}`, body))
);

server.tool('add_post_message', 'Add a message to a post thread',
  { id: z.number(), author: z.string(), message: z.string() },
  async ({ id, author, message }) => apiResult(await api('POST', `/api/posts/${id}/messages`, { sender: author, message }))
);

server.tool('approve_post', 'Approve a social media post',
  { id: z.number(), sender: z.string().optional() },
  async ({ id, sender }) => apiResult(await api('PATCH', `/api/posts/${id}/approve`, { sender }))
);

server.tool('decline_post', 'Decline a social media post',
  { id: z.number(), reason: z.string().optional(), sender: z.string().optional() },
  async ({ id, reason, sender }) => apiResult(await api('PATCH', `/api/posts/${id}/decline`, { reason, sender }))
);

// CRM
server.tool('create_deal', 'Create a CRM deal',
  { company_name: z.string(), contact_name: z.string().optional(), stage: z.enum(['lead', 'qualified', 'opportunity', 'proposal', 'closed_won', 'closed_lost']).optional(), value: z.number().optional(), currency: z.string().optional(), owner: z.string().optional(), source: z.string().optional(), notes: z.string().optional(), expected_close: z.string().optional() },
  async (args) => apiResult(await api('POST', '/api/crm/deals', args))
);

server.tool('update_deal', 'Update a CRM deal',
  { id: z.number(), company_name: z.string().optional(), contact_name: z.string().optional(), stage: z.string().optional(), value: z.number().optional(), currency: z.string().optional(), owner: z.string().optional(), notes: z.string().optional(), expected_close: z.string().optional() },
  async ({ id, ...body }) => apiResult(await api('PUT', `/api/crm/deals/${id}`, body))
);

server.tool('move_deal_stage', 'Move a deal to a different pipeline stage',
  { id: z.number(), stage: z.enum(['lead', 'qualified', 'opportunity', 'proposal', 'closed_won', 'closed_lost']) },
  async ({ id, stage }) => apiResult(await api('PATCH', `/api/crm/deals/${id}/stage`, { stage }))
);

server.tool('delete_deal', 'Delete a CRM deal',
  { id: z.number() },
  async ({ id }) => apiResult(await api('DELETE', `/api/crm/deals/${id}`))
);

// 9. Organization / Agent Status
server.tool('get_org_tree', 'Get full organizational tree (nested JSON)',
  {},
  async () => apiResult(await api('GET', '/api/org'))
);

server.tool('list_agents', 'Get flat list of all agents with status',
  {},
  async () => apiResult(await api('GET', '/api/org/agents'))
);

server.tool('get_agent', 'Get single agent detail',
  { agent_id: z.string().describe('Agent ID (e.g. viktor, nadia)') },
  async ({ agent_id }) => apiResult(await api('GET', `/api/org/agents/${agent_id}`))
);

server.tool('update_agent_status', 'Update agent status and task info',
  { agent_id: z.string(), status: z.enum(['active', 'sleeping']).optional(), current_task: z.string().optional(), last_task: z.string().optional(), last_active_at: z.string().optional(), next_wake_at: z.string().optional() },
  async ({ agent_id, ...body }) => apiResult(await api('PATCH', `/api/org/agents/${agent_id}/status`, body))
);

server.tool('wake_agent', 'Write a wake request for an agent',
  { agent_id: z.string(), message: z.string().describe('What the agent should work on'), requested_by: z.string().optional() },
  async ({ agent_id, ...body }) => apiResult(await api('POST', `/api/org/agents/${agent_id}/wake`, body))
);

// ─── RESOURCES ──────────────────────────────────────────────────

server.resource('dashboard', 'mission-control://dashboard', async (uri) => {
  const fs = require('fs');
  const mcDir = path.join(__dirname, '..');
  try {
    const content = fs.readFileSync(path.join(mcDir, 'dashboard.md'), 'utf8');
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: content }] };
  } catch {
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Dashboard file not found' }] };
  }
});

// ─── START ──────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes('--stdio')) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Mission Control MCP server running on stdio');
  } else {
    const app = express();
    const PORT = parseInt(process.env.MCP_PORT || '3001');
    
    // Track transports for cleanup
    const transports = {};
    
    app.get('/sse', async (req, res) => {
      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = transport;
      res.on('close', () => { delete transports[transport.sessionId]; });
      await server.connect(transport);
    });
    
    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId;
      const transport = transports[sessionId];
      if (!transport) return res.status(400).json({ error: 'No transport for session' });
      await transport.handlePostMessage(req, res);
    });
    
    app.get('/health', (req, res) => res.json({ ok: true, server: 'mission-control-mcp', port: PORT }));
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Mission Control MCP server running on port ${PORT} (SSE)`);
      console.log(`  SSE endpoint: http://localhost:${PORT}/sse`);
      console.log(`  Health check: http://localhost:${PORT}/health`);
    });
  }
}

main().catch(err => { console.error('MCP server failed to start:', err); process.exit(1); });
