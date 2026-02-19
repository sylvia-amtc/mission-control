const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'mission-control.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    department TEXT NOT NULL,
    owner TEXT DEFAULT '',
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical','high','medium','low')),
    status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog','in_progress','review','done')),
    due_date TEXT,
    depends_on TEXT DEFAULT '[]',
    is_blocker INTEGER DEFAULT 0,
    blocker_note TEXT DEFAULT '',
    milestone TEXT DEFAULT '',
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT DEFAULT '',
    target_date TEXT,
    completed_date TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','missed')),
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT NOT NULL,
    kpi_name TEXT NOT NULL,
    target TEXT DEFAULT '',
    current_value TEXT DEFAULT '',
    status TEXT DEFAULT '',
    trend TEXT DEFAULT '',
    snapshot_date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner TEXT DEFAULT 'David',
    requester TEXT DEFAULT '',
    severity TEXT DEFAULT 'yellow' CHECK(severity IN ('red','yellow','blue')),
    status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','deferred','awaiting_david','awaiting_vp')),
    notes TEXT DEFAULT '',
    opened_date TEXT DEFAULT (date('now')),
    resolved_date TEXT,
    last_activity TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS action_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (action_id) REFERENCES action_items(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_action_messages_action ON action_messages(action_id);

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    entity_type TEXT DEFAULT '',
    entity_id INTEGER,
    message TEXT DEFAULT '',
    actor TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_pipeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    contact_name TEXT DEFAULT '',
    stage TEXT DEFAULT 'lead' CHECK(stage IN ('lead','qualified','opportunity','proposal','closed_won','closed_lost')),
    value REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    owner TEXT DEFAULT '',
    source TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    cross_sell_products TEXT DEFAULT '[]',
    last_activity TEXT,
    expected_close TEXT,
    crm_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_crm_stage ON crm_pipeline(stage);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department);
  CREATE INDEX IF NOT EXISTS idx_kpi_dept_date ON kpi_snapshots(department, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_action_status ON action_items(status);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

  CREATE TABLE IF NOT EXISTS sync_status (
    source TEXT PRIMARY KEY,
    last_sync TEXT,
    status TEXT DEFAULT 'ok',
    details TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    platform TEXT NOT NULL CHECK(platform IN ('x','linkedin_company','linkedin_personal')),
    scheduled_at TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending_review','approved','declined','changes_requested','posted')),
    hashtags TEXT DEFAULT '',
    media_urls TEXT DEFAULT '[]',
    author TEXT DEFAULT 'Max',
    decline_reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS post_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
  CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
  CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_post_messages_post ON post_messages(post_id);

  CREATE TABLE IF NOT EXISTS agent_status (
    agent_id TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    department TEXT,
    reports_to TEXT,
    model TEXT,
    status TEXT DEFAULT 'sleeping',
    current_task TEXT,
    last_task TEXT,
    last_active_at TEXT,
    next_wake_at TEXT,
    capabilities TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    task TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    started_at TEXT,
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agent_status(agent_id)
  );
  CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity(agent_id, completed_at DESC);

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('lead-gen','design','infrastructure','analytics','social','communication','other')),
    url TEXT DEFAULT '',
    plan TEXT DEFAULT '',
    cost_monthly DECIMAL DEFAULT 0,
    cost_annual DECIMAL,
    billing_cycle TEXT DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual','one-time','free')),
    owner TEXT DEFAULT '',
    users TEXT DEFAULT '[]',
    department TEXT DEFAULT '',
    status TEXT DEFAULT 'active' CHECK(status IN ('active','trial','pending-approval','suspended','cancelled')),
    login_email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    renewal_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
  CREATE INDEX IF NOT EXISTS idx_vendors_department ON vendors(department);
  CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);

  CREATE TABLE IF NOT EXISTS visual_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done','changes_requested')),
    requesting_agent TEXT DEFAULT '',
    department TEXT DEFAULT '',
    associated_post_id INTEGER,
    drive_file_id TEXT DEFAULT '',
    drive_url TEXT DEFAULT '',
    reference_specs TEXT DEFAULT '',
    deadline TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (associated_post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS visual_request_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES visual_requests(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_visual_requests_status ON visual_requests(status);
  CREATE INDEX IF NOT EXISTS idx_visual_request_messages_req ON visual_request_messages(request_id);

  CREATE TABLE IF NOT EXISTS research_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done','changes_requested')),
    requesting_agent TEXT DEFAULT '',
    department TEXT DEFAULT '',
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal','high','urgent')),
    drive_file_id TEXT DEFAULT '',
    drive_url TEXT DEFAULT '',
    context TEXT DEFAULT '',
    deadline TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS research_request_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES research_requests(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_research_requests_status ON research_requests(status);
  CREATE INDEX IF NOT EXISTS idx_research_request_messages_req ON research_request_messages(request_id);

  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    task_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_token_usage_agent_date ON token_usage(agent_id, timestamp);
`);

  // ─── Token Usage Migration ─────────────────────────────────────
  // Add date column by extracting from timestamp if missing
  try { 
    const tableInfo = db.prepare("PRAGMA table_info(token_usage)").all();
    const hasDateCol = tableInfo.some(col => col.name === 'date');
    if (!hasDateCol) {
      db.exec("ALTER TABLE token_usage ADD COLUMN date TEXT");
      // Backfill date from timestamp
      db.exec("UPDATE token_usage SET date = date(timestamp) WHERE date IS NULL");
      // Create the required index
      db.exec("CREATE INDEX IF NOT EXISTS idx_token_usage_agent_date ON token_usage(agent_id, date)");
    }
  } catch(e) { /* table may not exist or already migrated */ }

  // ─── Migrations ─────────────────────────────────────────────────
  // Add last_activity column if missing
  try { db.exec("ALTER TABLE action_items ADD COLUMN last_activity TEXT"); } catch(e) { /* already exists */ }
// Add action_messages table if missing (handles re-runs)
try { db.exec(`CREATE TABLE IF NOT EXISTS action_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, action_id INTEGER NOT NULL, sender TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (action_id) REFERENCES action_items(id) ON DELETE CASCADE)`); } catch(e) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_action_messages_action ON action_messages(action_id)"); } catch(e) {}
// Migrate CHECK constraint — SQLite requires table recreation
try {
  const hasOldCheck = db.prepare("SELECT sql FROM sqlite_master WHERE name='action_items'").get();
  if (hasOldCheck && hasOldCheck.sql && !hasOldCheck.sql.includes('awaiting_david')) {
    db.exec(`
      CREATE TABLE action_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        owner TEXT DEFAULT 'David',
        requester TEXT DEFAULT '',
        severity TEXT DEFAULT 'yellow' CHECK(severity IN ('red','yellow','blue')),
        status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','deferred','awaiting_david','awaiting_vp')),
        notes TEXT DEFAULT '',
        opened_date TEXT DEFAULT (date('now')),
        resolved_date TEXT,
        last_activity TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO action_items_new SELECT id,title,description,owner,requester,severity,status,notes,opened_date,resolved_date,last_activity,created_at,updated_at FROM action_items;
      DROP TABLE action_items;
      ALTER TABLE action_items_new RENAME TO action_items;
      CREATE INDEX IF NOT EXISTS idx_action_status ON action_items(status);
    `);
  }
} catch(e) { console.error('Migration error:', e.message); }
// Backfill last_activity
try { db.exec("UPDATE action_items SET last_activity = updated_at WHERE last_activity IS NULL"); } catch(e) {}

// Add action_item_id to tasks
try { db.exec("ALTER TABLE tasks ADD COLUMN action_item_id INTEGER REFERENCES action_items(id)"); } catch(e) { /* already exists */ }
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_action_item ON tasks(action_item_id)"); } catch(e) {}

// Timeline fields
try { db.exec("ALTER TABLE tasks ADD COLUMN start_date TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN end_date TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN is_milestone INTEGER DEFAULT 0"); } catch(e) {}
// Backfill
try {
  db.exec("UPDATE tasks SET start_date = date(created_at) WHERE start_date IS NULL");
  db.exec("UPDATE tasks SET end_date = due_date WHERE end_date IS NULL AND due_date IS NOT NULL");
  db.exec("UPDATE tasks SET progress = 100 WHERE status = 'done' AND (progress IS NULL OR progress = 0)");
  db.exec("UPDATE tasks SET progress = 50 WHERE status = 'in_progress' AND (progress IS NULL OR progress = 0)");
  db.exec("UPDATE tasks SET progress = 75 WHERE status = 'review' AND (progress IS NULL OR progress = 0)");
} catch(e) {}

// ─── Seed agent_status if empty ─────────────────────────────────
const agentCount = db.prepare('SELECT COUNT(*) as c FROM agent_status').get().c;
if (agentCount === 0) {
  const seedAgents = [
    { id:'david', name:'David', role:'CEO', dept:null, reports_to:null, model:'human', caps:JSON.stringify(["strategic-decisions","budget-approval","partnership-approval","brand-sign-off"]) },
    { id:'main', name:'Sylvia', role:'COO', dept:null, reports_to:'david', model:'anthropic/claude-opus-4-6', caps:JSON.stringify(["cross-dept-coordination","vp-management","kpi-tracking","cron-scheduling","agent-spawning","drive-access","gmail-access","calendar-access"]) },
    { id:'viktor', name:'Viktor', role:'VP Engineering', dept:'Engineering', reports_to:'main', model:'anthropic/claude-opus-4-6', caps:JSON.stringify(["code-generation","architecture","mc-development","antfarm-workflows","devops","security-audit"]) },
    { id:'nadia', name:'Nadia', role:'VP Research & Intelligence', dept:'Research & Intelligence', reports_to:'main', model:'google-antigravity/gemini-3-pro-high', caps:JSON.stringify(["competitive-analysis","market-research","industry-tracking","massive-context-window","search-grounding","multimodal-analysis"]) },
    { id:'max', name:'Max', role:'VP Marketing & Content', dept:'Marketing & Content', reports_to:'main', model:'openai-codex/gpt-5.2', caps:JSON.stringify(["seo-strategy","content-writing","social-media","email-campaigns","ppc-management","persuasive-writing"]) },
    { id:'elena', name:'Elena', role:'VP Sales & Business Dev', dept:'Sales & Business Dev', reports_to:'main', model:'openai-codex/gpt-5.2', caps:JSON.stringify(["lead-generation","lead-qualification","crm-management","partnership-outreach","cross-sell-pipeline","apollo-io"]) },
    { id:'zara', name:'Zara', role:'VP Design & Brand', dept:'Design & Brand', reports_to:'main', model:'google-antigravity/gemini-3-pro-high', caps:JSON.stringify(["ui-ux-design","brand-identity","figma","visual-design","multimodal-analysis","logo-design"]) },
    { id:'katrine', name:'Katrine', role:'Senior Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-opus-4', caps:'[]' },
    { id:'ruben', name:'Ruben', role:'Senior Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-opus-4', caps:'[]' },
    { id:'lukas', name:'Lukas', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'ines', name:'Ines', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'hanna', name:'Hanna', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'lena', name:'Lena', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'tomas', name:'Tomas', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'andrei', name:'Andrei', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'marek', name:'Marek', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'jakub', name:'Jakub', role:'Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-sonnet-4.5', caps:'[]' },
    { id:'bram', name:'Bram', role:'Junior Engineer', dept:'Engineering', reports_to:'viktor', model:'anthropic/claude-haiku-4.5', caps:'[]' },
    { id:'marco', name:'Marco', role:'Competitive Analyst', dept:'Research & Intelligence', reports_to:'nadia', model:'google-antigravity/gemini-3-flash', caps:'[]' },
    { id:'astrid', name:'Astrid', role:'C-Level Tracker', dept:'Research & Intelligence', reports_to:'nadia', model:'google-antigravity/gemini-3-flash', caps:'[]' },
    { id:'clara', name:'Clara', role:'Market Researcher', dept:'Research & Intelligence', reports_to:'nadia', model:'google-antigravity/gemini-3-flash', caps:'[]' },
    { id:'sofia', name:'Sofia', role:'Tech Scout', dept:'Research & Intelligence', reports_to:'nadia', model:'google-antigravity/gemini-3-flash', caps:'[]' },
    { id:'finn', name:'Finn', role:'SEO Strategist', dept:'Marketing & Content', reports_to:'max', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'amelie', name:'Amelie', role:'Content Writer', dept:'Marketing & Content', reports_to:'max', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'giulia', name:'Giulia', role:'Brand & Positioning', dept:'Marketing & Content', reports_to:'max', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'nico', name:'Nico', role:'Social & Community', dept:'Marketing & Content', reports_to:'max', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'daan', name:'Daan', role:'Email & Nurture', dept:'Marketing & Content', reports_to:'max', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'petra', name:'Petra', role:'Lead Generator', dept:'Sales & Business Dev', reports_to:'elena', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'isla', name:'Isla', role:'Lead Qualifier', dept:'Sales & Business Dev', reports_to:'elena', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'henrik', name:'Henrik', role:'Partnership Manager', dept:'Sales & Business Dev', reports_to:'elena', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'theo', name:'Theo', role:'Sales Ops', dept:'Sales & Business Dev', reports_to:'elena', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'rui', name:'Rui', role:'Account Manager', dept:'Sales & Business Dev', reports_to:'elena', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'marta', name:'Marta', role:'Account Manager', dept:'Sales & Business Dev', reports_to:'elena', model:'openai-codex/gpt-5.2-mini', caps:'[]' },
    { id:'lars', name:'Lars', role:'UI/UX Designer', dept:'Design & Brand', reports_to:'zara', model:'google-antigravity/gemini-3-flash', caps:'[]' },
    { id:'elias', name:'Elias', role:'Graphic Designer', dept:'Design & Brand', reports_to:'zara', model:'google-antigravity/gemini-3-flash', caps:'[]' },
  ];
  const ins = db.prepare('INSERT INTO agent_status (agent_id,name,role,department,reports_to,model,capabilities) VALUES (@id,@name,@role,@dept,@reports_to,@model,@caps)');
  const seedTx = db.transaction(() => { for (const a of seedAgents) ins.run(a); });
  seedTx();
}

// ─── Seed vendor data if empty ─────────────────────────────────
const vendorCount = db.prepare('SELECT COUNT(*) as c FROM vendors').get().c;
if (vendorCount === 0) {
  const seedVendors = [
    {
      name: 'Google Workspace',
      category: 'communication',
      url: 'https://workspace.google.com',
      plan: 'Business Standard',
      cost_monthly: 0,
      cost_annual: null,
      billing_cycle: 'free',
      owner: 'David',
      users: '["David","Sylvia","Viktor","Nadia","Max","Elena","Zara"]',
      department: 'Corporate',
      status: 'active',
      login_email: 'sylvia@amtc.tv',
      notes: 'Included in hosting package'
    },
    {
      name: 'Apollo.io',
      category: 'lead-gen',
      url: 'https://apollo.io',
      plan: 'Professional',
      cost_monthly: 49,
      cost_annual: null,
      billing_cycle: 'monthly',
      owner: 'Elena',
      users: '["Elena","Petra","Isla"]',
      department: 'Sales & Business Dev',
      status: 'pending-approval',
      login_email: '',
      notes: 'Lead generation and prospecting'
    },
    {
      name: 'GoLogin',
      category: 'other',
      url: 'https://gologin.com',
      plan: 'Professional',
      cost_monthly: 49,
      cost_annual: null,
      billing_cycle: 'monthly',
      owner: 'Elena',
      users: '["Elena","Petra"]',
      department: 'Sales & Business Dev',
      status: 'pending-approval',
      login_email: '',
      notes: 'Multi-account browser management'
    },
    {
      name: 'Figma',
      category: 'design',
      url: 'https://figma.com',
      plan: 'Professional',
      cost_monthly: 15,
      cost_annual: null,
      billing_cycle: 'monthly',
      owner: 'Zara',
      users: '["Zara","Lars","Elias"]',
      department: 'Design & Brand',
      status: 'active',
      login_email: 'sylvia@amtc.tv',
      notes: 'Design and prototyping tool'
    },
    {
      name: 'LinkedIn Sales Navigator',
      category: 'lead-gen',
      url: 'https://linkedin.com/sales',
      plan: 'Professional',
      cost_monthly: 80,
      cost_annual: null,
      billing_cycle: 'monthly',
      owner: 'Elena',
      users: '["Elena","Henrik","Petra","Isla"]',
      department: 'Sales & Business Dev',
      status: 'active',
      login_email: '',
      notes: 'B2B lead generation and sales'
    },
    {
      name: 'Cloudflare',
      category: 'infrastructure',
      url: 'https://cloudflare.com',
      plan: 'Pro',
      cost_monthly: 20,
      cost_annual: null,
      billing_cycle: 'monthly',
      owner: 'David',
      users: '["David","Viktor"]',
      department: 'Engineering',
      status: 'active',
      login_email: 'sylvia@amtc.tv',
      notes: 'DNS and CDN services'
    },
    {
      name: 'Brave Search API',
      category: 'infrastructure',
      url: 'https://brave.com/search/api',
      plan: 'Free Tier',
      cost_monthly: 0,
      cost_annual: null,
      billing_cycle: 'free',
      owner: 'Sylvia',
      users: '["Sylvia","Nadia"]',
      department: 'Corporate',
      status: 'active',
      login_email: 'sylvia@amtc.tv',
      notes: 'Search API for research'
    },
    {
      name: 'Groq',
      category: 'infrastructure',
      url: 'https://groq.com',
      plan: 'Free Tier',
      cost_monthly: 0,
      cost_annual: null,
      billing_cycle: 'free',
      owner: 'Sylvia',
      users: '["Sylvia","Viktor"]',
      department: 'Corporate',
      status: 'active',
      login_email: 'sylvia@amtc.tv',
      notes: 'AI inference platform'
    },
    {
      name: 'ElevenLabs',
      category: 'other',
      url: 'https://elevenlabs.io',
      plan: 'Starter',
      cost_monthly: 5,
      cost_annual: null,
      billing_cycle: 'monthly',
      owner: 'Max',
      users: '["Max","Amelie"]',
      department: 'Marketing & Content',
      status: 'active',
      login_email: 'sylvia@amtc.tv',
      notes: 'AI voice generation for content'
    }
  ];

  const seedVendorStmt = db.prepare(`INSERT OR IGNORE INTO vendors 
    (name, category, url, plan, cost_monthly, cost_annual, billing_cycle, owner, users, department, status, login_email, notes) 
    VALUES (@name, @category, @url, @plan, @cost_monthly, @cost_annual, @billing_cycle, @owner, @users, @department, @status, @login_email, @notes)`);
  
  const seedVendorTx = db.transaction(() => {
    for (const vendor of seedVendors) {
      seedVendorStmt.run(vendor);
    }
  });
  seedVendorTx();
}

// Prepared statements
const stmts = {
  // Tasks
  getAllTasks: db.prepare('SELECT * FROM tasks ORDER BY position, created_at'),
  getTasksByStatus: db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY position, created_at'),
  getTasksByDept: db.prepare('SELECT * FROM tasks WHERE department = ? ORDER BY position, created_at'),
  getTask: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  insertTask: db.prepare(`INSERT INTO tasks (title, description, department, owner, priority, status, due_date, depends_on, is_blocker, blocker_note, milestone, position, start_date, end_date, progress, is_milestone) 
    VALUES (@title, @description, @department, @owner, @priority, @status, @due_date, @depends_on, @is_blocker, @blocker_note, @milestone, @position, @start_date, @end_date, @progress, @is_milestone)`),
  updateTask: db.prepare(`UPDATE tasks SET title=@title, description=@description, department=@department, owner=@owner, 
    priority=@priority, status=@status, due_date=@due_date, depends_on=@depends_on, is_blocker=@is_blocker, 
    blocker_note=@blocker_note, milestone=@milestone, position=@position, start_date=@start_date, end_date=@end_date, progress=@progress, is_milestone=@is_milestone, updated_at=datetime('now') WHERE id=@id`),
  updateTaskStatus: db.prepare(`UPDATE tasks SET status=@status, position=@position, updated_at=datetime('now') WHERE id=@id`),
  deleteTask: db.prepare('DELETE FROM tasks WHERE id = ?'),

  // Milestones
  getAllMilestones: db.prepare('SELECT * FROM milestones ORDER BY target_date'),
  insertMilestone: db.prepare(`INSERT INTO milestones (name, department, target_date, status, description) VALUES (@name, @department, @target_date, @status, @description)`),
  updateMilestone: db.prepare(`UPDATE milestones SET name=@name, department=@department, target_date=@target_date, completed_date=@completed_date, status=@status, description=@description WHERE id=@id`),

  // KPI Snapshots
  getKPILatest: db.prepare(`SELECT * FROM kpi_snapshots WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM kpi_snapshots) ORDER BY department, kpi_name`),
  getKPIHistory: db.prepare(`SELECT * FROM kpi_snapshots WHERE department = ? AND kpi_name = ? ORDER BY snapshot_date DESC LIMIT 30`),
  getKPIByDept: db.prepare(`SELECT * FROM kpi_snapshots WHERE department = ? AND snapshot_date = (SELECT MAX(snapshot_date) FROM kpi_snapshots WHERE department = ?) ORDER BY kpi_name`),
  insertKPI: db.prepare(`INSERT INTO kpi_snapshots (department, kpi_name, target, current_value, status, trend, snapshot_date) VALUES (@department, @kpi_name, @target, @current_value, @status, @trend, @snapshot_date)`),

  // Action Items
  getAllActions: db.prepare("SELECT * FROM action_items ORDER BY CASE severity WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 ELSE 2 END, last_activity DESC, opened_date"),
  getOpenActions: db.prepare("SELECT * FROM action_items WHERE status IN ('open','awaiting_david','awaiting_vp') ORDER BY CASE severity WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 ELSE 2 END, last_activity DESC"),
  getActionsByStatus: db.prepare("SELECT * FROM action_items WHERE status = ? ORDER BY CASE severity WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 ELSE 2 END, last_activity DESC"),
  insertAction: db.prepare(`INSERT INTO action_items (title, description, owner, requester, severity, status, notes, opened_date, last_activity) VALUES (@title, @description, @owner, @requester, @severity, @status, @notes, @opened_date, datetime('now'))`),
  updateAction: db.prepare(`UPDATE action_items SET title=@title, description=@description, owner=@owner, requester=@requester, severity=@severity, status=@status, notes=@notes, resolved_date=@resolved_date, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id`),
  resolveAction: db.prepare("UPDATE action_items SET status='resolved', resolved_date=date('now'), notes=@notes, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id"),
  deferAction: db.prepare("UPDATE action_items SET status='deferred', notes=@notes, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id"),
  reopenAction: db.prepare("UPDATE action_items SET status='open', resolved_date=NULL, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id"),
  updateActionStatus: db.prepare("UPDATE action_items SET status=@status, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id"),
  updateActionSeverity: db.prepare("UPDATE action_items SET severity=@severity, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id"),
  getAction: db.prepare("SELECT * FROM action_items WHERE id = ?"),

  // Action Messages
  getActionMessages: db.prepare("SELECT * FROM action_messages WHERE action_id = ? ORDER BY created_at ASC"),
  insertActionMessage: db.prepare("INSERT INTO action_messages (action_id, sender, message) VALUES (@action_id, @sender, @message)"),
  getActionMessageCount: db.prepare("SELECT action_id, COUNT(*) as count FROM action_messages WHERE action_id IN (SELECT id FROM action_items) GROUP BY action_id"),
  getActionUnreadCount: db.prepare("SELECT COUNT(*) as count FROM action_messages WHERE action_id = ? AND created_at > ?"),

  // Activity Log
  getRecentActivity: db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50'),
  insertActivity: db.prepare(`INSERT INTO activity_log (type, entity_type, entity_id, message, actor) VALUES (@type, @entity_type, @entity_id, @message, @actor)`),

  // CRM Pipeline
  getAllDeals: db.prepare('SELECT * FROM crm_pipeline ORDER BY value DESC'),
  getDealsByStage: db.prepare('SELECT * FROM crm_pipeline WHERE stage = ? ORDER BY value DESC'),
  getDeal: db.prepare('SELECT * FROM crm_pipeline WHERE id = ?'),
  insertDeal: db.prepare(`INSERT INTO crm_pipeline (company_name, contact_name, stage, value, currency, owner, source, notes, cross_sell_products, expected_close, crm_id) 
    VALUES (@company_name, @contact_name, @stage, @value, @currency, @owner, @source, @notes, @cross_sell_products, @expected_close, @crm_id)`),
  updateDeal: db.prepare(`UPDATE crm_pipeline SET company_name=@company_name, contact_name=@contact_name, stage=@stage, value=@value, currency=@currency, owner=@owner, source=@source, notes=@notes, cross_sell_products=@cross_sell_products, expected_close=@expected_close, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id`),
  updateDealStage: db.prepare(`UPDATE crm_pipeline SET stage=@stage, last_activity=datetime('now'), updated_at=datetime('now') WHERE id=@id`),
  deleteDeal: db.prepare('DELETE FROM crm_pipeline WHERE id = ?'),
  pipelineStats: db.prepare(`SELECT stage, COUNT(*) as count, SUM(value) as total_value FROM crm_pipeline WHERE stage != 'closed_lost' GROUP BY stage`),

  // Stats
  taskStats: db.prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`),
  blockerCount: db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE is_blocker = 1 AND status != 'done'`),
  overdueCount: db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE due_date < date('now') AND status != 'done'`),
  todayDue: db.prepare(`SELECT * FROM tasks WHERE due_date = date('now') AND status != 'done' ORDER BY priority`),
  overdueTasks: db.prepare(`SELECT * FROM tasks WHERE due_date < date('now') AND status != 'done' ORDER BY due_date`),

  // Posts (Social Calendar)
  getAllPosts: db.prepare('SELECT * FROM posts ORDER BY scheduled_at DESC, created_at DESC'),
  getPostsByStatus: db.prepare('SELECT * FROM posts WHERE status = ? ORDER BY scheduled_at DESC'),
  getPostsByPlatform: db.prepare('SELECT * FROM posts WHERE platform = ? ORDER BY scheduled_at DESC'),
  getPost: db.prepare('SELECT * FROM posts WHERE id = ?'),
  insertPost: db.prepare(`INSERT INTO posts (title, content, platform, scheduled_at, status, hashtags, media_urls, author) VALUES (@title, @content, @platform, @scheduled_at, @status, @hashtags, @media_urls, @author)`),
  updatePost: db.prepare(`UPDATE posts SET title=@title, content=@content, platform=@platform, scheduled_at=@scheduled_at, status=@status, hashtags=@hashtags, media_urls=@media_urls, decline_reason=@decline_reason, updated_at=datetime('now') WHERE id=@id`),
  updatePostStatus: db.prepare(`UPDATE posts SET status=@status, updated_at=datetime('now') WHERE id=@id`),
  deletePost: db.prepare('DELETE FROM posts WHERE id = ?'),
  getPostMessages: db.prepare('SELECT * FROM post_messages WHERE post_id = ? ORDER BY created_at ASC'),
  insertPostMessage: db.prepare('INSERT INTO post_messages (post_id, sender, message) VALUES (@post_id, @sender, @message)'),
  getPostMessageCount: db.prepare('SELECT post_id, COUNT(*) as count FROM post_messages WHERE post_id IN (SELECT id FROM posts) GROUP BY post_id'),

  // Agent Status
  getAllAgents: db.prepare('SELECT * FROM agent_status ORDER BY agent_id'),
  getAgent: db.prepare('SELECT * FROM agent_status WHERE agent_id = ?'),
  updateAgentStatus: db.prepare(`UPDATE agent_status SET status=@status, current_task=@current_task, last_task=@last_task, last_active_at=@last_active_at, next_wake_at=@next_wake_at, updated_at=datetime('now') WHERE agent_id=@agent_id`),
  getAgentActivity: db.prepare('SELECT * FROM agent_activity WHERE agent_id = ? ORDER BY completed_at DESC LIMIT ?'),
  insertAgentActivity: db.prepare('INSERT INTO agent_activity (agent_id, task, status, started_at) VALUES (@agent_id, @task, @status, @started_at)'),

  // Sync status
  upsertSyncStatus: db.prepare(`INSERT INTO sync_status (source, last_sync, status, details) VALUES (@source, @last_sync, @status, @details) ON CONFLICT(source) DO UPDATE SET last_sync=@last_sync, status=@status, details=@details`),
  getAllSyncStatus: db.prepare('SELECT * FROM sync_status ORDER BY source'),
  getSyncStatus: db.prepare('SELECT * FROM sync_status WHERE source = ?'),

  // Vendors
  getAllVendors: db.prepare('SELECT * FROM vendors ORDER BY name'),
  getVendorById: db.prepare('SELECT * FROM vendors WHERE id = ?'),
  createVendor: db.prepare(`INSERT INTO vendors (name, category, url, plan, cost_monthly, cost_annual, billing_cycle, owner, users, department, status, login_email, notes, renewal_date) VALUES (@name, @category, @url, @plan, @cost_monthly, @cost_annual, @billing_cycle, @owner, @users, @department, @status, @login_email, @notes, @renewal_date)`),
  updateVendor: db.prepare(`UPDATE vendors SET name=@name, category=@category, url=@url, plan=@plan, cost_monthly=@cost_monthly, cost_annual=@cost_annual, billing_cycle=@billing_cycle, owner=@owner, users=@users, department=@department, status=@status, login_email=@login_email, notes=@notes, renewal_date=@renewal_date, updated_at=datetime('now') WHERE id=@id`),
  deleteVendor: db.prepare('DELETE FROM vendors WHERE id = ?'),
  getVendorsByStatus: db.prepare('SELECT * FROM vendors WHERE status = ? ORDER BY name'),
  getVendorsByDept: db.prepare('SELECT * FROM vendors WHERE department = ? ORDER BY name'),
  getVendorSummary: db.prepare(`SELECT 
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
    COUNT(CASE WHEN status = 'pending-approval' THEN 1 END) as pending_count,
    SUM(CASE WHEN billing_cycle = 'monthly' THEN cost_monthly WHEN billing_cycle = 'annual' THEN cost_annual/12 ELSE 0 END) as total_monthly_cost
    FROM vendors`),
  // Legacy aliases for compatibility
  getVendorsByDepartment: db.prepare('SELECT * FROM vendors WHERE department = ? ORDER BY name'),
  getVendorsByCategory: db.prepare('SELECT * FROM vendors WHERE category = ? ORDER BY name'),
  getVendor: db.prepare('SELECT * FROM vendors WHERE id = ?'),
  insertVendor: db.prepare(`INSERT INTO vendors (name, category, url, plan, cost_monthly, cost_annual, billing_cycle, owner, users, department, status, login_email, notes, renewal_date) VALUES (@name, @category, @url, @plan, @cost_monthly, @cost_annual, @billing_cycle, @owner, @users, @department, @status, @login_email, @notes, @renewal_date)`),
  // Visual Requests
  getAllVisualRequests: db.prepare('SELECT * FROM visual_requests ORDER BY CASE status WHEN \'pending\' THEN 0 WHEN \'in_progress\' THEN 1 WHEN \'changes_requested\' THEN 2 ELSE 3 END, created_at DESC'),
  getVisualRequestsByStatus: db.prepare('SELECT * FROM visual_requests WHERE status = ? ORDER BY created_at DESC'),
  getVisualRequest: db.prepare('SELECT * FROM visual_requests WHERE id = ?'),
  insertVisualRequest: db.prepare(`INSERT INTO visual_requests (title, description, status, requesting_agent, department, associated_post_id, drive_file_id, drive_url, reference_specs, deadline) VALUES (@title, @description, @status, @requesting_agent, @department, @associated_post_id, @drive_file_id, @drive_url, @reference_specs, @deadline)`),
  updateVisualRequest: db.prepare(`UPDATE visual_requests SET title=@title, description=@description, status=@status, requesting_agent=@requesting_agent, department=@department, associated_post_id=@associated_post_id, drive_file_id=@drive_file_id, drive_url=@drive_url, reference_specs=@reference_specs, deadline=@deadline, updated_at=datetime('now') WHERE id=@id`),
  updateVisualRequestStatus: db.prepare(`UPDATE visual_requests SET status=@status, updated_at=datetime('now') WHERE id=@id`),
  markVisualRequestDone: db.prepare(`UPDATE visual_requests SET status='done', drive_file_id=@drive_file_id, drive_url=@drive_url, updated_at=datetime('now') WHERE id=@id`),
  getVisualRequestMessages: db.prepare('SELECT * FROM visual_request_messages WHERE request_id = ? ORDER BY created_at ASC'),
  insertVisualRequestMessage: db.prepare('INSERT INTO visual_request_messages (request_id, sender, message) VALUES (@request_id, @sender, @message)'),
  getVisualRequestMessageCount: db.prepare('SELECT request_id, COUNT(*) as count FROM visual_request_messages WHERE request_id IN (SELECT id FROM visual_requests) GROUP BY request_id'),
  getVisualRequestsByPostId: db.prepare('SELECT * FROM visual_requests WHERE associated_post_id = ?'),

  // Research Requests
  getAllResearchRequests: db.prepare('SELECT * FROM research_requests ORDER BY CASE status WHEN \'pending\' THEN 0 WHEN \'in_progress\' THEN 1 WHEN \'changes_requested\' THEN 2 ELSE 3 END, CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 ELSE 2 END, created_at DESC'),
  getResearchRequestsByStatus: db.prepare('SELECT * FROM research_requests WHERE status = ? ORDER BY CASE priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 ELSE 2 END, created_at DESC'),
  getResearchRequest: db.prepare('SELECT * FROM research_requests WHERE id = ?'),
  insertResearchRequest: db.prepare(`INSERT INTO research_requests (title, description, status, requesting_agent, department, priority, drive_file_id, drive_url, context, deadline) VALUES (@title, @description, @status, @requesting_agent, @department, @priority, @drive_file_id, @drive_url, @context, @deadline)`),
  updateResearchRequest: db.prepare(`UPDATE research_requests SET title=@title, description=@description, status=@status, requesting_agent=@requesting_agent, department=@department, priority=@priority, drive_file_id=@drive_file_id, drive_url=@drive_url, context=@context, deadline=@deadline, updated_at=datetime('now') WHERE id=@id`),
  updateResearchRequestStatus: db.prepare(`UPDATE research_requests SET status=@status, updated_at=datetime('now') WHERE id=@id`),
  markResearchRequestDone: db.prepare(`UPDATE research_requests SET status='done', drive_file_id=@drive_file_id, drive_url=@drive_url, updated_at=datetime('now') WHERE id=@id`),
  getResearchRequestMessages: db.prepare('SELECT * FROM research_request_messages WHERE request_id = ? ORDER BY created_at ASC'),
  insertResearchRequestMessage: db.prepare('INSERT INTO research_request_messages (request_id, sender, message) VALUES (@request_id, @sender, @message)'),
  getResearchRequestMessageCount: db.prepare('SELECT request_id, COUNT(*) as count FROM research_request_messages WHERE request_id IN (SELECT id FROM research_requests) GROUP BY request_id'),

  vendorSummary: db.prepare(`SELECT 
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
    COUNT(CASE WHEN status = 'pending-approval' THEN 1 END) as pending_count,
    SUM(CASE WHEN billing_cycle = 'monthly' THEN cost_monthly WHEN billing_cycle = 'annual' THEN cost_annual/12 ELSE 0 END) as total_monthly_cost
    FROM vendors`),

  // Token Usage
  getAllTokenUsage: db.prepare('SELECT * FROM token_usage ORDER BY date DESC, agent_id'),
  getTokenUsageByAgent: db.prepare('SELECT * FROM token_usage WHERE agent_id = ? ORDER BY date DESC'),
  getTokenUsageByDate: db.prepare('SELECT * FROM token_usage WHERE date = ? ORDER BY agent_id'),
  getTokenUsageByAgentAndDate: db.prepare('SELECT * FROM token_usage WHERE agent_id = ? AND date = ?'),
  insertTokenUsage: db.prepare(`INSERT INTO token_usage (agent_id, session_key, model, provider, input_tokens, output_tokens, total_tokens, cost_usd, task_type, date) VALUES (@agent_id, @session_key, @model, @provider, @input_tokens, @output_tokens, @total_tokens, @cost_usd, @task_type, @date)`),
  updateTokenUsage: db.prepare(`UPDATE token_usage SET input_tokens=@input_tokens, output_tokens=@output_tokens, total_tokens=@total_tokens, cost_usd=@cost_usd, provider=@provider, model=@model, task_type=@task_type WHERE id=@id`),
  getTokenUsageSummary: db.prepare(`SELECT agent_id, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(cost_usd) as total_cost FROM token_usage GROUP BY agent_id`),
  getDailyTokenUsage: db.prepare(`SELECT date, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(cost_usd) as total_cost FROM token_usage GROUP BY date ORDER BY date DESC`),
  // Today's token usage by agent (for US-006)
  getTodaysTokenUsageByAgent: db.prepare(`SELECT agent_id, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(total_tokens) as total_tokens, SUM(cost_usd) as total_cost FROM token_usage WHERE date = ? GROUP BY agent_id`),
  // Daily token usage by agent for date range (for US-007)
  getDailyTokenUsageByAgent: db.prepare(`SELECT date, input_tokens, output_tokens, total_tokens, cost_usd, provider, model 
    FROM token_usage 
    WHERE agent_id = ? AND date >= ? AND date <= ?
    ORDER BY date DESC`),
  // Provider-aggregated token usage (for US-003)
  getTokenUsageByProvider: db.prepare(`SELECT 
    provider,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_tokens) as total_tokens,
    SUM(cost_usd) as total_cost_usd
    FROM token_usage
    WHERE (? IS NULL OR agent_id = ?)
    AND (? IS NULL OR date >= ?)
    AND (? IS NULL OR date <= ?)
    GROUP BY provider
    ORDER BY total_cost_usd DESC`),
};

function logActivity(type, entityType, entityId, message, actor = 'system') {
  stmts.insertActivity.run({ type, entity_type: entityType, entity_id: entityId, message, actor });
}

module.exports = { db, stmts, logActivity };
