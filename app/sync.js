/**
 * Sync markdown data sources into SQLite.
 * Reads dashboard.md, blockers.md, corporate-setup-todo.md and upserts into DB.
 */
const fs = require('fs');
const path = require('path');
const { db, stmts, logActivity } = require('./db');

const MC_DIR = path.join(__dirname, '..');

function readMd(relPath) {
  try { return fs.readFileSync(path.join(MC_DIR, relPath), 'utf8'); }
  catch { return ''; }
}

// Parse KPIs from dashboard.md and snapshot them
function syncKPIs() {
  const raw = readMd('dashboard.md');
  const today = new Date().toISOString().split('T')[0];
  
  // Check if we already have a snapshot for today
  const existing = db.prepare('SELECT COUNT(*) as c FROM kpi_snapshots WHERE snapshot_date = ?').get(today);
  if (existing.c > 0) return; // Already synced today

  const deptSections = [
    { marker: 'Research & Intelligence', dept: 'Research & Intelligence' },
    { marker: 'Marketing & Content', dept: 'Marketing & Content' },
    { marker: 'Sales & Business Dev', dept: 'Sales & Business Dev' },
    { marker: 'Engineering & Product', dept: 'Engineering & Product' },
  ];

  const lines = raw.split('\n');
  
  for (const section of deptSections) {
    let inSection = false, inTable = false;
    for (const line of lines) {
      if (line.includes(`### ${section.marker}`) || (line.includes(section.marker) && line.includes('###'))) {
        inSection = true; inTable = false; continue;
      }
      if (inSection && line.startsWith('### ') && !line.includes(section.marker)) { inSection = false; continue; }
      if (inSection && line.includes('KPI') && line.includes('Target') && line.includes('Status')) { inTable = true; continue; }
      if (inSection && inTable && line.startsWith('|---')) continue;
      if (inSection && inTable && line.startsWith('|')) {
        const cols = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 4) {
          stmts.insertKPI.run({
            department: section.dept,
            kpi_name: cols[0],
            target: cols[1],
            current_value: cols[2],
            status: cols[3],
            trend: cols[4] || '—',
            snapshot_date: today,
          });
        }
      } else if (inSection && inTable && !line.startsWith('|')) inTable = false;
    }
  }
  logActivity('sync', 'kpi', null, 'KPI snapshot synced from dashboard.md');
}

// Parse blockers.md into action_items (if not already imported)
function syncBlockers() {
  const raw = readMd('blockers.md');
  if (!raw) return;
  
  const existing = db.prepare('SELECT COUNT(*) as c FROM action_items').get();
  if (existing.c > 0) return; // Don't re-import

  const lines = raw.split('\n');
  let severity = 'yellow';
  let current = null;

  for (const line of lines) {
    if (line.includes('Critical (Red)') || line.includes('🔴 Critical')) { severity = 'red'; continue; }
    if (line.includes('High (Yellow)') || line.includes('🟡 High')) { severity = 'yellow'; continue; }
    if (line.includes('Medium (Blue)') || line.includes('🔵 Medium')) { severity = 'blue'; continue; }
    
    const titleMatch = line.match(/^####\s+(?:B\d+:\s+)?(.+)/);
    if (titleMatch) {
      if (current) {
        stmts.insertAction.run(current);
      }
      current = {
        title: titleMatch[1].trim(),
        description: '',
        owner: 'David',
        requester: '',
        severity,
        status: 'open',
        notes: '',
        opened_date: '2026-02-16',
      };
      continue;
    }
    
    if (current && line.match(/^\s*-\s+\*\*(.+?):\*\*\s*(.*)/)) {
      const [, key, val] = line.match(/^\s*-\s+\*\*(.+?):\*\*\s*(.*)/);
      if (key === 'Department') current.requester = val;
      if (key === 'Owner') current.owner = val;
      if (key === 'Status' && val.includes('Resolved')) current.status = 'resolved';
      current.description += `${key}: ${val}\n`;
    }
  }
  if (current) stmts.insertAction.run(current);
  logActivity('sync', 'action_items', null, 'Blockers synced from blockers.md');
}

// Parse corporate-setup-todo.md into action_items
function syncTodos(force) {
  const raw = readMd('corporate-setup-todo.md');
  if (!raw) return;

  if (!force) {
    const existing = db.prepare("SELECT COUNT(*) as c FROM action_items WHERE requester LIKE '%todo%'").get();
    if (existing.c > 0) return;
  }

  const lines = raw.split('\n');
  let severity = 'yellow';
  let current = null;

  for (const line of lines) {
    if (line.includes('🔴 Blocking Revenue')) { severity = 'red'; continue; }
    if (line.includes('🟡 Blocking Progress')) { severity = 'yellow'; continue; }
    if (line.includes('🔵 Decisions Pending')) { severity = 'blue'; continue; }
    
    const titleMatch = line.match(/^###\s+\d+\.\s+(.+)/);
    if (titleMatch) {
      if (current) stmts.insertAction.run(current);
      current = {
        title: titleMatch[1].trim(),
        description: '',
        owner: 'David',
        requester: 'todo-sync',
        severity,
        status: 'open',
        notes: '',
        opened_date: '2026-02-17',
      };
      continue;
    }

    if (current && line.match(/^\s*-\s+\*\*(.+?):\*\*\s*(.*)/)) {
      const [, key, val] = line.match(/^\s*-\s+\*\*(.+?):\*\*\s*(.*)/);
      if (key === 'Who needs it') current.requester = val + ' (todo-sync)';
      current.description += `${key}: ${val}\n`;
    }
  }
  if (current) stmts.insertAction.run(current);
  logActivity('sync', 'action_items', null, 'Action items synced from corporate-setup-todo.md');
}

// Seed some initial tasks from dashboard priorities if tasks table is empty
function seedTasks() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM tasks').get();
  if (existing.c > 0) return;

  const raw = readMd('dashboard.md');
  const lines = raw.split('\n');
  let inPri = false, category = '', pos = 0;

  const deptMap = {
    'Week 1': 'Operations',
    'Week 2': 'Operations',
    'Foundation': 'Engineering & Product',
    'Growth': 'Sales & Business Dev',
    'Revenue': 'Sales & Business Dev',
    'Content': 'Marketing & Content',
    'Research': 'Research & Intelligence',
  };

  for (const line of lines) {
    if (line.includes('Top Priorities')) { inPri = true; continue; }
    if (inPri && line.startsWith('## ') && !line.includes('Top Priorities')) { inPri = false; continue; }
    if (inPri && line.startsWith('### ')) {
      category = line.replace(/^###\s*/, '').trim();
      continue;
    }
    if (inPri && /^\d+\.\s+/.test(line)) {
      const title = line.replace(/^\d+\.\s+/, '').replace(/\*\*/g, '').trim();
      const dept = Object.entries(deptMap).find(([k]) => category.includes(k))?.[1] || 'Operations';
      stmts.insertTask.run({
        title,
        description: `From: ${category}`,
        department: dept,
        owner: '',
        priority: 'high',
        status: 'in_progress',
        due_date: null,
        depends_on: '[]',
        is_blocker: 0,
        blocker_note: '',
        milestone: '',
        position: pos++,
      });
    }
  }

  // Seed milestones
  const milestones = [
    { name: 'CDN Launch', department: 'Engineering & Product', target_date: '2026-06-01', status: 'pending', description: 'CDN product MVP launch' },
    { name: 'First Content Published', department: 'Marketing & Content', target_date: '2026-03-15', status: 'pending', description: 'First SEO-optimized blog post live' },
    { name: 'CRM Fully Loaded', department: 'Sales & Business Dev', target_date: '2026-03-01', status: 'in_progress', description: 'All customer data imported into Twenty CRM' },
    { name: 'First MQL Generated', department: 'Marketing & Content', target_date: '2026-04-01', status: 'pending', description: 'First marketing qualified lead from inbound' },
    { name: 'Mission Control v2', department: 'Engineering & Product', target_date: '2026-03-01', status: 'in_progress', description: 'Full dashboard rebuild with Kanban, Gantt, KPI tracking' },
  ];
  for (const m of milestones) {
    stmts.insertMilestone.run(m);
  }

  logActivity('sync', 'tasks', null, 'Initial tasks and milestones seeded from dashboard.md');
}

function seedCRMPipeline() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM crm_pipeline').get();
  if (existing.c > 0) return;

  const deals = [
    { company_name: 'SportStream GmbH', contact_name: 'Hans Mueller', stage: 'closed_won', value: 48000, owner: 'Zara', source: 'inbound', cross_sell_products: '["CDN","Live Encoding"]', expected_close: '2026-02-01', notes: 'Multi-year contract signed' },
    { company_name: 'MediaFlow Inc', contact_name: 'Sarah Chen', stage: 'proposal', value: 72000, owner: 'Zara', source: 'referral', cross_sell_products: '["CDN","Analytics","VOD Storage"]', expected_close: '2026-03-15', notes: 'Awaiting legal review' },
    { company_name: 'BroadcastPro EU', contact_name: 'Lars Eriksson', stage: 'opportunity', value: 120000, owner: 'David', source: 'conference', cross_sell_products: '["CDN","Live Encoding","DRM"]', expected_close: '2026-04-01', notes: 'Technical POC scheduled' },
    { company_name: 'StreamNow Ltd', contact_name: 'Emily Roberts', stage: 'qualified', value: 36000, owner: 'Zara', source: 'website', cross_sell_products: '["CDN"]', expected_close: '2026-05-01', notes: 'Discovery call completed' },
    { company_name: 'LiveEvents Co', contact_name: 'Marco Rossi', stage: 'lead', value: 85000, owner: 'David', source: 'cold-outreach', cross_sell_products: '["CDN","Live Encoding"]', expected_close: '2026-06-01', notes: 'Initial contact made' },
    { company_name: 'CloudVid Asia', contact_name: 'Yuki Tanaka', stage: 'lead', value: 55000, owner: 'Zara', source: 'partner', cross_sell_products: '["CDN","Analytics"]', expected_close: '2026-06-15', notes: 'Partner referral from AWS' },
    { company_name: 'Nordic Media AS', contact_name: 'Ingrid Larsen', stage: 'qualified', value: 92000, owner: 'David', source: 'inbound', cross_sell_products: '["CDN","VOD Storage","Analytics"]', expected_close: '2026-04-15', notes: 'Needs GDPR compliance review' },
    { company_name: 'TeleVista SA', contact_name: 'Carlos Mendez', stage: 'opportunity', value: 64000, owner: 'Zara', source: 'conference', cross_sell_products: '["Live Encoding","DRM"]', expected_close: '2026-03-30', notes: 'Second meeting scheduled' },
    { company_name: 'PixelStream UK', contact_name: 'James Thompson', stage: 'proposal', value: 45000, owner: 'David', source: 'website', cross_sell_products: '["CDN","Analytics"]', expected_close: '2026-03-01', notes: 'Contract under review' },
    { company_name: 'DigiCast MENA', contact_name: 'Ahmed Hassan', stage: 'lead', value: 150000, owner: 'David', source: 'referral', cross_sell_products: '["CDN","Live Encoding","VOD Storage","DRM"]', expected_close: '2026-07-01', notes: 'Large government media project' },
  ];

  for (const d of deals) {
    stmts.insertDeal.run({ ...d, currency: 'USD', crm_id: '' });
  }
  logActivity('sync', 'crm', null, 'CRM pipeline seeded with initial deals');
}

function syncAll() {
  syncKPIs();
  syncBlockers();
  syncTodos();
  seedTasks();
  seedCRMPipeline();
}

module.exports = { syncAll, syncKPIs, syncTodos };
