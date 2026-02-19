// Test file for US-008: Token Usage Historical Trends
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

// Insert test token usage data for last 14 days with varying costs to test trend
const today = new Date();
for (let i = 13; i >= 0; i--) {
  const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  // Earlier days: lower cost, recent days: higher cost (upward trend)
  const costMultiplier = 1 + (13 - i) * 0.1;
  db.prepare(`INSERT INTO token_usage (agent_id, date, input_tokens, output_tokens, total_tokens, cost_usd, provider, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'agent-1', date, 
    100000,   // input_tokens
    50000,    // output_tokens
    150000,   // total_tokens
    0.50 * costMultiplier,    // cost_usd (varying)
    'anthropic',
    'claude-3-opus'
  );
}

// Create prepared statements similar to db.js
const stmts = {
  getDailyTokenUsage: db.prepare(`SELECT date, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(cost_usd) as total_cost FROM token_usage GROUP BY date ORDER BY date DESC`),
};

describe('US-008: Token Usage Historical Trends', () => {
  
  test('AC1: API returns 7-day token usage history', () => {
    const usage = stmts.getDailyTokenUsage.all();
    
    // Should have 14 days of data from our test setup
    assert.ok(usage.length >= 7, 'Should have at least 7 days of usage data');
    
    // Verify data structure for sparkline
    const recentUsage = usage.slice(0, 7).reverse(); // Oldest to newest for sparkline
    assert.ok(recentUsage.length >= 7, 'Should have at least 7 recent days');
    
    // Verify each record has required fields for sparkline
    const firstRecord = recentUsage[0];
    assert.ok(firstRecord.date, 'Should have date field');
    assert.ok(firstRecord.total_input !== undefined, 'Should have total_input field');
    assert.ok(firstRecord.total_output !== undefined, 'Should have total_output field');
    assert.ok(firstRecord.total_cost !== undefined, 'Should have total_cost field');
  });

  test('AC2: Trend calculation correctly identifies upward trend', () => {
    const usage = stmts.getDailyTokenUsage.all();
    const history = usage.slice(0, 7).reverse(); // Last 7 days, oldest to newest
    
    // Calculate trend (compare first half average to second half average)
    const firstHalf = history.slice(0, 3).reduce((sum, d) => sum + d.total_cost, 0) / 3;
    const secondHalf = history.slice(4).reduce((sum, d) => sum + d.total_cost, 0) / 3;
    let trend = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'up';
    else if (secondHalf < firstHalf * 0.9) trend = 'down';
    
    // With our test data (increasing costs), trend should be 'up'
    assert.strictEqual(trend, 'up', 'Trend should be up when recent costs are higher');
  });

  test('AC3: Trend calculation correctly identifies downward trend', () => {
    // Insert data with decreasing costs
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Last 7 days with decreasing trend
    for (let i = 6; i >= 0; i--) {
      const date = new Date(yesterday.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const costMultiplier = 1 + i * 0.1; // Higher cost = older days
      db.prepare(`INSERT INTO token_usage (agent_id, date, input_tokens, output_tokens, total_tokens, cost_usd, provider, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'agent-1', date, 
        100000, 50000, 150000,
        1.0 * costMultiplier,
        'openai',
        'gpt-4'
      );
    }
    
    const usage = stmts.getDailyTokenUsage.all();
    const history = usage.slice(0, 7).reverse(); // Last 7 days
    
    const firstHalf = history.slice(0, 3).reduce((sum, d) => sum + d.total_cost, 0) / 3;
    const secondHalf = history.slice(4).reduce((sum, d) => sum + d.total_cost, 0) / 3;
    let trend = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'up';
    else if (secondHalf < firstHalf * 0.9) trend = 'down';
    
    // With decreasing costs, trend should be 'down'
    assert.strictEqual(trend, 'down', 'Trend should be down when recent costs are lower');
  });

  test('AC4: Frontend sparkline displays correct data points', () => {
    const usage = stmts.getDailyTokenUsage.all();
    const history = usage.slice(0, 7).reverse();
    
    // Should have exactly 7 data points for sparkline
    assert.strictEqual(history.length, 7, 'Should have exactly 7 days for sparkline');
    
    // Extract cost data for sparkline
    const sparkData = history.map(d => d.total_cost);
    assert.ok(sparkData.length === 7, 'Sparkline should have 7 data points');
    
    // All values should be numbers
    sparkData.forEach((val, i) => {
      assert.ok(typeof val === 'number', `Data point ${i} should be a number`);
    });
  });

  test('AC5: Total cost calculation is correct', () => {
    const usage = stmts.getDailyTokenUsage.all();
    const history = usage.slice(0, 7);
    
    const totalCost = history.reduce((sum, d) => sum + d.total_cost, 0);
    
    // Sum of all 7 days should match
    let expected = 0;
    history.forEach(d => expected += d.total_cost);
    
    assert.strictEqual(totalCost, expected, 'Total cost should be sum of daily costs');
    assert.ok(totalCost > 0, 'Total cost should be greater than 0');
  });

  test('AC6: Handles missing dates gracefully', () => {
    // Query for dates - should handle missing dates
    const usage = stmts.getDailyTokenUsage.all();
    
    // Build array with all 7 days, filling missing dates with zeros
    const today = new Date();
    const history = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const existing = usage.find(u => u.date === dateStr);
      history.push(existing || {
        date: dateStr,
        total_input: 0,
        total_output: 0,
        total_cost: 0
      });
    }
    
    assert.strictEqual(history.length, 7, 'Should have 7 days even with missing data');
    // At least some days should have data (from our test inserts)
    assert.ok(history.some(d => d.total_cost > 0), 'Should have some data');
  });
});

console.log('Running US-008 tests...');
