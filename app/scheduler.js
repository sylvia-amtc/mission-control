/**
 * Scheduler — Comprehensive data freshness for all Mission Control pages.
 *
 * PHILOSOPHY: MC doesn't have the data — VPs do. The scheduler's job is to
 * SUMMON VPs at the right times so they push fresh data via the MC APIs.
 * The only truly automated pull is CRM (Twenty API).
 *
 * Schedule:
 *   06:45 UTC daily  — MASTER REFRESH: summon ALL VPs for full data push
 *   13:00 UTC daily  — Mid-day KPI refresh: summon VPs for KPI updates
 *   Every 2h biz hrs — Dashboard: summon VPs for quick status + recalc derived stats
 *   Every 4h biz hrs — Kanban deep scan: summon VPs for task/status updates
 *   CRM              — Every 30min automated pull from Twenty (unchanged)
 *
 * After VP data arrives (via POST /api/tasks/sync, /api/kpis/push, etc.),
 * local recalculation runs: derived KPIs, dept health scores, milestone flags.
 *
 * DO NOT touch Action Items page — configured separately.
 */
const fs = require('fs');
const path = require('path');
const { db, stmts, logActivity } = require('./db');

const VP_WORKSPACES = [
  { name: 'Nadia', dept: 'Research & Intelligence', path: '/root/.openclaw/workspace-nadia/' },
  { name: 'Max', dept: 'Marketing & Content', path: '/root/.openclaw/workspace-max/' },
  { name: 'Elena', dept: 'Sales & Business Dev', path: '/root/.openclaw/workspace-elena/' },
  { name: 'Viktor', dept: 'Engineering & Product', path: '/root/.openclaw/workspace-viktor/' },
  { name: 'Zara', dept: 'Documentation & KB', path: '/root/.openclaw/workspace-zara/' },
];

const SUMMON_DIR = path.join(__dirname, '..', 'summon-queue');
try { fs.mkdirSync(SUMMON_DIR, { recursive: true }); } catch (e) {}

function updateSyncStatus(source, status = 'ok', details = '') {
  stmts.upsertSyncStatus.run({ source, last_sync: new Date().toISOString(), status, details });
}

function isBusinessHours() {
  const hour = new Date().getUTCHours();
  return hour >= 7 && hour < 19;
}

// ═══════════════════════════════════════════════════════════════════
// SUMMON QUEUE — write VP data-refresh requests
// ═══════════════════════════════════════════════════════════════════

/**
 * Write a summon request for a VP to push specific data.
 * @param {string} vpName - VP name (Nadia, Max, Elena, Viktor, Zara)
 * @param {string[]} dataNeeded - What data to push: 'kpis', 'tasks', 'milestones', 'status', 'blockers'
 * @param {string} context - Which page/reason triggered this: 'master_refresh', 'kanban', 'kpi_midday', 'dashboard', etc.
 * @param {string} [urgency='normal'] - 'normal' or 'high'
 */
function summonVPForData(vpName, dataNeeded, context, urgency = 'normal') {
  const ts = new Date().toISOString();
  const filename = `data-refresh-${vpName.toLowerCase()}-${context}-${Date.now()}.json`;

  const payload = {
    summon_type: 'data_refresh',
    vp_name: vpName,
    data_needed: dataNeeded,
    context,
    urgency,
    timestamp: ts,
    instructions: buildInstructions(vpName, dataNeeded, context),
    push_endpoints: buildEndpoints(dataNeeded),
  };

  fs.writeFileSync(path.join(SUMMON_DIR, filename), JSON.stringify(payload, null, 2));
  logActivity('summon', 'data_refresh', null, `VP summoned: ${vpName} for ${context} — push: ${dataNeeded.join(', ')}`, 'scheduler');
  return filename;
}

function buildInstructions(vpName, dataNeeded, context) {
  const parts = [`Data refresh request for ${vpName} (${context}).`, 'Please gather and push the following to Mission Control:'];

  if (dataNeeded.includes('kpis')) {
    parts.push('• KPIs: Push current department KPIs via POST /api/kpis/push { department, kpi_name, target, current_value, status, trend }');
  }
  if (dataNeeded.includes('tasks')) {
    parts.push('• Tasks: Push task status updates via POST /api/tasks/sync [{ title, department, owner, status, priority }]');
  }
  if (dataNeeded.includes('milestones')) {
    parts.push('• Milestones: Update milestone progress via PUT /api/milestones/:id { status, completed_date, description }');
  }
  if (dataNeeded.includes('status')) {
    parts.push('• Status: Provide a brief department status summary — any blockers, wins, or risks');
  }
  if (dataNeeded.includes('blockers')) {
    parts.push('• Blockers: Report any blockers via POST /api/actions { title, description, owner, severity, requester }');
  }

  return parts.join('\n');
}

function buildEndpoints(dataNeeded) {
  const endpoints = {};
  if (dataNeeded.includes('kpis')) endpoints.kpis = 'POST /api/kpis/push';
  if (dataNeeded.includes('tasks')) endpoints.tasks = 'POST /api/tasks/sync';
  if (dataNeeded.includes('milestones')) endpoints.milestones = 'PUT /api/milestones/:id';
  if (dataNeeded.includes('status')) endpoints.status = 'POST /api/tasks/sync (status tasks)';
  if (dataNeeded.includes('blockers')) endpoints.blockers = 'POST /api/actions';
  return endpoints;
}

/**
 * Summon all VPs for a specific data set.
 */
function summonAllVPs(dataNeeded, context, urgency = 'normal') {
  const summoned = [];
  for (const vp of VP_WORKSPACES) {
    const filename = summonVPForData(vp.name, dataNeeded, context, urgency);
    summoned.push({ vp: vp.name, filename });
  }
  console.log(`[Scheduler] Summoned ${summoned.length} VPs for ${context}: ${dataNeeded.join(', ')}`);
  return summoned;
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL RECALCULATIONS — run AFTER VPs push data, or on schedule
// These don't need VP participation, they derive from existing DB data.
// ═══════════════════════════════════════════════════════════════════

/** Calculate derived KPIs from existing DB data (pipeline, tasks, blockers, action items) */
function calculateDerivedKPIs() {
  const today = new Date().toISOString().split('T')[0];

  function upsertKPI(department, kpi_name, current_value, target, status, trend) {
    db.prepare('DELETE FROM kpi_snapshots WHERE department = ? AND kpi_name = ? AND snapshot_date = ?').run(department, kpi_name, today);
    stmts.insertKPI.run({ department, kpi_name, target, current_value, status, trend, snapshot_date: today });
  }

  try {
    const pipeStats = stmts.pipelineStats.all();
    const totalValue = pipeStats.reduce((s, r) => s + (r.total_value || 0), 0);
    const dealCount = pipeStats.reduce((s, r) => s + r.count, 0);
    upsertKPI('Sales & Business Dev', 'Pipeline Total Value', `$${(totalValue / 1000).toFixed(0)}K`, '$500K',
      totalValue >= 500000 ? '🟢 On Track' : '🟡 Building', '↑');
    upsertKPI('Sales & Business Dev', 'Active Deals', `${dealCount}`, '20',
      dealCount >= 15 ? '🟢 On Track' : '🟡 Building', dealCount > 10 ? '↑' : '→');
  } catch (e) { console.error('[Scheduler] Derived KPI (pipeline):', e.message); }

  try {
    const taskStats = stmts.taskStats.all();
    const total = taskStats.reduce((s, r) => s + r.count, 0);
    const done = (taskStats.find(r => r.status === 'done') || {}).count || 0;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    upsertKPI('Operations', 'Task Completion Rate', `${rate}%`, '70%',
      rate >= 70 ? '🟢 On Track' : rate >= 40 ? '🟡 In Progress' : '🔴 Behind', rate > 50 ? '↑' : '→');
    upsertKPI('Operations', 'Total Active Tasks', `${total - done}`, '-', '-', '→');
  } catch (e) { console.error('[Scheduler] Derived KPI (tasks):', e.message); }

  try {
    const blockers = stmts.blockerCount.get().count;
    upsertKPI('Operations', 'Open Blockers', `${blockers}`, '0',
      blockers === 0 ? '🟢 Clear' : blockers <= 2 ? '🟡 Manageable' : '🔴 Critical', blockers > 3 ? '↑' : '↓');
  } catch (e) { console.error('[Scheduler] Derived KPI (blockers):', e.message); }

  try {
    const all = stmts.getAllActions.all();
    const resolved = all.filter(a => a.status === 'resolved').length;
    const rate = all.length > 0 ? Math.round((resolved / all.length) * 100) : 0;
    const openRed = all.filter(a => a.status !== 'resolved' && a.severity === 'red').length;
    upsertKPI('Operations', 'Action Item Resolution Rate', `${rate}%`, '80%',
      rate >= 80 ? '🟢 On Track' : rate >= 50 ? '🟡 In Progress' : '🔴 Behind', '→');
    upsertKPI('Operations', 'Critical Open Actions', `${openRed}`, '0',
      openRed === 0 ? '🟢 Clear' : '🔴 Needs Attention', '→');
  } catch (e) { console.error('[Scheduler] Derived KPI (actions):', e.message); }

  try {
    const overdue = stmts.overdueCount.get().count;
    upsertKPI('Operations', 'Overdue Tasks', `${overdue}`, '0',
      overdue === 0 ? '🟢 Clear' : overdue <= 3 ? '🟡 Attention' : '🔴 Critical', '→');
  } catch (e) { console.error('[Scheduler] Derived KPI (overdue):', e.message); }

  logActivity('sync', 'kpi', null, 'Derived KPIs recalculated from DB', 'scheduler');
}

/** Auto-flag milestones as missed or at-risk based on dates */
function flagMilestones() {
  const today = new Date().toISOString().split('T')[0];
  const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  let missed = 0, atRisk = 0;

  for (const m of stmts.getAllMilestones.all()) {
    if (m.status === 'completed') continue;
    if (m.target_date && m.target_date < today && m.status !== 'missed') {
      db.prepare("UPDATE milestones SET status = 'missed' WHERE id = ?").run(m.id);
      logActivity('auto_flag', 'milestone', m.id, `MISSED: ${m.name} (due ${m.target_date})`, 'scheduler');
      missed++;
    } else if (m.target_date && m.target_date <= threeDaysOut && m.target_date >= today && m.status === 'pending') {
      db.prepare("UPDATE milestones SET status = 'in_progress', description = description || ' [⚠ AT RISK]' WHERE id = ? AND description NOT LIKE '%AT RISK%'").run(m.id);
      atRisk++;
    }
  }

  if (missed || atRisk) {
    updateSyncStatus('milestones', 'ok', `${missed} missed, ${atRisk} at-risk`);
    logActivity('sync', 'milestones', null, `Milestone flags: ${missed} missed, ${atRisk} at-risk`, 'scheduler');
  }
  return { missed, atRisk };
}

/** Calculate department health scores (0-100) and store as KPI snapshots */
function calculateDeptHealthScores() {
  const today = new Date().toISOString().split('T')[0];
  const departments = ['Research & Intelligence', 'Marketing & Content', 'Sales & Business Dev', 'Engineering & Product', 'Documentation & KB'];

  for (const dept of departments) {
    // Task completion (40 pts)
    const tasks = stmts.getTasksByDept.all(dept);
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const taskScore = total > 0 ? Math.round((done / total) * 40) : 20; // 20 default if no tasks

    // Blockers penalty (-10 each, max -20)
    const blockerPenalty = Math.min(tasks.filter(t => t.is_blocker && t.status !== 'done').length * 10, 20);

    // KPI health (20 pts)
    const kpis = stmts.getKPIByDept.all(dept, dept);
    let kpiScore = 15; // default
    if (kpis.length > 0) {
      const onTrack = kpis.filter(k => k.status && k.status.includes('On Track')).length;
      kpiScore = Math.round((onTrack / kpis.length) * 20);
    }

    // Activity recency (-5 per day over 2, max -20)
    const last = db.prepare("SELECT MAX(created_at) as last FROM activity_log WHERE message LIKE ?").get(`%${dept.split(' ')[0]}%`);
    let actPenalty = 0;
    if (last && last.last) {
      const days = Math.floor((Date.now() - new Date(last.last).getTime()) / 86400000);
      actPenalty = Math.min(Math.max(0, (days - 2) * 5), 20);
    }

    const score = Math.max(0, Math.min(100, taskScore + kpiScore + 40 - blockerPenalty - actPenalty));

    db.prepare('DELETE FROM kpi_snapshots WHERE department = ? AND kpi_name = ? AND snapshot_date = ?').run(dept, 'Department Health Score', today);
    stmts.insertKPI.run({
      department: dept, kpi_name: 'Department Health Score', target: '80',
      current_value: `${score}`,
      status: score >= 80 ? '🟢 Healthy' : score >= 50 ? '🟡 Needs Attention' : '🔴 Critical',
      trend: '→', snapshot_date: today,
    });
  }

  updateSyncStatus('dept_health', 'ok', 'Health scores calculated');
  logActivity('sync', 'dept_health', null, 'Department health scores calculated', 'scheduler');
}

// ═══════════════════════════════════════════════════════════════════
// ACTION ITEMS SYNC (existing — preserved, not on new schedules)
// ═══════════════════════════════════════════════════════════════════
function scanVPBlockers() {
  const blockerFiles = ['blockers.md', 'BLOCKERS.md', 'blocker.md'];
  let totalFound = 0;
  db.prepare("DELETE FROM action_items WHERE requester LIKE '%vp-blocker-sync%'").run();

  for (const vp of VP_WORKSPACES) {
    for (const bf of blockerFiles) {
      const filePath = path.join(vp.path, bf);
      try {
        if (!fs.existsSync(filePath)) continue;
        const raw = fs.readFileSync(filePath, 'utf8');
        const lines = raw.split('\n');
        let currentTitle = null, currentDesc = '', severity = 'yellow';

        for (const line of lines) {
          if (/critical|🔴|red/i.test(line) && /^#+/.test(line)) { severity = 'red'; continue; }
          if (/high|🟡|yellow/i.test(line) && /^#+/.test(line)) { severity = 'yellow'; continue; }
          const titleMatch = line.match(/^#{1,4}\s+(.+)/);
          if (titleMatch && !(/^#\s/.test(line) && line.includes('Blocker'))) {
            if (currentTitle) {
              stmts.insertAction.run({ title: currentTitle, description: currentDesc.trim(), owner: vp.name,
                requester: `${vp.name} (vp-blocker-sync)`, severity, status: 'open',
                notes: `Auto-scanned from ${vp.name}'s workspace`, opened_date: new Date().toISOString().split('T')[0] });
              totalFound++;
            }
            currentTitle = `[${vp.name}] ${titleMatch[1].trim()}`; currentDesc = ''; continue;
          }
          if (currentTitle && line.trim()) currentDesc += line + '\n';
        }
        if (currentTitle) {
          stmts.insertAction.run({ title: currentTitle, description: currentDesc.trim(), owner: vp.name,
            requester: `${vp.name} (vp-blocker-sync)`, severity, status: 'open',
            notes: `Auto-scanned from ${vp.name}'s workspace`, opened_date: new Date().toISOString().split('T')[0] });
          totalFound++;
        }
      } catch (e) { /* skip */ }
    }
  }
  logActivity('sync', 'action_items', null, `VP blocker scan: ${totalFound} items`, 'scheduler');
  return totalFound;
}

function syncActionItems() {
  try {
    db.prepare("DELETE FROM action_items WHERE requester LIKE '%todo-sync%'").run();
    const { syncTodos } = require('./sync');
    syncTodos(true);
    const blockerCount = scanVPBlockers();
    updateSyncStatus('action_items', 'ok', `Synced todo + ${blockerCount} VP blockers`);
    return true;
  } catch (e) {
    updateSyncStatus('action_items', 'error', e.message);
    console.error('[Scheduler] Action items sync error:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PAGE-LEVEL REFRESH ORCHESTRATORS
// These summon VPs + run local recalculations
// ═══════════════════════════════════════════════════════════════════

/** Dashboard refresh: summon VPs for quick status + recalculate derived stats */
function refreshDashboard() {
  console.log('[Scheduler] refreshDashboard() — summoning VPs for status updates');
  summonAllVPs(['status', 'blockers'], 'dashboard_refresh');
  // Recalculate from whatever data is already in DB
  calculateDerivedKPIs();
  updateSyncStatus('dashboard', 'ok', 'VPs summoned + derived stats recalculated');
}

/** Kanban refresh: summon VPs for task/status updates */
function refreshKanban() {
  console.log('[Scheduler] refreshKanban() — summoning VPs for task updates');
  summonAllVPs(['tasks', 'status'], 'kanban_refresh');
  updateSyncStatus('kanban', 'ok', 'VPs summoned for task sync');
}

/** Gantt refresh: summon VPs for milestone updates + auto-flag missed/at-risk */
function refreshGantt() {
  console.log('[Scheduler] refreshGantt() — summoning VPs for milestone updates');
  summonAllVPs(['milestones'], 'gantt_refresh');
  flagMilestones();
  updateSyncStatus('gantt', 'ok', 'VPs summoned + milestones flagged');
}

/** KPI refresh: summon VPs for KPI pushes + calculate derived KPIs */
function refreshKPIs() {
  console.log('[Scheduler] refreshKPIs() — summoning VPs for KPI updates');
  summonAllVPs(['kpis'], 'kpi_refresh');
  calculateDerivedKPIs();
  updateSyncStatus('kpis', 'ok', 'VPs summoned + derived KPIs calculated');
}

/** Master refresh: summon ALL VPs for EVERYTHING + all local recalculations */
function masterRefresh() {
  console.log('[Scheduler] ═══ MASTER REFRESH 06:45 UTC ═══');
  const start = Date.now();

  // Summon all VPs for full data push
  summonAllVPs(['kpis', 'tasks', 'milestones', 'status', 'blockers'], 'master_refresh', 'high');

  // Run all local recalculations
  try { syncActionItems(); } catch (e) { console.error('[Master] Action items:', e.message); }
  try { flagMilestones(); } catch (e) { console.error('[Master] Milestones:', e.message); }
  try { calculateDerivedKPIs(); } catch (e) { console.error('[Master] Derived KPIs:', e.message); }
  try { calculateDeptHealthScores(); } catch (e) { console.error('[Master] Dept health:', e.message); }

  const elapsed = Date.now() - start;
  updateSyncStatus('master_refresh', 'ok', `Completed in ${elapsed}ms — VPs summoned for full push`);
  logActivity('sync', 'all', null, `Master refresh: VPs summoned + local recalc in ${elapsed}ms`, 'scheduler');
  console.log(`[Scheduler] ═══ MASTER REFRESH COMPLETE (${elapsed}ms) ═══`);
}

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function scheduleDailyAt(hour, minute, fn, label) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const delay = next - now;
  console.log(`[Scheduler] "${label}" — next in ${Math.round(delay / 60000)}min at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC`);
  setTimeout(() => {
    fn();
    setInterval(fn, 24 * 60 * 60 * 1000);
  }, delay);
}

let syncFromTwentyFn = null;
let broadcastFn = null;

function startScheduler(opts = {}) {
  syncFromTwentyFn = opts.syncFromTwenty;
  broadcastFn = opts.broadcast;

  // ── Initial startup: local recalculations only (no VP summons on restart) ──
  console.log('[Scheduler] Running initial local recalculations...');
  try { syncActionItems(); } catch (e) {}
  try { flagMilestones(); } catch (e) {}
  try { calculateDerivedKPIs(); } catch (e) {}
  try { calculateDeptHealthScores(); } catch (e) {}
  updateSyncStatus('startup', 'ok', 'Initial local recalc complete');

  // ── Daily 06:45 UTC — Master Refresh (summon ALL VPs for everything) ──
  scheduleDailyAt(6, 45, () => {
    masterRefresh();
    if (broadcastFn) broadcastFn('daily_sync_complete', { ts: Date.now() });
  }, 'Master Refresh (06:45 UTC)');

  // ── Daily 13:00 UTC — Mid-day KPI refresh ──
  scheduleDailyAt(13, 0, () => {
    console.log('[Scheduler] Mid-day KPI refresh (13:00 UTC)');
    refreshKPIs();
    calculateDeptHealthScores();
    if (broadcastFn) broadcastFn('kpi_refresh', { ts: Date.now() });
  }, 'Mid-day KPI Refresh (13:00 UTC)');

  // ── Every 2h during business hours — Dashboard refresh ──
  setInterval(() => {
    if (!isBusinessHours()) return;
    console.log('[Scheduler] 2h Dashboard refresh');
    refreshDashboard();

    // CRM automated pull
    if (syncFromTwentyFn) {
      syncFromTwentyFn().then(() => {
        updateSyncStatus('crm', 'ok', 'Scheduled CRM sync');
        logActivity('sync', 'crm', null, 'Scheduled CRM sync from Twenty', 'scheduler');
      }).catch(e => {
        updateSyncStatus('crm', 'error', e.message);
      });
    }

    if (broadcastFn) broadcastFn('sync_complete', { ts: Date.now() });
  }, 2 * 60 * 60 * 1000);

  // ── Every 4h during business hours — Kanban deep scan ──
  setInterval(() => {
    if (!isBusinessHours()) return;
    console.log('[Scheduler] 4h Kanban refresh');
    refreshKanban();
    if (broadcastFn) broadcastFn('kanban_refresh', { ts: Date.now() });
  }, 4 * 60 * 60 * 1000);

  console.log('[Scheduler] ═══ SCHEDULER STARTED ═══');
  console.log('[Scheduler]   06:45 UTC  — Master refresh: summon ALL VPs for full data push');
  console.log('[Scheduler]   13:00 UTC  — Mid-day: summon VPs for KPI updates');
  console.log('[Scheduler]   Every 2h   — Dashboard: summon VPs for status (biz hours)');
  console.log('[Scheduler]   Every 4h   — Kanban: summon VPs for task updates (biz hours)');
  console.log('[Scheduler]   CRM        — Every 30min automated pull from Twenty');
}

// ── Manual sync-all ──
async function syncAllSources() {
  const results = {};

  // CRM — automated pull
  if (syncFromTwentyFn) {
    try { await syncFromTwentyFn(); updateSyncStatus('crm', 'ok', 'Manual sync'); results.crm = 'ok'; }
    catch (e) { updateSyncStatus('crm', 'error', e.message); results.crm = 'error: ' + e.message; }
  }

  // Summon all VPs for everything
  summonAllVPs(['kpis', 'tasks', 'milestones', 'status', 'blockers'], 'manual_sync_all', 'high');
  results.vp_summons = 'dispatched';

  // Local recalculations
  syncActionItems(); results.action_items = 'ok';
  flagMilestones(); results.milestones = 'ok';
  calculateDerivedKPIs(); results.derived_kpis = 'ok';
  calculateDeptHealthScores(); results.dept_health = 'ok';

  logActivity('sync', 'all', null, 'Manual sync-all: VPs summoned + local recalc', 'user');
  if (broadcastFn) broadcastFn('sync_complete', { ts: Date.now(), results });
  return results;
}

module.exports = {
  startScheduler,
  syncAllSources,
  syncActionItems,
  scanVPBlockers,
  summonVPForData,
  summonAllVPs,
  refreshKanban,
  refreshGantt,
  refreshKPIs,
  refreshDashboard,
  calculateDeptHealthScores,
  calculateDerivedKPIs,
  flagMilestones,
  masterRefresh,
  updateSyncStatus,
};
