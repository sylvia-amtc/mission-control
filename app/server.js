const path = require('path');
const fs = require('fs');
const { createLogger } = require('../../shared/lib/logger');
const log = createLogger({
  app: 'mission-control',
  logDir: path.join(__dirname, '..', 'logs'),
});
log.setupProcessHandlers().startMemoryMonitor();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { db, stmts, logActivity } = require('./db');
const { syncAll, syncKPIs } = require('./sync');
const { syncFromTwenty, initialSync: twentyInitialSync } = require('./twenty-sync');
const { startScheduler, syncAllSources, updateSyncStatus } = require('./scheduler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const MC_DIR = path.join(__dirname, '..');

// ─── Helpers ────────────────────────────────────────────────────
function readMd(relPath) {
  try { return fs.readFileSync(path.join(MC_DIR, relPath), 'utf8'); }
  catch { return ''; }
}

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

// ─── Legacy API (org status from markdown) ──────────────────────
function parseOrgTable(raw) {
  const lines = raw.split('\n');
  const rows = [];
  let inOrg = false;
  for (const line of lines) {
    if (line.includes('Department') && line.includes('VP') && line.includes('Health')) { inOrg = true; continue; }
    if (inOrg && line.startsWith('|---')) continue;
    if (inOrg && line.startsWith('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 6) rows.push({ dept: cols[0].replace(/\*\*/g, ''), vp: cols[1], status: cols[2], agents: cols[3], health: cols[4], lastUpdate: cols[5] });
    } else if (inOrg && !line.startsWith('|')) inOrg = false;
  }
  return rows;
}

function parsePriorities(raw) {
  const sections = [];
  const lines = raw.split('\n');
  let inPri = false, cur = null;
  for (const line of lines) {
    if (line.includes('Top Priorities')) { inPri = true; continue; }
    if (inPri && line.startsWith('## ') && !line.includes('Top Priorities')) { inPri = false; continue; }
    if (inPri && line.startsWith('### ')) { cur = { title: line.replace(/^###\s*/, ''), items: [] }; sections.push(cur); continue; }
    if (inPri && cur && /^\d+\.\s+/.test(line)) cur.items.push(line.replace(/^\d+\.\s+/, '').replace(/\*\*/g, ''));
  }
  return sections;
}

function parseInitiatives(raw) {
  const lines = raw.split('\n');
  const initiatives = [];
  let inInit = false, category = '', current = null;
  for (const line of lines) {
    if (line.includes('Strategic Initiatives')) { inInit = true; continue; }
    if (inInit && line.startsWith('## ') && !line.includes('Strategic Initiatives')) { inInit = false; continue; }
    if (inInit && line.startsWith('### ')) { category = line.replace(/^###\s*/, ''); continue; }
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
    if (inInit && m) { current = { name: m[1], category, details: {} }; initiatives.push(current); continue; }
    if (inInit && current && line.match(/^\s+-\s+(.+?):\s*(.+)/)) {
      const [, k, v] = line.match(/^\s+-\s+(.+?):\s*(.+)/);
      current.details[k] = v;
    }
  }
  return initiatives;
}

function parseReporting(raw) {
  const lines = raw.split('\n');
  const reports = [];
  let inTable = false;
  for (const line of lines) {
    if (line.includes('Report') && line.includes('Frequency') && line.includes('Next Due')) { inTable = true; continue; }
    if (inTable && line.startsWith('|---')) continue;
    if (inTable && line.startsWith('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 5) reports.push({ report: cols[0].replace(/\*\*/g, ''), frequency: cols[1], flow: cols[2], nextDue: cols[3], status: cols[4] });
    } else if (inTable && !line.startsWith('|')) inTable = false;
  }
  return reports;
}

function parseRevenueMetrics(raw) {
  const sections = ['Revenue Indicators', 'Product Health', 'Operational Efficiency', 'Growth Indicators'];
  const result = {};
  for (const s of sections) result[s] = parseMetricTable(raw, s);
  return result;
}

function parseMetricTable(raw, heading) {
  const lines = raw.split('\n');
  const metrics = [];
  let found = false, inTable = false;
  for (const line of lines) {
    if (line.includes(heading)) { found = true; continue; }
    if (found && line.startsWith('### ') && !line.includes(heading)) { found = false; continue; }
    if (found && line.includes('Metric') && line.includes('Current') && line.includes('Target')) { inTable = true; continue; }
    if (found && inTable && line.startsWith('|---')) continue;
    if (found && inTable && line.startsWith('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4) metrics.push({ metric: cols[0], current: cols[1], target: cols[2], status: cols[3] });
    } else if (found && inTable && !line.startsWith('|')) inTable = false;
  }
  return metrics;
}

// ─── Dashboard data API (legacy + new) ─────────────────────────
app.get('/api/data', (req, res) => {
  const raw = readMd('dashboard.md');
  const lastUpdated = (raw.match(/Last Updated:\*\*\s*(.+)/) || [])[1] || 'Unknown';
  res.json({
    lastUpdated,
    org: parseOrgTable(raw),
    priorities: parsePriorities(raw),
    initiatives: parseInitiatives(raw),
    reporting: parseReporting(raw),
    revenue: parseRevenueMetrics(raw),
  });
});

// ─── Tasks API ──────────────────────────────────────────────────
app.get('/api/tasks', (req, res) => {
  const { status, department } = req.query;
  let tasks;
  if (status) tasks = stmts.getTasksByStatus.all(status);
  else if (department) tasks = stmts.getTasksByDept.all(department);
  else tasks = stmts.getAllTasks.all();
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = stmts.getTask.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const t = {
    title: req.body.title || 'Untitled',
    description: req.body.description || '',
    department: req.body.department || 'Operations',
    owner: req.body.owner || '',
    priority: req.body.priority || 'medium',
    status: req.body.status || 'backlog',
    due_date: req.body.due_date || null,
    depends_on: JSON.stringify(req.body.depends_on || []),
    is_blocker: req.body.is_blocker ? 1 : 0,
    blocker_note: req.body.blocker_note || '',
    milestone: req.body.milestone || '',
    position: req.body.position || 0,
    start_date: req.body.start_date || new Date().toISOString().split('T')[0],
    end_date: req.body.end_date || req.body.due_date || null,
    progress: req.body.progress || 0,
    is_milestone: req.body.is_milestone ? 1 : 0,
  };
  const result = stmts.insertTask.run(t);
  const task = stmts.getTask.get(result.lastInsertRowid);
  logActivity('create', 'task', task.id, `Task created: ${task.title}`, req.body.actor || 'user');
  broadcast('task_created', task);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const existing = stmts.getTask.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const t = {
    id: parseInt(req.params.id),
    title: req.body.title ?? existing.title,
    description: req.body.description ?? existing.description,
    department: req.body.department ?? existing.department,
    owner: req.body.owner ?? existing.owner,
    priority: req.body.priority ?? existing.priority,
    status: req.body.status ?? existing.status,
    due_date: req.body.due_date ?? existing.due_date,
    depends_on: req.body.depends_on ? JSON.stringify(req.body.depends_on) : existing.depends_on,
    is_blocker: req.body.is_blocker !== undefined ? (req.body.is_blocker ? 1 : 0) : existing.is_blocker,
    blocker_note: req.body.blocker_note ?? existing.blocker_note,
    milestone: req.body.milestone ?? existing.milestone,
    position: req.body.position ?? existing.position,
    start_date: req.body.start_date ?? existing.start_date,
    end_date: req.body.end_date ?? existing.end_date,
    progress: req.body.progress !== undefined ? req.body.progress : (existing.progress || 0),
    is_milestone: req.body.is_milestone !== undefined ? (req.body.is_milestone ? 1 : 0) : (existing.is_milestone || 0),
  };
  stmts.updateTask.run(t);
  const task = stmts.getTask.get(req.params.id);
  logActivity('update', 'task', task.id, `Task updated: ${task.title}`, req.body.actor || 'user');
  broadcast('task_updated', task);
  res.json(task);
});

app.patch('/api/tasks/:id/move', (req, res) => {
  const { status, position } = req.body;
  const existing = stmts.getTask.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  stmts.updateTaskStatus.run({ id: parseInt(req.params.id), status: status || existing.status, position: position ?? existing.position });
  const task = stmts.getTask.get(req.params.id);
  logActivity('move', 'task', task.id, `Task moved to ${task.status}`, req.body.actor || 'user');
  broadcast('task_moved', task);
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const existing = stmts.getTask.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  stmts.deleteTask.run(req.params.id);
  logActivity('delete', 'task', parseInt(req.params.id), `Task deleted: ${existing.title}`, 'user');
  broadcast('task_deleted', { id: parseInt(req.params.id) });
  res.json({ ok: true });
});

// Batch reorder
app.post('/api/tasks/reorder', (req, res) => {
  const { items } = req.body; // [{id, status, position}]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items required' });
  const update = db.transaction(() => {
    for (const item of items) {
      stmts.updateTaskStatus.run({ id: item.id, status: item.status, position: item.position });
    }
  });
  update();
  broadcast('tasks_reordered', items);
  res.json({ ok: true });
});

// ─── Milestones API ─────────────────────────────────────────────
app.get('/api/milestones', (req, res) => {
  res.json(stmts.getAllMilestones.all());
});

app.post('/api/milestones', (req, res) => {
  const m = {
    name: req.body.name || 'Untitled',
    department: req.body.department || '',
    target_date: req.body.target_date || null,
    status: req.body.status || 'pending',
    description: req.body.description || '',
  };
  const result = stmts.insertMilestone.run(m);
  res.status(201).json({ id: result.lastInsertRowid, ...m });
});

app.put('/api/milestones/:id', (req, res) => {
  const m = {
    id: parseInt(req.params.id),
    name: req.body.name || '',
    department: req.body.department || '',
    target_date: req.body.target_date || null,
    completed_date: req.body.completed_date || null,
    status: req.body.status || 'pending',
    description: req.body.description || '',
  };
  stmts.updateMilestone.run(m);
  res.json(m);
});

// ─── KPI API ────────────────────────────────────────────────────
app.get('/api/kpis', (req, res) => {
  const { department } = req.query;
  if (department) {
    res.json(stmts.getKPIByDept.all(department, department));
  } else {
    res.json(stmts.getKPILatest.all());
  }
});

app.get('/api/kpis/history/:department/:kpi', (req, res) => {
  res.json(stmts.getKPIHistory.all(req.params.department, req.params.kpi));
});

app.post('/api/kpis/sync', (req, res) => {
  syncKPIs();
  res.json({ ok: true });
});

// ─── Vendors API ────────────────────────────────────────────────
app.get('/api/vendors', (req, res) => {
  const { status, department, category, search } = req.query;
  let vendors;
  
  // Apply filters using appropriate prepared statements
  if (status && department && category) {
    // Multiple filters: get all vendors and filter in application
    vendors = stmts.getAllVendors.all().filter(v => {
      return v.status === status && v.department === department && v.category === category;
    });
  } else if (status && department) {
    vendors = stmts.getAllVendors.all().filter(v => {
      return v.status === status && v.department === department;
    });
  } else if (status && category) {
    vendors = stmts.getAllVendors.all().filter(v => {
      return v.status === status && v.category === category;
    });
  } else if (department && category) {
    vendors = stmts.getAllVendors.all().filter(v => {
      return v.department === department && v.category === category;
    });
  } else if (status) {
    vendors = stmts.getVendorsByStatus.all(status);
  } else if (department) {
    vendors = stmts.getVendorsByDept.all(department);
  } else if (category) {
    vendors = stmts.getVendorsByCategory.all(category);
  } else {
    vendors = stmts.getAllVendors.all();
  }
  
  // Apply search filter if provided (case insensitive)
  if (search && search.trim()) {
    const searchTerm = search.trim().toLowerCase();
    vendors = vendors.filter(v => v.name.toLowerCase().includes(searchTerm));
  }
  
  // Parse JSON users array for each vendor
  vendors = vendors.map(vendor => ({
    ...vendor,
    users: JSON.parse(vendor.users || '[]')
  }));
  
  logActivity('view', 'vendors', null, `Vendors list viewed (${vendors.length} results)`, 'user');
  res.json(vendors);
});

// ─── Individual Vendor CRUD Endpoints ──────────────────────────
app.get('/api/vendors/:id', (req, res) => {
  const vendor = stmts.getVendorById.get(parseInt(req.params.id));
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  
  // Parse JSON users array
  vendor.users = JSON.parse(vendor.users || '[]');
  
  logActivity('view', 'vendor', vendor.id, `Vendor viewed: ${vendor.name}`, 'user');
  res.json(vendor);
});

app.post('/api/vendors', (req, res) => {
  // Validate required fields
  if (!req.body.name) {
    return res.status(400).json({ error: 'Vendor name is required' });
  }
  
  const v = {
    name: req.body.name.trim(),
    category: req.body.category || 'other',
    url: req.body.url || '',
    plan: req.body.plan || '',
    cost_monthly: parseFloat(req.body.cost_monthly) || 0,
    cost_annual: req.body.cost_annual ? parseFloat(req.body.cost_annual) : null,
    billing_cycle: req.body.billing_cycle || 'monthly',
    owner: req.body.owner || '',
    users: JSON.stringify(req.body.users || []),
    department: req.body.department || '',
    status: req.body.status || 'active',
    login_email: req.body.login_email || '',
    notes: req.body.notes || '',
    renewal_date: req.body.renewal_date || null,
  };
  
  const result = stmts.createVendor.run(v);
  const vendor = stmts.getVendorById.get(result.lastInsertRowid);
  vendor.users = JSON.parse(vendor.users || '[]');
  
  logActivity('create', 'vendor', vendor.id, `Vendor created: ${vendor.name}`, req.body.actor || 'user');
  res.status(201).json(vendor);
});

app.patch('/api/vendors/:id', (req, res) => {
  const existing = stmts.getVendorById.get(parseInt(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Vendor not found' });
  
  const v = {
    id: parseInt(req.params.id),
    name: req.body.name !== undefined ? req.body.name.trim() : existing.name,
    category: req.body.category !== undefined ? req.body.category : existing.category,
    url: req.body.url !== undefined ? req.body.url : existing.url,
    plan: req.body.plan !== undefined ? req.body.plan : existing.plan,
    cost_monthly: req.body.cost_monthly !== undefined ? parseFloat(req.body.cost_monthly) || 0 : existing.cost_monthly,
    cost_annual: req.body.cost_annual !== undefined ? (req.body.cost_annual ? parseFloat(req.body.cost_annual) : null) : existing.cost_annual,
    billing_cycle: req.body.billing_cycle !== undefined ? req.body.billing_cycle : existing.billing_cycle,
    owner: req.body.owner !== undefined ? req.body.owner : existing.owner,
    users: req.body.users !== undefined ? JSON.stringify(req.body.users) : existing.users,
    department: req.body.department !== undefined ? req.body.department : existing.department,
    status: req.body.status !== undefined ? req.body.status : existing.status,
    login_email: req.body.login_email !== undefined ? req.body.login_email : existing.login_email,
    notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
    renewal_date: req.body.renewal_date !== undefined ? req.body.renewal_date : existing.renewal_date,
  };
  
  stmts.updateVendor.run(v);
  const vendor = stmts.getVendorById.get(req.params.id);
  vendor.users = JSON.parse(vendor.users || '[]');
  
  logActivity('update', 'vendor', vendor.id, `Vendor updated: ${vendor.name}`, req.body.actor || 'user');
  res.json(vendor);
});

app.delete('/api/vendors/:id', (req, res) => {
  const existing = stmts.getVendorById.get(parseInt(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Vendor not found' });
  
  // Soft delete: set status to cancelled
  const v = {
    id: parseInt(req.params.id),
    name: existing.name,
    category: existing.category,
    url: existing.url,
    plan: existing.plan,
    cost_monthly: existing.cost_monthly,
    cost_annual: existing.cost_annual,
    billing_cycle: existing.billing_cycle,
    owner: existing.owner,
    users: existing.users,
    department: existing.department,
    status: 'cancelled', // Soft delete
    login_email: existing.login_email,
    notes: existing.notes,
    renewal_date: existing.renewal_date,
  };
  
  stmts.updateVendor.run(v);
  const vendor = stmts.getVendorById.get(req.params.id);
  vendor.users = JSON.parse(vendor.users || '[]');
  
  logActivity('delete', 'vendor', vendor.id, `Vendor cancelled (soft delete): ${vendor.name}`, req.body.actor || 'user');
  res.json(vendor);
});

// ─── Vendors Summary API ────────────────────────────────────────
app.get('/api/vendors/summary', (req, res) => {
  const vendors = stmts.getAllVendors.all();
  
  // Handle empty database gracefully
  if (!vendors || vendors.length === 0) {
    return res.json({
      total_monthly_spend: 0,
      count_by_status: {},
      count_by_department: {},
      active_count: 0,
      trial_count: 0
    });
  }
  
  // Calculate total monthly spend for active vendors only
  const total_monthly_spend = vendors
    .filter(v => v.status === 'active')
    .reduce((sum, v) => sum + (v.cost_monthly || 0), 0);
  
  // Calculate count by status
  const count_by_status = {};
  vendors.forEach(v => {
    count_by_status[v.status] = (count_by_status[v.status] || 0) + 1;
  });
  
  // Calculate count by department
  const count_by_department = {};
  vendors.forEach(v => {
    const dept = v.department || 'Unassigned';
    count_by_department[dept] = (count_by_department[dept] || 0) + 1;
  });
  
  // Calculate specific counts
  const active_count = vendors.filter(v => v.status === 'active').length;
  const trial_count = vendors.filter(v => v.status === 'trial').length;
  
  const summary = {
    total_monthly_spend,
    count_by_status,
    count_by_department,
    active_count,
    trial_count
  };
  
  logActivity('view', 'vendors_summary', null, 'Vendors summary accessed', 'user');
  res.json(summary);
});

// Get unique departments from vendors data  
app.get('/api/vendors/departments', (req, res) => {
  const vendors = stmts.getAllVendors.all();
  const departments = [...new Set(vendors.map(v => v.department).filter(Boolean))].sort();
  res.json(departments);
});

// ─── Action Items API ───────────────────────────────────────────
app.get('/api/actions', (req, res) => {
  const { status, severity, requester, search, page, limit } = req.query;
  let actions;
  if (status === 'open') actions = stmts.getOpenActions.all();
  else if (status && status !== 'all') actions = stmts.getActionsByStatus.all(status);
  else actions = stmts.getAllActions.all();
  
  // Apply filters
  if (severity) actions = actions.filter(a => a.severity === severity);
  if (requester) actions = actions.filter(a => a.requester && a.requester.toLowerCase().includes(requester.toLowerCase()));
  const owner = req.query.owner;
  if (owner) actions = actions.filter(a => a.owner && a.owner.toLowerCase() === owner.toLowerCase());
  if (search) {
    const q = search.toLowerCase();
    // Also search in messages
    actions = actions.filter(a => {
      if (a.title.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)) return true;
      const msgs = stmts.getActionMessages.all(a.id);
      return msgs.some(m => m.message.toLowerCase().includes(q));
    });
  }
  
  // Add message counts
  const msgCounts = {};
  stmts.getActionMessageCount.all().forEach(r => { msgCounts[r.action_id] = r.count; });
  actions = actions.map(a => ({ ...a, message_count: msgCounts[a.id] || 0 }));
  
  // Pagination
  const total = actions.length;
  const pg = parseInt(page) || 1;
  const lim = parseInt(limit) || 12;
  const paginated = actions.slice((pg - 1) * lim, pg * lim);
  
  res.json({ items: paginated, total, page: pg, limit: lim, pages: Math.ceil(total / lim) });
});

app.get('/api/actions/counts', (req, res) => {
  const all = stmts.getAllActions.all();
  const counts = { open: 0, awaiting_david: 0, awaiting_vp: 0, resolved: 0, deferred: 0, red: 0, yellow: 0, blue: 0, total: all.length };
  all.forEach(a => {
    counts[a.status] = (counts[a.status] || 0) + 1;
    counts[a.severity] = (counts[a.severity] || 0) + 1;
  });
  // Requesters
  const requesters = {};
  all.forEach(a => { if (a.requester) requesters[a.requester] = (requesters[a.requester] || 0) + 1; });
  counts.requesters = requesters;
  // Owners
  const owners = {};
  all.forEach(a => { if (a.owner) owners[a.owner] = (owners[a.owner] || 0) + 1; });
  counts.owners = owners;
  res.json(counts);
});

app.post('/api/actions', (req, res) => {
  const desc = (req.body.description || '').trim();
  if (!desc || desc.length < 20) {
    return res.status(400).json({ error: 'Description is required and must be at least 20 characters. Explain what you need and why.' });
  }
  const a = {
    title: req.body.title || 'Untitled',
    description: desc,
    owner: req.body.owner || 'David',
    requester: req.body.requester || '',
    severity: req.body.severity || 'yellow',
    status: req.body.status || 'open',
    notes: req.body.notes || '',
    opened_date: req.body.opened_date || new Date().toISOString().split('T')[0],
  };
  const result = stmts.insertAction.run(a);
  // Add initial message if description provided
  if (a.description) {
    stmts.insertActionMessage.run({ action_id: result.lastInsertRowid, sender: a.requester || 'System', message: a.description });
  }
  broadcast('action_created', { id: result.lastInsertRowid, ...a });
  res.status(201).json({ id: result.lastInsertRowid, ...a });
});

app.put('/api/actions/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = stmts.getAction.get(id);
  if (!existing) return res.status(404).json({ error: 'Action not found' });
  const a = {
    id,
    title: req.body.title !== undefined ? req.body.title : existing.title,
    description: req.body.description !== undefined ? req.body.description : existing.description,
    owner: req.body.owner !== undefined ? req.body.owner : existing.owner,
    requester: req.body.requester !== undefined ? req.body.requester : existing.requester,
    severity: req.body.severity !== undefined ? req.body.severity : existing.severity,
    status: req.body.status !== undefined ? req.body.status : existing.status,
    notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
    resolved_date: req.body.resolved_date !== undefined ? req.body.resolved_date : existing.resolved_date,
  };
  stmts.updateAction.run(a);
  broadcast('action_updated', a);
  res.json(a);
});

// ─── Action Messages (Conversation Thread) ──────────────────────
app.get('/api/actions/:id/messages', (req, res) => {
  const messages = stmts.getActionMessages.all(parseInt(req.params.id));
  res.json(messages);
});

app.post('/api/actions/:id/messages', (req, res) => {
  const actionId = parseInt(req.params.id);
  const action = stmts.getAction.get(actionId);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  
  const sender = req.body.sender || 'David';
  const message = req.body.message || '';
  if (!message.trim()) return res.status(400).json({ error: 'Message required' });
  
  const result = stmts.insertActionMessage.run({ action_id: actionId, sender, message: message.trim() });
  
  // Auto-update status based on who sent
  if (sender === 'David') {
    stmts.updateActionStatus.run({ id: actionId, status: 'awaiting_vp' });
  } else {
    stmts.updateActionStatus.run({ id: actionId, status: 'awaiting_david' });
  }
  
  logActivity('message', 'action', actionId, `${sender} replied to: ${action.title}`, sender);
  broadcast('action_message', { action_id: actionId, sender, message: message.trim(), id: result.lastInsertRowid });
  
  const updated = stmts.getAction.get(actionId);
  res.status(201).json({ message: { id: result.lastInsertRowid, action_id: actionId, sender, message: message.trim() }, action: updated });
});

app.patch('/api/actions/:id/resolve', (req, res) => {
  const id = parseInt(req.params.id);
  stmts.resolveAction.run({ id, notes: req.body.notes || '' });
  if (req.body.notes) {
    stmts.insertActionMessage.run({ action_id: id, sender: req.body.sender || 'System', message: `✅ Resolved: ${req.body.notes}` });
  }
  logActivity('resolve', 'action', id, 'Action item resolved', req.body.sender || 'user');
  broadcast('action_resolved', { id });
  res.json({ ok: true });
});

app.patch('/api/actions/:id/defer', (req, res) => {
  const id = parseInt(req.params.id);
  stmts.deferAction.run({ id, notes: req.body.notes || '' });
  stmts.insertActionMessage.run({ action_id: id, sender: 'David', message: `⏸ Deferred: ${req.body.notes || 'Pushed to later'}` });
  logActivity('defer', 'action', id, 'Action item deferred', 'David');
  broadcast('action_deferred', { id });
  res.json({ ok: true });
});

app.patch('/api/actions/:id/reopen', (req, res) => {
  const id = parseInt(req.params.id);
  stmts.reopenAction.run({ id });
  stmts.insertActionMessage.run({ action_id: id, sender: req.body.sender || 'System', message: '↩ Reopened' });
  logActivity('reopen', 'action', id, 'Action item reopened', 'user');
  broadcast('action_reopened', { id });
  res.json({ ok: true });
});

app.patch('/api/actions/:id/severity', (req, res) => {
  const id = parseInt(req.params.id);
  const { severity } = req.body;
  if (!['red', 'yellow', 'blue'].includes(severity)) return res.status(400).json({ error: 'Invalid severity' });
  stmts.updateActionSeverity.run({ id, severity });
  stmts.insertActionMessage.run({ action_id: id, sender: 'David', message: `🔄 Priority changed to ${severity === 'red' ? '🔴 Blocking Revenue' : severity === 'yellow' ? '🟡 Blocking Progress' : '🔵 Decision Pending'}` });
  logActivity('escalate', 'action', id, `Severity changed to ${severity}`, 'David');
  broadcast('action_updated', { id, severity });
  res.json({ ok: true });
});

// Last sync timestamp tracking
let lastActionSyncTime = new Date().toISOString();
app.get('/api/actions/sync-status', (req, res) => {
  res.json({ lastSynced: lastActionSyncTime });
});

// ─── Summon VP API ──────────────────────────────────────────────
const SUMMON_DIR = path.join(MC_DIR, 'summon-queue');
try { fs.mkdirSync(SUMMON_DIR, { recursive: true }); } catch(e) {}

app.post('/api/actions/:id/summon', (req, res) => {
  const id = parseInt(req.params.id);
  const action = stmts.getAction.get(id);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  const vpName = req.body.vp_name || (action.requester || '').replace(/\s*\(todo-sync\)/g, '').trim();
  if (!vpName) return res.status(400).json({ error: 'No VP specified' });
  const ts = new Date().toISOString();
  const filename = `summon-${id}-${Date.now()}.json`;
  const payload = { action_id: id, vp_name: vpName, title: action.title, severity: action.severity, timestamp: ts };
  fs.writeFileSync(path.join(SUMMON_DIR, filename), JSON.stringify(payload, null, 2));
  logActivity('summon', 'action', id, `VP summoned: ${vpName} for "${action.title}"`, 'David');
  broadcast('vp_summoned', { action_id: id, vp_name: vpName });
  res.json({ ok: true, vp_name: vpName, action_id: id });
});

app.post('/api/actions/summon-all', (req, res) => {
  const targetVP = req.body.vp_name; // optional: summon a specific VP for all their items
  const openActions = stmts.getOpenActions.all();
  const summoned = new Set();
  const results = [];
  const VP_ROSTER = ['Nadia', 'Max', 'Elena', 'Zara', 'Viktor'];
  const vpsToSummon = targetVP ? [targetVP] : VP_ROSTER;
  for (const vpName of vpsToSummon) {
    if (summoned.has(vpName)) continue;
    summoned.add(vpName);
    const ts = new Date().toISOString();
    const filename = `summon-${targetVP ? 'vp' : 'all'}-${vpName.replace(/\s+/g, '_')}-${Date.now()}.json`;
    const actionIds = openActions.filter(a => (a.requester || '').toLowerCase().includes(vpName.toLowerCase())).map(a => a.id);
    const payload = { vp_name: vpName, action_ids: actionIds, timestamp: ts, summon_type: targetVP ? 'single_vp_all_items' : 'all' };
    fs.writeFileSync(path.join(SUMMON_DIR, filename), JSON.stringify(payload, null, 2));
    results.push({ vp_name: vpName, action_count: actionIds.length });
  }
  logActivity('summon_all', 'action', null, `VPs summoned: ${results.map(r => r.vp_name).join(', ')}`, 'David');
  broadcast('vps_summoned_all', { summoned: results });
  res.json({ ok: true, summoned: results });
});

// ─── Activity Log ───────────────────────────────────────────────
app.get('/api/activity', (req, res) => {
  res.json(stmts.getRecentActivity.all());
});

// ─── Gantt / Timeline API ───────────────────────────────────────
app.get('/api/gantt', (req, res) => {
  const tasks = stmts.getAllTasks.all().map(t => ({
    ...t,
    depends_on: JSON.parse(t.depends_on || '[]'),
  }));
  const milestones = stmts.getAllMilestones.all();
  res.json({ tasks, milestones });
});

// ─── KPI History (all KPIs for a department) ────────────────────
app.get('/api/kpis/history/:department', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM kpi_snapshots WHERE department = ? ORDER BY kpi_name, snapshot_date`
  ).all(req.params.department);
  // Group by kpi_name
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.kpi_name]) grouped[r.kpi_name] = [];
    grouped[r.kpi_name].push(r);
  }
  res.json(grouped);
});

// ─── Department detail API ──────────────────────────────────────
app.get('/api/departments/:name', (req, res) => {
  const dept = req.params.name;
  const tasks = stmts.getTasksByDept.all(dept);
  const kpis = stmts.getKPIByDept.all(dept, dept);
  const actions = db.prepare(
    "SELECT * FROM action_items WHERE requester LIKE ? OR description LIKE ? ORDER BY severity, opened_date"
  ).all(`%${dept.split(' ')[0]}%`, `%${dept.split(' ')[0]}%`);
  const blockers = tasks.filter(t => t.is_blocker && t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done').slice(0, 10);
  const milestones = db.prepare('SELECT * FROM milestones WHERE department = ? ORDER BY target_date').all(dept);
  const activity = db.prepare(
    "SELECT * FROM activity_log WHERE message LIKE ? ORDER BY created_at DESC LIMIT 20"
  ).all(`%${dept.split(' ')[0]}%`);

  res.json({ dept, tasks, kpis, actions, blockers, deliverables: done, milestones, activity });
});

// ─── Action Items: re-sync from todo.md ─────────────────────────
app.post('/api/actions/sync-todo', (req, res) => {
  // Delete old todo-sync items and re-import
  db.prepare("DELETE FROM action_items WHERE requester LIKE '%todo-sync%'").run();
  const { syncTodos } = require('./sync');
  syncTodos(true);
  lastActionSyncTime = new Date().toISOString();
  broadcast('actions_synced', {});
  res.json({ ok: true, lastSynced: lastActionSyncTime });
});

// ─── Stats / Command Center data ────────────────────────────────
app.get('/api/stats', (req, res) => {
  const tasksByStatus = {};
  for (const row of stmts.taskStats.all()) tasksByStatus[row.status] = row.count;
  const blockers = stmts.blockerCount.get().count;
  const overdue = stmts.overdueCount.get().count;
  const todayDue = stmts.todayDue.all();
  const overdueTasks = stmts.overdueTasks.all();
  const openActions = stmts.getOpenActions.all();
  const recentActivity = db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    tasksByStatus,
    totalTasks: Object.values(tasksByStatus).reduce((a, b) => a + b, 0),
    blockers,
    overdue,
    todayDue,
    overdueTasks,
    openActions: openActions.length,
    criticalActions: openActions.filter(a => a.severity === 'red').length,
    recentActivity,
  });
});

// ─── WebSocket ──────────────────────────────────────────────────
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
});

// ─── Phase 3: CRM Pipeline (Twenty CRM integration) ────────────
const CRM_BASE = 'https://crm.amtc.tv';

// Twenty CRM Sync — pull real data from crm.amtc.tv
app.get('/api/crm/sync', async (req, res) => {
  try {
    const result = await syncFromTwenty();
    broadcast('crm_synced', result);
    res.json(result);
  } catch (e) {
    log.error('CRM sync failed', { err: e });
    res.json({ ok: false, source: 'local', error: e.message });
  }
});

function mapCRMStage(stage) {
  const map = { 'lead': 'lead', 'qualified': 'qualified', 'opportunity': 'opportunity', 'proposal': 'proposal', 'won': 'closed_won', 'lost': 'closed_lost', 'closed': 'closed_won' };
  return map[stage.toLowerCase()] || 'lead';
}

// CRUD for pipeline deals
app.get('/api/crm/deals', (req, res) => {
  const { stage } = req.query;
  const deals = stage ? stmts.getDealsByStage.all(stage) : stmts.getAllDeals.all();
  res.json(deals);
});

app.get('/api/crm/pipeline', (req, res) => {
  const stats = stmts.pipelineStats.all();
  const deals = stmts.getAllDeals.all();
  const stages = ['lead', 'qualified', 'opportunity', 'proposal', 'closed_won'];
  const pipeline = stages.map(s => {
    const st = stats.find(x => x.stage === s) || { count: 0, total_value: 0 };
    return { stage: s, count: st.count, value: st.total_value || 0, deals: deals.filter(d => d.stage === s) };
  });
  const totalValue = pipeline.reduce((a, s) => a + s.value, 0);
  const weightedValue = pipeline.reduce((a, s) => {
    const weights = { lead: 0.1, qualified: 0.25, opportunity: 0.5, proposal: 0.75, closed_won: 1.0 };
    return a + s.value * (weights[s.stage] || 0);
  }, 0);
  
  // Cross-sell tracking
  const crossSell = [];
  for (const d of deals) {
    try {
      const products = JSON.parse(d.cross_sell_products || '[]');
      if (products.length > 1) crossSell.push({ company: d.company_name, products, value: d.value });
    } catch(e) {}
  }

  res.json({ pipeline, totalValue, weightedValue, crossSell, totalDeals: deals.length });
});

app.post('/api/crm/deals', (req, res) => {
  const d = {
    company_name: req.body.company_name || 'Unknown',
    contact_name: req.body.contact_name || '',
    stage: req.body.stage || 'lead',
    value: parseFloat(req.body.value) || 0,
    currency: req.body.currency || 'USD',
    owner: req.body.owner || '',
    source: req.body.source || 'manual',
    notes: req.body.notes || '',
    cross_sell_products: JSON.stringify(req.body.cross_sell_products || []),
    expected_close: req.body.expected_close || null,
    crm_id: req.body.crm_id || '',
  };
  const result = stmts.insertDeal.run(d);
  const deal = stmts.getDeal.get(result.lastInsertRowid);
  logActivity('create', 'deal', deal.id, `Deal created: ${deal.company_name}`, req.body.actor || 'user');
  broadcast('deal_created', deal);
  res.status(201).json(deal);
});

app.put('/api/crm/deals/:id', (req, res) => {
  const existing = stmts.getDeal.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const d = {
    id: parseInt(req.params.id),
    company_name: req.body.company_name ?? existing.company_name,
    contact_name: req.body.contact_name ?? existing.contact_name,
    stage: req.body.stage ?? existing.stage,
    value: req.body.value !== undefined ? parseFloat(req.body.value) : existing.value,
    currency: req.body.currency ?? existing.currency,
    owner: req.body.owner ?? existing.owner,
    source: req.body.source ?? existing.source,
    notes: req.body.notes ?? existing.notes,
    cross_sell_products: req.body.cross_sell_products ? JSON.stringify(req.body.cross_sell_products) : existing.cross_sell_products,
    expected_close: req.body.expected_close ?? existing.expected_close,
  };
  stmts.updateDeal.run(d);
  const deal = stmts.getDeal.get(req.params.id);
  logActivity('update', 'deal', deal.id, `Deal updated: ${deal.company_name}`, req.body.actor || 'user');
  broadcast('deal_updated', deal);
  res.json(deal);
});

app.patch('/api/crm/deals/:id/stage', (req, res) => {
  const existing = stmts.getDeal.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  stmts.updateDealStage.run({ id: parseInt(req.params.id), stage: req.body.stage });
  const deal = stmts.getDeal.get(req.params.id);
  logActivity('move', 'deal', deal.id, `Deal ${deal.company_name} moved to ${req.body.stage}`, req.body.actor || 'user');
  broadcast('deal_moved', deal);
  res.json(deal);
});

app.delete('/api/crm/deals/:id', (req, res) => {
  const existing = stmts.getDeal.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  stmts.deleteDeal.run(req.params.id);
  logActivity('delete', 'deal', parseInt(req.params.id), `Deal deleted: ${existing.company_name}`, 'user');
  broadcast('deal_deleted', { id: parseInt(req.params.id) });
  res.json({ ok: true });
});

// ─── Phase 3: Revenue Funnel API ────────────────────────────────
app.get('/api/funnel', (req, res) => {
  // Parse revenue data from dashboard.md for funnel visualization
  const raw = readMd('dashboard.md');
  const revenueData = {};
  const sections = ['Revenue Indicators', 'Product Health', 'Operational Efficiency', 'Growth Indicators'];
  for (const s of sections) {
    const lines = raw.split('\n');
    let found = false, inTable = false;
    const metrics = [];
    for (const line of lines) {
      if (line.includes(s)) { found = true; continue; }
      if (found && line.startsWith('### ') && !line.includes(s)) { found = false; continue; }
      if (found && line.includes('Metric') && line.includes('Current') && line.includes('Target')) { inTable = true; continue; }
      if (found && inTable && line.startsWith('|---')) continue;
      if (found && inTable && line.startsWith('|')) {
        const cols = line.split('|').map(c=>c.trim()).filter(Boolean);
        if (cols.length >= 4) metrics.push({ metric: cols[0], current: cols[1], target: cols[2], status: cols[3] });
      } else if (found && inTable && !line.startsWith('|')) inTable = false;
    }
    revenueData[s] = metrics;
  }

  // Build funnel stages from sales pipeline data
  const salesTasks = stmts.getTasksByDept.all('Sales & Business Dev');
  const funnel = {
    stages: [
      { name: 'Leads / Targets', count: 0, value: '' },
      { name: 'Contacted', count: 0, value: '' },
      { name: 'Qualified', count: 0, value: '' },
      { name: 'Proposal', count: 0, value: '' },
      { name: 'Closed Won', count: 0, value: '' },
    ],
    tasks: salesTasks,
    metrics: revenueData,
  };

  // Map tasks to stages by keywords
  for (const t of salesTasks) {
    const title = (t.title + ' ' + t.description).toLowerCase();
    if (/close|won|deal|revenue/.test(title)) funnel.stages[4].count++;
    else if (/proposal|quote|pricing/.test(title)) funnel.stages[3].count++;
    else if (/qualif|assess|discover/.test(title)) funnel.stages[2].count++;
    else if (/contact|outreach|reach|email|call/.test(title)) funnel.stages[1].count++;
    else funnel.stages[0].count++;
  }

  res.json(funnel);
});

// ─── Phase 3: Report Archive API ────────────────────────────────
app.get('/api/reports', (req, res) => {
  // Scan for report files in the MC directory
  const reports = [];
  const scanDirs = [MC_DIR, path.join(MC_DIR, 'reports'), path.join(MC_DIR, 'archive')];
  for (const dir of scanDirs) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.pdf') || f.endsWith('.html'));
      for (const f of files) {
        const stat = fs.statSync(path.join(dir, f));
        reports.push({
          name: f,
          path: path.relative(MC_DIR, path.join(dir, f)),
          size: stat.size,
          modified: stat.mtime.toISOString(),
          type: f.endsWith('.md') ? 'markdown' : f.endsWith('.pdf') ? 'pdf' : 'html',
        });
      }
    } catch(e) {}
  }
  reports.sort((a,b) => new Date(b.modified) - new Date(a.modified));
  res.json(reports);
});

app.get('/api/reports/:filename', (req, res) => {
  const filePath = path.join(MC_DIR, req.params.filename);
  if (!filePath.startsWith(MC_DIR)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ name: req.params.filename, content });
  } catch(e) {
    res.status(404).json({ error: 'Not found' });
  }
});

// ─── Phase 3: PDF Export ────────────────────────────────────────
app.get('/api/export/summary', (req, res) => {
  // Generate a text summary suitable for PDF conversion
  const tasks = stmts.getAllTasks.all();
  const actions = stmts.getOpenActions.all();
  const milestones = stmts.getAllMilestones.all();
  const kpis = stmts.getKPILatest.all();
  
  const byStatus = {};
  tasks.forEach(t => byStatus[t.status] = (byStatus[t.status]||0)+1);
  
  const summary = {
    generated: new Date().toISOString(),
    overview: {
      totalTasks: tasks.length,
      byStatus,
      blockers: tasks.filter(t=>t.is_blocker && t.status!=='done').length,
      openActions: actions.length,
    },
    milestones: milestones.map(m=>({ name:m.name, dept:m.department, date:m.target_date, status:m.status })),
    kpis: kpis.map(k=>({ dept:k.department, name:k.kpi_name, current:k.current_value, target:k.target, status:k.status })),
    actions: actions.map(a=>({ title:a.title, severity:a.severity, owner:a.owner, opened:a.opened_date })),
    tasksByDept: {},
  };
  
  const depts = [...new Set(tasks.map(t=>t.department))];
  for (const d of depts) {
    const dt = tasks.filter(t=>t.department===d);
    summary.tasksByDept[d] = { total: dt.length, done: dt.filter(t=>t.status==='done').length, inProgress: dt.filter(t=>t.status==='in_progress').length };
  }
  
  res.json(summary);
});

// ─── KPI Push API (for VPs) ─────────────────────────────────────
app.post('/api/kpis/push', (req, res) => {
  const { department, kpi_name, target, current_value, status, trend } = req.body;
  if (!department || !kpi_name) {
    return res.status(400).json({ error: 'department and kpi_name are required' });
  }
  const today = new Date().toISOString().split('T')[0];
  // Delete existing snapshot for this KPI today to allow updates
  db.prepare('DELETE FROM kpi_snapshots WHERE department = ? AND kpi_name = ? AND snapshot_date = ?').run(department, kpi_name, today);
  stmts.insertKPI.run({
    department: department,
    kpi_name: kpi_name,
    target: target || '',
    current_value: current_value || '',
    status: status || '',
    trend: trend || '—',
    snapshot_date: today,
  });
  updateSyncStatus('kpis', 'ok', `Push from ${department}: ${kpi_name}`);
  logActivity('push', 'kpi', null, `KPI pushed: ${department} / ${kpi_name} = ${current_value}`, department);
  broadcast('kpi_pushed', { department, kpi_name, current_value, status });
  res.json({ ok: true, department, kpi_name, current_value, snapshot_date: today });
});

// ─── Task Sync API (for VPs) ───────────────────────────────────
app.post('/api/tasks/sync', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const results = [];
  for (const item of items) {
    const { title, department, owner, status, priority } = item;
    if (!title) { results.push({ error: 'title required', item }); continue; }
    // Check if task exists by title + department
    const existing = db.prepare("SELECT id FROM tasks WHERE title = ? AND department = ?").get(title, department || 'Operations');
    if (existing) {
      // Update
      const updates = {};
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (owner) updates.owner = owner;
      if (Object.keys(updates).length > 0) {
        const sets = Object.entries(updates).map(([k, v]) => `${k}='${v}'`).join(', ');
        db.prepare(`UPDATE tasks SET ${sets}, updated_at=datetime('now') WHERE id=?`).run(existing.id);
      }
      results.push({ id: existing.id, action: 'updated', title });
    } else {
      // Insert
      const result = stmts.insertTask.run({
        title,
        description: item.description || '',
        department: department || 'Operations',
        owner: owner || '',
        priority: priority || 'medium',
        status: status || 'backlog',
        due_date: item.due_date || null,
        depends_on: '[]',
        is_blocker: item.is_blocker ? 1 : 0,
        blocker_note: '',
        milestone: '',
        position: 999,
        start_date: item.start_date || new Date().toISOString().split('T')[0],
        end_date: item.end_date || item.due_date || null,
        progress: item.progress || 0,
        is_milestone: item.is_milestone ? 1 : 0,
      });
      results.push({ id: result.lastInsertRowid, action: 'created', title });
    }
  }
  updateSyncStatus('tasks', 'ok', `VP sync: ${results.length} tasks processed`);
  logActivity('sync', 'tasks', null, `Task sync: ${results.length} items from VP report`, items[0]?.owner || 'vp');
  broadcast('tasks_synced', { count: results.length });
  res.json({ ok: true, results });
});

// ─── Sync Status API ───────────────────────────────────────────
app.get('/api/sync/status', (req, res) => {
  res.json(stmts.getAllSyncStatus.all());
});

app.post('/api/sync/all', async (req, res) => {
  try {
    const results = await syncAllSources();
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Posts (Social Calendar) API ─────────────────────────────────
app.get('/api/posts', (req, res) => {
  const { status, platform, from, to } = req.query;
  let posts;
  if (status) posts = stmts.getPostsByStatus.all(status);
  else if (platform) posts = stmts.getPostsByPlatform.all(platform);
  else posts = stmts.getAllPosts.all();
  if (from) posts = posts.filter(p => p.scheduled_at && p.scheduled_at >= from);
  if (to) posts = posts.filter(p => p.scheduled_at && p.scheduled_at <= to);
  // Add message counts
  const msgCounts = {};
  stmts.getPostMessageCount.all().forEach(r => { msgCounts[r.post_id] = r.count; });
  posts = posts.map(p => ({ ...p, message_count: msgCounts[p.id] || 0 }));
  res.json(posts);
});

app.post('/api/posts', (req, res) => {
  const p = {
    title: req.body.title || 'Untitled Post',
    content: req.body.content || '',
    platform: req.body.platform || 'x',
    scheduled_at: req.body.scheduled_at || null,
    status: req.body.status || 'draft',
    hashtags: req.body.hashtags || '',
    media_urls: JSON.stringify(req.body.media_urls || []),
    author: req.body.author || 'Max',
  };
  const result = stmts.insertPost.run(p);
  const post = stmts.getPost.get(result.lastInsertRowid);
  logActivity('create', 'post', post.id, `Post created: ${post.title}`, p.author);
  broadcast('post_created', post);
  res.status(201).json(post);
});

app.patch('/api/posts/:id', (req, res) => {
  const existing = stmts.getPost.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const p = {
    id: parseInt(req.params.id),
    title: req.body.title ?? existing.title,
    content: req.body.content ?? existing.content,
    platform: req.body.platform ?? existing.platform,
    scheduled_at: req.body.scheduled_at ?? existing.scheduled_at,
    status: req.body.status ?? existing.status,
    hashtags: req.body.hashtags ?? existing.hashtags,
    media_urls: req.body.media_urls ? JSON.stringify(req.body.media_urls) : existing.media_urls,
    decline_reason: req.body.decline_reason ?? existing.decline_reason,
  };
  stmts.updatePost.run(p);
  const post = stmts.getPost.get(req.params.id);
  logActivity('update', 'post', post.id, `Post updated: ${post.title}`, req.body.actor || 'user');
  broadcast('post_updated', post);
  res.json(post);
});

app.get('/api/posts/:id/messages', (req, res) => {
  res.json(stmts.getPostMessages.all(parseInt(req.params.id)));
});

app.post('/api/posts/:id/messages', (req, res) => {
  const postId = parseInt(req.params.id);
  const post = stmts.getPost.get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const sender = req.body.sender || 'David';
  const message = (req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });
  const result = stmts.insertPostMessage.run({ post_id: postId, sender, message });
  logActivity('message', 'post', postId, `${sender} commented on: ${post.title}`, sender);
  broadcast('post_message', { post_id: postId, sender, message, id: result.lastInsertRowid });
  res.status(201).json({ id: result.lastInsertRowid, post_id: postId, sender, message });
});

app.patch('/api/posts/:id/approve', (req, res) => {
  const id = parseInt(req.params.id);
  const post = stmts.getPost.get(id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  stmts.updatePostStatus.run({ id, status: 'approved' });
  stmts.insertPostMessage.run({ post_id: id, sender: req.body.sender || 'David', message: '✅ Approved for publishing' });
  logActivity('approve', 'post', id, `Post approved: ${post.title}`, req.body.sender || 'David');
  broadcast('post_approved', { id });
  res.json({ ok: true });
});

app.patch('/api/posts/:id/decline', (req, res) => {
  const id = parseInt(req.params.id);
  const post = stmts.getPost.get(id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const reason = req.body.reason || '';
  stmts.updatePost.run({ ...post, id, status: 'declined', decline_reason: reason, title: post.title, content: post.content, platform: post.platform, scheduled_at: post.scheduled_at, hashtags: post.hashtags, media_urls: post.media_urls });
  stmts.insertPostMessage.run({ post_id: id, sender: req.body.sender || 'David', message: `❌ Declined${reason ? ': ' + reason : ''}` });
  logActivity('decline', 'post', id, `Post declined: ${post.title}`, req.body.sender || 'David');
  broadcast('post_declined', { id });
  res.json({ ok: true });
});

// ─── Organization / Agent Status API ────────────────────────────
const WAKE_DIR = path.join(MC_DIR, 'wake-queue');
try { fs.mkdirSync(WAKE_DIR, { recursive: true }); } catch(e) {}

function buildOrgTree() {
  const agents = stmts.getAllAgents.all();
  const map = {};
  agents.forEach(a => { map[a.agent_id] = { ...a, capabilities: JSON.parse(a.capabilities || '[]'), children: [] }; });
  const roots = [];
  agents.forEach(a => {
    if (a.reports_to && map[a.reports_to]) map[a.reports_to].children.push(map[a.agent_id]);
    else roots.push(map[a.agent_id]);
  });
  return roots;
}

app.get('/api/org', (req, res) => {
  res.json(buildOrgTree());
});

app.get('/api/org/agents', (req, res) => {
  const agents = stmts.getAllAgents.all().map(a => ({ ...a, capabilities: JSON.parse(a.capabilities || '[]') }));
  res.json(agents);
});

app.get('/api/org/agents/:id', (req, res) => {
  const agent = stmts.getAgent.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  agent.capabilities = JSON.parse(agent.capabilities || '[]');
  const activity = stmts.getAgentActivity.all(req.params.id, 10);
  res.json({ ...agent, recent_activity: activity });
});

app.patch('/api/org/agents/:id/status', (req, res) => {
  const agent = stmts.getAgent.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const updates = {
    agent_id: req.params.id,
    status: req.body.status ?? agent.status,
    current_task: req.body.current_task ?? agent.current_task,
    last_task: req.body.last_task ?? agent.last_task,
    last_active_at: req.body.last_active_at ?? agent.last_active_at,
    next_wake_at: req.body.next_wake_at ?? agent.next_wake_at,
  };
  stmts.updateAgentStatus.run(updates);
  // Log activity if task changed
  if (req.body.current_task && req.body.status === 'active') {
    stmts.insertAgentActivity.run({ agent_id: req.params.id, task: req.body.current_task, status: 'started', started_at: new Date().toISOString() });
  }
  if (req.body.last_task && req.body.status === 'sleeping') {
    stmts.insertAgentActivity.run({ agent_id: req.params.id, task: req.body.last_task, status: 'completed', started_at: req.body.last_active_at || new Date().toISOString() });
  }
  const updated = stmts.getAgent.get(req.params.id);
  updated.capabilities = JSON.parse(updated.capabilities || '[]');
  broadcast('agent_status', updated);
  res.json(updated);
});

// Batch update agent statuses
app.post('/api/org/agents/batch-status', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const results = [];
  for (const item of items) {
    const agent = stmts.getAgent.get(item.agent_id);
    if (!agent) { results.push({ agent_id: item.agent_id, error: 'not found' }); continue; }
    stmts.updateAgentStatus.run({
      agent_id: item.agent_id,
      status: item.status ?? agent.status,
      current_task: item.current_task ?? agent.current_task,
      last_task: item.last_task ?? agent.last_task,
      last_active_at: item.last_active_at ?? agent.last_active_at,
      next_wake_at: item.next_wake_at ?? agent.next_wake_at,
    });
    // Log activity on status transitions
    if (item.current_task && item.status === 'active' && item.current_task !== agent.current_task) {
      stmts.insertAgentActivity.run({ agent_id: item.agent_id, task: item.current_task, status: 'started', started_at: new Date().toISOString() });
    }
    if (item.last_task && item.status === 'sleeping' && item.last_task !== agent.last_task) {
      stmts.insertAgentActivity.run({ agent_id: item.agent_id, task: item.last_task, status: 'completed', started_at: item.last_active_at || new Date().toISOString() });
    }
    results.push({ agent_id: item.agent_id, ok: true });
  }
  broadcast('agents_batch_status', results);
  res.json({ ok: true, results });
});

app.post('/api/org/agents/:id/wake', (req, res) => {
  const agent = stmts.getAgent.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const payload = {
    agent_id: req.params.id,
    requested_by: req.body.requested_by || 'David',
    message: req.body.message || '',
    requested_at: new Date().toISOString(),
  };
  const filename = `wake-${req.params.id}-${Date.now()}.json`;
  fs.writeFileSync(path.join(WAKE_DIR, filename), JSON.stringify(payload, null, 2));
  logActivity('wake', 'agent', null, `Wake request for ${agent.name}: ${payload.message}`, payload.requested_by);
  broadcast('agent_wake', payload);
  res.json({ ok: true, ...payload });
});

// ─── Token Usage API ───────────────────────────────────────────
// GET /api/org/token-usage - Get all token usage (with optional date range filters)
app.get('/api/org/token-usage', (req, res) => {
  const { start_date, end_date, agent_id } = req.query;
  let usage;
  
  if (agent_id) {
    usage = stmts.getTokenUsageByAgent.all(agent_id);
  } else {
    usage = stmts.getAllTokenUsage.all();
  }
  
  // Apply date range filters
  if (start_date || end_date) {
    usage = usage.filter(u => {
      if (start_date && u.date < start_date) return false;
      if (end_date && u.date > end_date) return false;
      return true;
    });
  }
  
  res.json(usage);
});

// GET /api/org/agents/:id/token-usage - Get token usage for specific agent
app.get('/api/org/agents/:id/token-usage', (req, res) => {
  const { start_date, end_date } = req.query;
  const agentId = req.params.id;
  
  // Verify agent exists
  const agent = stmts.getAgent.get(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  let usage = stmts.getTokenUsageByAgent.all(agentId);
  
  // Apply date range filters
  if (start_date || end_date) {
    usage = usage.filter(u => {
      if (start_date && u.date < start_date) return false;
      if (end_date && u.date > end_date) return false;
      return true;
    });
  }
  
  // Get summary stats for this agent
  const summary = stmts.getTokenUsageSummary.all().find(s => s.agent_id === agentId);
  
  res.json({
    agent_id: agentId,
    agent_name: agent.name,
    usage,
    summary: summary || { agent_id: agentId, total_input: 0, total_output: 0, total_cost: 0 }
  });
});

// POST /api/org/agents/:id/token-usage - Record token usage for an agent
app.post('/api/org/agents/:id/token-usage', (req, res) => {
  const agentId = req.params.id;
  
  // Verify agent exists
  const agent = stmts.getAgent.get(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  const tu = {
    agent_id: agentId,
    session_key: req.body.session_key || `session-${Date.now()}`,
    model: req.body.model || agent.model || 'unknown',
    provider: req.body.provider || 'unknown',
    input_tokens: parseInt(req.body.input_tokens) || 0,
    output_tokens: parseInt(req.body.output_tokens) || 0,
    total_tokens: parseInt(req.body.total_tokens) || (parseInt(req.body.input_tokens) || 0) + (parseInt(req.body.output_tokens) || 0),
    cost_usd: parseFloat(req.body.cost_usd) || 0,
    task_type: req.body.task_type || null,
    date: req.body.date || new Date().toISOString().split('T')[0],
  };
  
  const result = stmts.insertTokenUsage.run(tu);
  
  logActivity('create', 'token_usage', result.lastInsertRowid, 
    `Token usage recorded for ${agent.name}: ${tu.input_tokens} in / ${tu.output_tokens} out / $${tu.cost_usd}`, 
    'system');
  
  broadcast('token_usage_created', { id: result.lastInsertRowid, agent_id: agentId, ...tu });
  
  res.status(201).json({ id: result.lastInsertRowid, agent_id: agentId, ...tu });
});

// GET /api/org/token-usage/by-provider - Get token usage aggregated by provider (US-003)
app.get('/api/org/token-usage/by-provider', (req, res) => {
  const { start_date, end_date, agent_id } = req.query;
  
  // Get provider-aggregated data from database
  const providerData = stmts.getTokenUsageByProvider.all(
    agent_id || null, agent_id || null,
    start_date || null, start_date || null,
    end_date || null, end_date || null
  );
  
  // Calculate total for percentage calculations
  const totalCost = providerData.reduce((sum, p) => sum + (p.total_cost_usd || 0), 0);
  
  // Default token limits by provider (in USD) - could be moved to config
  const PROVIDER_LIMITS = {
    'anthropic': 50000,    // Claude API limit
    'openai': 50000,       // OpenAI API limit
    'google': 50000,      // Google AI API limit
    'groq': 10000,         // Groq API limit
  };
  
  // Format response with usage percentage
  const response = providerData.map(p => {
    const providerKey = p.provider?.toLowerCase() || 'unknown';
    const limit = PROVIDER_LIMITS[providerKey] || 10000; // default limit
    
    return {
      provider: p.provider || 'unknown',
      total_input_tokens: p.total_input_tokens || 0,
      total_output_tokens: p.total_output_tokens || 0,
      total_tokens: p.total_tokens || 0,
      total_cost_usd: p.total_cost_usd || 0,
      limit: limit,
      usage_percentage: limit > 0 ? Math.round((p.total_cost_usd / limit) * 10000) / 100 : 0,
    };
  });
  
  res.json(response);
});

// GET /api/org/token-usage/today - Get today's token usage by agent (US-006)
app.get('/api/org/token-usage/today', (req, res) => {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Get all token usage for today, grouped by agent
  const usage = stmts.getTodaysTokenUsageByAgent.all(today);
  
  // Convert to a map for easy lookup
  const usageMap = {};
  usage.forEach(u => {
    usageMap[u.agent_id] = {
      total_input: u.total_input || 0,
      total_output: u.total_output || 0,
      total_tokens: u.total_tokens || 0,
      total_cost: u.total_cost || 0
    };
  });
  
  res.json(usageMap);
});

// GET /api/org/token-usage/history - Get 7-day historical token usage (US-008)
app.get('/api/org/token-usage/history', (req, res) => {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Get all token usage for the last 7 days, grouped by date
  const usage = stmts.getDailyTokenUsage.all();
  
  // Filter to last 7 days and ensure we have all dates (fill in missing with zeros)
  const usageMap = {};
  usage.forEach(u => {
    usageMap[u.date] = {
      date: u.date,
      input_tokens: u.total_input || 0,
      output_tokens: u.total_output || 0,
      total_tokens: (u.total_input || 0) + (u.total_output || 0),
      cost_usd: u.total_cost || 0
    };
  });
  
  // Build array with all 7 days, filling missing dates with zeros
  const history = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    history.push(usageMap[dateStr] || {
      date: dateStr,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_usd: 0
    });
  }
  
  // Calculate trend (compare first half average to second half average)
  const firstHalf = history.slice(0, 3).reduce((sum, d) => sum + d.cost_usd, 0) / 3;
  const secondHalf = history.slice(4).reduce((sum, d) => sum + d.cost_usd, 0) / 3;
  let trend = 'stable';
  if (secondHalf > firstHalf * 1.1) trend = 'up';
  else if (secondHalf < firstHalf * 0.9) trend = 'down';
  
  res.json({
    history,
    trend,
    total_cost: history.reduce((sum, d) => sum + d.cost_usd, 0)
  });
});

// ─── Fleet Management API ───────────────────────────────────────
app.get('/api/config/models', (req, res) => {
  // Hardcoded list as requested
  const models = [
    { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic' },
    { id: 'openai-codex/gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI' },
    { id: 'google-antigravity/gemini-3-pro-high', name: 'Gemini 3 Pro High', provider: 'Google' },
    { id: 'google-antigravity/gemini-3-flash', name: 'Gemini 3 Flash', provider: 'Google' },
    { id: 'anthropic/claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
    { id: 'openai-codex/gpt-5.2-mini', name: 'GPT-5.2 Mini', provider: 'OpenAI' }
  ];
  res.json(models);
});

// ─── Token Rates Config API (US-009) ────────────────────────────
app.get('/api/config/token-rates', (req, res) => {
  // GET /api/config/token-rates - Get current rates
  const rates = stmts.getAllTokenRates.all();
  res.json(rates);
});

app.put('/api/config/token-rates', (req, res) => {
  // PUT /api/config/token-rates - Update rates
  const { rates } = req.body;
  
  if (!Array.isArray(rates)) {
    return res.status(400).json({ error: 'Invalid payload, expected { rates: [...] }' });
  }

  const updateTx = db.transaction(() => {
    for (const rate of rates) {
      if (!rate.provider) {
        throw new Error('provider is required');
      }
      // Check if exists
      const existing = stmts.getTokenRateByProvider.get(rate.provider);
      if (existing) {
        stmts.updateTokenRate.run({
          provider: rate.provider,
          input_cost_per_1m: rate.input_cost_per_1m ?? existing.input_cost_per_1m,
          output_cost_per_1m: rate.output_cost_per_1m ?? existing.output_cost_per_1m,
          rate_limit: rate.rate_limit ?? existing.rate_limit,
        });
      }
    }
  });

  try {
    updateTx();
    const updatedRates = stmts.getAllTokenRates.all();
    res.json(updatedRates);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/org/update-models', (req, res) => {
  const updates = req.body; // Expects array: [{ agentId, model }, ...]
  
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Invalid payload, expected array' });
  }

  const OPENCLAW_CONFIG_PATH = '/root/.openclaw/openclaw.json';
  
  try {
    const data = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8');
    const config = JSON.parse(data);
    
    let changesCount = 0;
    updates.forEach(update => {
      const agent = config.agents.list.find(a => a.id === update.agentId);
      if (agent) {
        if (agent.model !== update.model) {
          agent.model = update.model;
          changesCount++;
        }
      }
    });

    if (changesCount > 0) {
      fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
      logActivity('update', 'fleet', null, `Updated ${changesCount} agents models. Restarting...`, 'David');
      
      // Execute system restart as requested
      const { exec } = require('child_process');
      exec('openclaw gateway restart', (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
        }
      });

      res.json({ success: true, message: `Updated ${changesCount} agents and triggered restart.` });
    } else {
      res.json({ success: true, message: 'No changes needed.' });
    }
  } catch (err) {
    console.error('Error updating config:', err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// ─── Visual Requests API ────────────────────────────────────────
app.get('/api/visual-requests', (req, res) => {
  const { status } = req.query;
  let requests = status ? stmts.getVisualRequestsByStatus.all(status) : stmts.getAllVisualRequests.all();
  const msgCounts = {};
  stmts.getVisualRequestMessageCount.all().forEach(r => { msgCounts[r.request_id] = r.count; });
  requests = requests.map(r => ({ ...r, message_count: msgCounts[r.id] || 0 }));
  res.json(requests);
});

app.get('/api/visual-requests/:id', (req, res) => {
  const vr = stmts.getVisualRequest.get(parseInt(req.params.id));
  if (!vr) return res.status(404).json({ error: 'Not found' });
  res.json(vr);
});

app.post('/api/visual-requests', (req, res) => {
  const vr = {
    title: req.body.title || 'Untitled Request',
    description: req.body.description || '',
    status: req.body.status || 'pending',
    requesting_agent: req.body.requesting_agent || '',
    department: req.body.department || '',
    associated_post_id: req.body.associated_post_id || null,
    drive_file_id: req.body.drive_file_id || '',
    drive_url: req.body.drive_url || '',
    reference_specs: req.body.reference_specs || '',
    deadline: req.body.deadline || null,
  };
  const result = stmts.insertVisualRequest.run(vr);
  const created = stmts.getVisualRequest.get(result.lastInsertRowid);
  // Auto-add description as first message
  if (vr.description) {
    stmts.insertVisualRequestMessage.run({ request_id: result.lastInsertRowid, sender: vr.requesting_agent || 'System', message: vr.description });
  }
  logActivity('create', 'visual_request', created.id, `Visual request created: ${created.title}`, vr.requesting_agent || 'user');
  broadcast('visual_request_created', created);
  res.status(201).json(created);
});

app.patch('/api/visual-requests/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = stmts.getVisualRequest.get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const vr = {
    id,
    title: req.body.title ?? existing.title,
    description: req.body.description ?? existing.description,
    status: req.body.status ?? existing.status,
    requesting_agent: req.body.requesting_agent ?? existing.requesting_agent,
    department: req.body.department ?? existing.department,
    associated_post_id: req.body.associated_post_id ?? existing.associated_post_id,
    drive_file_id: req.body.drive_file_id ?? existing.drive_file_id,
    drive_url: req.body.drive_url ?? existing.drive_url,
    reference_specs: req.body.reference_specs ?? existing.reference_specs,
    deadline: req.body.deadline ?? existing.deadline,
  };
  stmts.updateVisualRequest.run(vr);
  const updated = stmts.getVisualRequest.get(id);
  logActivity('update', 'visual_request', id, `Visual request updated: ${updated.title}`, req.body.actor || 'user');
  broadcast('visual_request_updated', updated);
  res.json(updated);
});

app.patch('/api/visual-requests/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = stmts.getVisualRequest.get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  if (!['pending', 'in_progress', 'done', 'changes_requested'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  stmts.updateVisualRequestStatus.run({ id, status });
  const statusLabels = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', changes_requested: 'Changes Requested' };
  stmts.insertVisualRequestMessage.run({ request_id: id, sender: req.body.sender || 'David', message: `🔄 Status changed to ${statusLabels[status]}` });
  logActivity('status', 'visual_request', id, `Visual request ${existing.title} → ${status}`, req.body.sender || 'David');
  broadcast('visual_request_updated', { id, status });
  res.json({ ok: true });
});

app.patch('/api/visual-requests/:id/done', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = stmts.getVisualRequest.get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  stmts.markVisualRequestDone.run({ id, drive_file_id: req.body.drive_file_id || '', drive_url: req.body.drive_url || '' });
  const driveInfo = req.body.drive_url ? ` — [Drive](${req.body.drive_url})` : '';
  stmts.insertVisualRequestMessage.run({ request_id: id, sender: 'David', message: `✅ Marked as Done${driveInfo}` });
  logActivity('done', 'visual_request', id, `Visual request completed: ${existing.title}`, 'David');
  
  // If linked to a social post, update the post's media_urls with the drive URL
  if (existing.associated_post_id && req.body.drive_url) {
    const post = stmts.getPost.get(existing.associated_post_id);
    if (post) {
      let mediaUrls = [];
      try { mediaUrls = JSON.parse(post.media_urls || '[]'); } catch(e) {}
      mediaUrls.push(req.body.drive_url);
      stmts.updatePost.run({ ...post, id: post.id, media_urls: JSON.stringify(mediaUrls) });
      broadcast('post_updated', { id: post.id });
    }
  }
  
  // Wake queue notification for requesting agent
  if (existing.requesting_agent) {
    const agentId = existing.requesting_agent.toLowerCase().split(' ')[0];
    const payload = {
      agent_id: agentId,
      requested_by: 'David',
      message: `Visual request "${existing.title}" is done! ${req.body.drive_url ? 'Drive: ' + req.body.drive_url : ''}`,
      requested_at: new Date().toISOString(),
    };
    const filename = `wake-${agentId}-vr${id}-${Date.now()}.json`;
    try { fs.writeFileSync(path.join(WAKE_DIR, filename), JSON.stringify(payload, null, 2)); } catch(e) {}
  }
  
  broadcast('visual_request_done', { id, drive_url: req.body.drive_url });
  res.json({ ok: true });
});

app.get('/api/visual-requests/:id/messages', (req, res) => {
  res.json(stmts.getVisualRequestMessages.all(parseInt(req.params.id)));
});

app.post('/api/visual-requests/:id/messages', (req, res) => {
  const reqId = parseInt(req.params.id);
  const vr = stmts.getVisualRequest.get(reqId);
  if (!vr) return res.status(404).json({ error: 'Not found' });
  const sender = req.body.sender || 'David';
  const message = (req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });
  const result = stmts.insertVisualRequestMessage.run({ request_id: reqId, sender, message });
  logActivity('message', 'visual_request', reqId, `${sender} commented on: ${vr.title}`, sender);
  broadcast('visual_request_message', { request_id: reqId, sender, message, id: result.lastInsertRowid });
  res.status(201).json({ id: result.lastInsertRowid, request_id: reqId, sender, message });
});

// ─── Research Requests API ──────────────────────────────────────
app.get('/api/research-requests', (req, res) => {
  const { status } = req.query;
  let requests = status ? stmts.getResearchRequestsByStatus.all(status) : stmts.getAllResearchRequests.all();
  const msgCounts = {};
  stmts.getResearchRequestMessageCount.all().forEach(r => { msgCounts[r.request_id] = r.count; });
  requests = requests.map(r => ({ ...r, message_count: msgCounts[r.id] || 0 }));
  res.json(requests);
});

app.get('/api/research-requests/:id', (req, res) => {
  const rr = stmts.getResearchRequest.get(parseInt(req.params.id));
  if (!rr) return res.status(404).json({ error: 'Not found' });
  res.json(rr);
});

app.post('/api/research-requests', (req, res) => {
  const rr = {
    title: req.body.title || 'Untitled Research Request',
    description: req.body.description || '',
    status: req.body.status || 'pending',
    requesting_agent: req.body.requesting_agent || '',
    department: req.body.department || '',
    priority: req.body.priority || 'normal',
    drive_file_id: req.body.drive_file_id || '',
    drive_url: req.body.drive_url || '',
    context: req.body.context || '',
    deadline: req.body.deadline || null,
  };
  const result = stmts.insertResearchRequest.run(rr);
  const created = stmts.getResearchRequest.get(result.lastInsertRowid);
  if (rr.description) {
    stmts.insertResearchRequestMessage.run({ request_id: result.lastInsertRowid, sender: rr.requesting_agent || 'System', message: rr.description });
  }
  if (rr.context) {
    stmts.insertResearchRequestMessage.run({ request_id: result.lastInsertRowid, sender: rr.requesting_agent || 'System', message: `📋 Context: ${rr.context}` });
  }
  logActivity('create', 'research_request', created.id, `Research request created: ${created.title}`, rr.requesting_agent || 'user');
  broadcast('research_request_created', created);
  res.status(201).json(created);
});

app.patch('/api/research-requests/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = stmts.getResearchRequest.get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const rr = {
    id,
    title: req.body.title ?? existing.title,
    description: req.body.description ?? existing.description,
    status: req.body.status ?? existing.status,
    requesting_agent: req.body.requesting_agent ?? existing.requesting_agent,
    department: req.body.department ?? existing.department,
    priority: req.body.priority ?? existing.priority,
    drive_file_id: req.body.drive_file_id ?? existing.drive_file_id,
    drive_url: req.body.drive_url ?? existing.drive_url,
    context: req.body.context ?? existing.context,
    deadline: req.body.deadline ?? existing.deadline,
  };
  stmts.updateResearchRequest.run(rr);
  const updated = stmts.getResearchRequest.get(id);
  logActivity('update', 'research_request', id, `Research request updated: ${updated.title}`, req.body.actor || 'user');
  broadcast('research_request_updated', updated);
  res.json(updated);
});

app.patch('/api/research-requests/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = stmts.getResearchRequest.get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  if (!['pending', 'in_progress', 'done', 'changes_requested'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  stmts.updateResearchRequestStatus.run({ id, status });
  const statusLabels = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', changes_requested: 'Changes Requested' };
  stmts.insertResearchRequestMessage.run({ request_id: id, sender: req.body.sender || 'David', message: `🔄 Status changed to ${statusLabels[status]}` });
  logActivity('status', 'research_request', id, `Research request ${existing.title} → ${status}`, req.body.sender || 'David');
  broadcast('research_request_updated', { id, status });
  res.json({ ok: true });
});

app.patch('/api/research-requests/:id/done', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = stmts.getResearchRequest.get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  stmts.markResearchRequestDone.run({ id, drive_file_id: req.body.drive_file_id || '', drive_url: req.body.drive_url || '' });
  const driveInfo = req.body.drive_url ? ` — [Drive](${req.body.drive_url})` : '';
  stmts.insertResearchRequestMessage.run({ request_id: id, sender: 'David', message: `✅ Research completed${driveInfo}\n📁 Filed to: Research & Intelligence / Deep Research Requests / Completed` });
  logActivity('done', 'research_request', id, `Research request completed: ${existing.title}`, 'David');
  
  // Wake queue notification for requesting agent
  if (existing.requesting_agent) {
    const agentId = existing.requesting_agent.toLowerCase().split(' ')[0];
    const payload = {
      agent_id: agentId,
      requested_by: 'David',
      message: `Research request "${existing.title}" is done! ${req.body.drive_url ? 'Drive: ' + req.body.drive_url : ''} Filed to: Research & Intelligence / Deep Research Requests / Completed`,
      requested_at: new Date().toISOString(),
    };
    const filename = `wake-${agentId}-rr${id}-${Date.now()}.json`;
    try { fs.writeFileSync(path.join(WAKE_DIR, filename), JSON.stringify(payload, null, 2)); } catch(e) {}
  }
  
  broadcast('research_request_done', { id, drive_url: req.body.drive_url });
  res.json({ ok: true });
});

app.get('/api/research-requests/:id/messages', (req, res) => {
  res.json(stmts.getResearchRequestMessages.all(parseInt(req.params.id)));
});

app.post('/api/research-requests/:id/messages', (req, res) => {
  const reqId = parseInt(req.params.id);
  const rr = stmts.getResearchRequest.get(reqId);
  if (!rr) return res.status(404).json({ error: 'Not found' });
  const sender = req.body.sender || 'David';
  const message = (req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });
  const result = stmts.insertResearchRequestMessage.run({ request_id: reqId, sender, message });
  logActivity('message', 'research_request', reqId, `${sender} commented on: ${rr.title}`, sender);
  broadcast('research_request_message', { request_id: reqId, sender, message, id: result.lastInsertRowid });
  res.status(201).json({ id: result.lastInsertRowid, request_id: reqId, sender, message });
});

// ─── SPA Route Handler ──────────────────────────────────────────
// Serve index.html for all non-API routes (SPA routing)
const serveIndexHtml = (req, res) => {
  const fs = require('fs');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  res.send(html);
};

app.get('/dashboard', serveIndexHtml);
app.get('/kanban', serveIndexHtml);
app.get('/actions', serveIndexHtml);
app.get('/actions/:id', serveIndexHtml);
app.get('/gantt', serveIndexHtml);
app.get('/timeline', serveIndexHtml);
app.get('/calendar', serveIndexHtml);
app.get('/org', serveIndexHtml);
app.get('/sync', serveIndexHtml);
app.get('/crm', serveIndexHtml);
app.get('/visual-requests', serveIndexHtml);
app.get('/research-requests', serveIndexHtml);

// ─── Sync & Start ───────────────────────────────────────────────
syncAll();

// Initial Twenty CRM sync
twentyInitialSync().then(() => {
  updateSyncStatus('crm', 'ok', 'Initial CRM sync');
}).catch(e => {
  updateSyncStatus('crm', 'error', e.message);
});

// Start the comprehensive scheduler
startScheduler({ syncFromTwenty: syncFromTwenty, broadcast });

server.listen(3000, '0.0.0.0', () => {
  log.info('Mission Control v2 running on port 3000');
});
