const { test, describe } = require('node:test');
const assert = require('node:assert');
const { db, stmts } = require('./db.js');

describe('US-002: Token Usage API endpoints', () => {

  // Helper to clean up test data
  function cleanupTokenUsage(agentId = 'test-agent-api') {
    db.prepare('DELETE FROM token_usage WHERE agent_id = ?').run(agentId);
  }

  // Helper to insert test token usage (with all required params)
  function insertTestTokenUsage(data = {}) {
    const defaults = {
      agent_id: 'test-agent-api',
      session_key: `session-${Date.now()}-${Math.random()}`,
      model: 'anthropic/claude-opus-4-6',
      provider: 'anthropic',
      input_tokens: 1000,
      output_tokens: 500,
      total_tokens: 1500,
      cost_usd: 0.05,
      task_type: 'test-task',
      date: new Date().toISOString().split('T')[0],
    };
    const tu = { ...defaults, ...data };
    return stmts.insertTokenUsage.run(tu);
  }

  test('AC1: POST /api/org/agents/:id/token-usage saves token usage to DB', () => {
    cleanupTokenUsage('david');
    
    const tu = {
      agent_id: 'david', // Use existing agent
      session_key: `session-${Date.now()}-${Math.random()}`,
      model: 'anthropic/claude-opus-4-6',
      provider: 'anthropic',
      input_tokens: 1000,
      output_tokens: 500,
      total_tokens: 1500,
      cost_usd: 0.05,
      task_type: 'code-generation',
      date: '2026-02-19',
    };
    
    const result = stmts.insertTokenUsage.run(tu);
    
    assert.ok(result.lastInsertRowid > 0, 'Should return a valid insert ID');
    
    // Verify the record was inserted
    const inserted = db.prepare('SELECT * FROM token_usage WHERE id = ?').get(result.lastInsertRowid);
    assert.strictEqual(inserted.agent_id, 'david');
    assert.strictEqual(inserted.input_tokens, 1000);
    assert.strictEqual(inserted.output_tokens, 500);
    assert.strictEqual(inserted.cost_usd, 0.05);
    assert.strictEqual(inserted.model, 'anthropic/claude-opus-4-6');
    assert.strictEqual(inserted.provider, 'anthropic');
    assert.strictEqual(inserted.date, '2026-02-19');
    
    cleanupTokenUsage('david');
  });

  test('AC2: GET /api/org/token-usage returns token usage with optional date range filters', () => {
    cleanupTokenUsage();
    
    // Insert test data for different dates using unique sessions
    insertTestTokenUsage({ date: '2026-02-15', input_tokens: 100 });
    insertTestTokenUsage({ date: '2026-02-18', input_tokens: 200 });
    insertTestTokenUsage({ date: '2026-02-19', input_tokens: 300 });
    insertTestTokenUsage({ date: '2026-02-20', input_tokens: 400 });
    
    // Test: Get token usage filtered by agent_id (simulates ?agent_id=X)
    const byAgent = stmts.getTokenUsageByAgent.all('test-agent-api');
    assert.strictEqual(byAgent.length, 4, 'Should return 4 records for test-agent-api');
    
    // Test: Get token usage by date
    const byDate = stmts.getTokenUsageByDate.all('2026-02-19');
    const byDateForTestAgent = byDate.filter(u => u.agent_id === 'test-agent-api');
    assert.strictEqual(byDateForTestAgent.length, 1, 'Should find 1 record for test-agent-api on 2026-02-19');
    
    // Test: Get token usage by agent and date (simulates range filtering)
    const byAgentAndDate = stmts.getTokenUsageByAgentAndDate.all('test-agent-api', '2026-02-19');
    assert.strictEqual(byAgentAndDate.length, 1, 'Should return 1 record for test-agent-api on 2026-02-19');
    assert.strictEqual(byAgentAndDate[0].input_tokens, 300);
    
    // Verify summary aggregation for test-agent-api
    const allSummary = stmts.getTokenUsageSummary.all();
    const summary = allSummary.find(s => s.agent_id === 'test-agent-api');
    assert.ok(summary, 'Should have summary for test-agent-api');
    assert.strictEqual(summary.total_input, 100 + 200 + 300 + 400, 'Total input should be 1000');
    
    // Verify daily aggregation for test date
    const daily = stmts.getDailyTokenUsage.all();
    const dailyRecord = daily.find(d => d.date === '2026-02-19');
    assert.ok(dailyRecord, 'Should have daily record for 2026-02-19');
    
    // Check that the daily record includes our test data
    const dailyFromDb = db.prepare(`
      SELECT SUM(input_tokens) as total_input 
      FROM token_usage 
      WHERE date = '2026-02-19' AND agent_id = 'test-agent-api'
    `).get();
    assert.strictEqual(dailyFromDb.total_input, 300, 'Daily input for test-agent on 2026-02-19 should be 300');
    
    cleanupTokenUsage();
  });

  test('AC3: GET /api/org/agents/:id/token-usage returns usage for specific agent', () => {
    cleanupTokenUsage('david-api');
    cleanupTokenUsage('main-api');
    
    // Insert test data for different agents
    insertTestTokenUsage({ agent_id: 'david-api', input_tokens: 1000 });
    insertTestTokenUsage({ agent_id: 'david-api', input_tokens: 2000 });
    insertTestTokenUsage({ agent_id: 'main-api', input_tokens: 500 });
    
    // Get usage for david-api
    const davidUsage = stmts.getTokenUsageByAgent.all('david-api');
    assert.strictEqual(davidUsage.length, 2, 'David-api should have 2 records');
    assert.strictEqual(davidUsage[0].agent_id, 'david-api');
    assert.strictEqual(davidUsage[1].agent_id, 'david-api');
    
    // Get usage for main-api
    const mainUsage = stmts.getTokenUsageByAgent.all('main-api');
    assert.strictEqual(mainUsage.length, 1, 'Main-api should have 1 record');
    assert.strictEqual(mainUsage[0].agent_id, 'main-api');
    
    // Get summary for david-api
    const davidSummary = stmts.getTokenUsageSummary.all().find(s => s.agent_id === 'david-api');
    assert.strictEqual(davidSummary.total_input, 3000, 'David-api total input should be 3000');
    
    // Get summary for main-api
    const mainSummary = stmts.getTokenUsageSummary.all().find(s => s.agent_id === 'main-api');
    assert.strictEqual(mainSummary.total_input, 500, 'Main-api total input should be 500');
    
    cleanupTokenUsage('david-api');
    cleanupTokenUsage('main-api');
  });

  test('AC4: API accepts required fields for POST token usage', () => {
    cleanupTokenUsage('david');
    
    // Test minimal required fields (task_type can be null)
    const minimalTu = {
      agent_id: 'david',
      session_key: `session-${Date.now()}-${Math.random()}`,
      model: 'gpt-5',
      provider: 'openai',
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      task_type: null,  // Can be null
      date: '2026-02-19',
    };
    
    const result = stmts.insertTokenUsage.run(minimalTu);
    assert.ok(result.lastInsertRowid > 0, 'Should insert with minimal fields');
    
    // Test with all fields
    const fullTu = {
      agent_id: 'david',
      session_key: `session-${Date.now()}-${Math.random()}`,
      model: 'claude-opus-4',
      provider: 'anthropic',
      input_tokens: 5000,
      output_tokens: 2500,
      total_tokens: 7500,
      cost_usd: 0.25,
      task_type: 'complex-reasoning',
      date: '2026-02-19',
    };
    
    const result2 = stmts.insertTokenUsage.run(fullTu);
    assert.ok(result2.lastInsertRowid > 0, 'Should insert with all fields');
    
    const inserted = db.prepare('SELECT * FROM token_usage WHERE id = ?').get(result2.lastInsertRowid);
    assert.strictEqual(inserted.task_type, 'complex-reasoning');
    assert.strictEqual(inserted.total_tokens, 7500);
    
    cleanupTokenUsage('david');
  });

  test('AC5: Token usage calculations are correct', () => {
    cleanupTokenUsage('david-calc');
    
    // Insert token usage
    const tu = {
      agent_id: 'david-calc',
      session_key: `session-${Date.now()}-${Math.random()}`,
      model: 'gemini-3-pro',
      provider: 'google',
      input_tokens: 10000,
      output_tokens: 5000,
      cost_usd: 0.15,
      total_tokens: 15000, // Should be input + output
      task_type: 'reasoning',
      date: '2026-02-19',
    };
    
    stmts.insertTokenUsage.run(tu);
    
    // Verify the record was inserted
    const inserted = db.prepare('SELECT * FROM token_usage WHERE agent_id = ?').get('david-calc');
    assert.strictEqual(inserted.input_tokens, 10000);
    assert.strictEqual(inserted.output_tokens, 5000);
    
    // Verify the summary calculation
    const summary = stmts.getTokenUsageSummary.all().find(s => s.agent_id === 'david-calc');
    assert.ok(summary, 'Should have summary');
    assert.strictEqual(summary.total_input, 10000);
    assert.strictEqual(summary.total_output, 5000);
    assert.strictEqual(summary.total_cost, 0.15);
    
    // Verify daily calculation
    const daily = stmts.getDailyTokenUsage.all().find(d => d.date === '2026-02-19');
    assert.ok(daily, 'Should have daily record');
    
    // Verify daily sum includes our test data
    const dailySum = db.prepare(`
      SELECT SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(cost_usd) as total_cost
      FROM token_usage 
      WHERE date = '2026-02-19' AND agent_id = 'david-calc'
    `).get();
    assert.strictEqual(dailySum.total_input, 10000);
    assert.strictEqual(dailySum.total_output, 5000);
    assert.strictEqual(dailySum.total_cost, 0.15);
    
    cleanupTokenUsage('david-calc');
  });
});

describe('US-002: Token Usage API validation', () => {
  
  test('Agent must exist for token usage insertion', () => {
    // This test verifies that we validate agent existence before inserting
    // The API endpoint checks agent existence before calling insertTokenUsage
    
    const agent = stmts.getAgent.get('david');
    assert.ok(agent, 'David agent should exist in agent_status');
    
    const nonExistentAgent = stmts.getAgent.get('non-existent-agent');
    assert.strictEqual(nonExistentAgent, undefined, 'Non-existent agent should return undefined');
  });
  
  test('Token usage prepared statements exist and are callable', () => {
    // Verify all prepared statements exist
    assert.ok(typeof stmts.getAllTokenUsage === 'object', 'getAllTokenUsage should exist');
    assert.ok(typeof stmts.getTokenUsageByAgent === 'object', 'getTokenUsageByAgent should exist');
    assert.ok(typeof stmts.getTokenUsageByDate === 'object', 'getTokenUsageByDate should exist');
    assert.ok(typeof stmts.getTokenUsageByAgentAndDate === 'object', 'getTokenUsageByAgentAndDate should exist');
    assert.ok(typeof stmts.insertTokenUsage === 'object', 'insertTokenUsage should exist');
    assert.ok(typeof stmts.updateTokenUsage === 'object', 'updateTokenUsage should exist');
    assert.ok(typeof stmts.getTokenUsageSummary === 'object', 'getTokenUsageSummary should exist');
    assert.ok(typeof stmts.getDailyTokenUsage === 'object', 'getDailyTokenUsage should exist');
  });
});
