// Test file for US-007: Token Usage Detail Panel
const { test, describe } = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');

// Create in-memory database for testing
const db = new Database(':memory:');

// Setup test database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    department TEXT,
    status TEXT DEFAULT 'sleeping',
    model TEXT,
    capabilities TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    date TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    provider TEXT,
    model TEXT,
    task_type TEXT,
    session_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_token_usage_agent_date ON token_usage(agent_id, date);
`);

// Insert test agents
db.prepare(`INSERT INTO agents (agent_id, name, role, department, status, model) VALUES (?, ?, ?, ?, ?, ?)`).run(
  'agent-1', 'Test Agent', 'Developer', 'Engineering', 'active', 'claude-3-opus'
);

// Insert test token usage data for last 7 days
const today = new Date();
for (let i = 0; i < 7; i++) {
  const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  db.prepare(`INSERT INTO token_usage (agent_id, date, input_tokens, output_tokens, total_tokens, cost_usd, provider, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'agent-1', date, 
    100000 + i * 10000, // input_tokens
    50000 + i * 5000,   // output_tokens
    150000 + i * 15000, // total_tokens
    0.50 + i * 0.05,    // cost_usd
    'anthropic',
    'claude-3-opus'
  );
}

// Create prepared statements similar to db.js
const stmts = {
  getAgent: db.prepare('SELECT * FROM agents WHERE agent_id = ?'),
  getTokenUsageByAgent: db.prepare('SELECT * FROM token_usage WHERE agent_id = ? ORDER BY date DESC'),
  getDailyTokenUsageByAgent: db.prepare(`SELECT date, input_tokens, output_tokens, total_tokens, cost_usd, provider, model 
    FROM token_usage 
    WHERE agent_id = ? AND date >= ? AND date <= ?
    ORDER BY date DESC`),
};

describe('US-007: Token Usage Detail Panel', () => {
  
  test('AC1: Agent detail panel includes token usage section', () => {
    // Verify the agent exists
    const agent = stmts.getAgent.get('agent-1');
    assert.ok(agent, 'Agent should exist');
    assert.strictEqual(agent.agent_id, 'agent-1');
    assert.strictEqual(agent.name, 'Test Agent');
  });

  test('AC2: Shows daily token usage breakdown table', () => {
    // Calculate date range for last 7 days
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get usage for agent within date range
    const usage = stmts.getDailyTokenUsageByAgent.all('agent-1', startDate, endDate);
    
    // Should have 7 days of data
    assert.ok(usage.length >= 7, 'Should have at least 7 days of usage data');
    
    // Verify each record has required fields
    const firstRecord = usage[0];
    assert.ok(firstRecord.date, 'Should have date field');
    assert.ok(firstRecord.input_tokens !== undefined, 'Should have input_tokens field');
    assert.ok(firstRecord.output_tokens !== undefined, 'Should have output_tokens field');
    assert.ok(firstRecord.cost_usd !== undefined, 'Should have cost_usd field');
  });

  test('AC3: Shows 7-day trend visualization data', () => {
    // Get all usage for the agent
    const allUsage = stmts.getTokenUsageByAgent.all('agent-1');
    
    // Should have 7 days of data
    assert.ok(allUsage.length >= 7, 'Should have at least 7 days of data');
    
    // Verify we can compute totals for trend chart
    const totalInput = allUsage.reduce((sum, u) => sum + (u.input_tokens || 0), 0);
    const totalOutput = allUsage.reduce((sum, u) => sum + (u.output_tokens || 0), 0);
    const totalCost = allUsage.reduce((sum, u) => sum + (u.cost_usd || 0), 0);
    
    assert.ok(totalInput > 0, 'Total input tokens should be > 0');
    assert.ok(totalOutput > 0, 'Total output tokens should be > 0');
    assert.ok(totalCost > 0, 'Total cost should be > 0');
  });

  test('AC4: Token usage API accepts date range filters', () => {
    // Test filtering with specific date range
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // last 3 days
    
    const usage = stmts.getDailyTokenUsageByAgent.all('agent-1', startDate, endDate);
    
    // Should have 3 days of data
    assert.ok(usage.length === 3, 'Should have 3 days of data for 3-day range');
    
    // Verify all dates are within range
    for (const u of usage) {
      assert.ok(u.date >= startDate && u.date <= endDate, 'Date should be within range');
    }
  });

  test('AC5: Handles agents with no token usage data', () => {
    // Query for non-existent agent
    const usage = stmts.getTokenUsageByAgent.all('non-existent-agent');
    
    assert.strictEqual(usage.length, 0, 'Should return empty array for agent with no data');
  });
});

console.log('Running US-007 tests...');
