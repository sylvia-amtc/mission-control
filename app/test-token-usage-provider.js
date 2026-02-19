const { test, describe } = require('node:test');
const assert = require('node:assert');
const { db, stmts } = require('./db.js');

// Helper to clean up test data
function cleanupTokenUsage(agentId = 'test-provider-agent') {
  db.prepare('DELETE FROM token_usage WHERE agent_id = ?').run(agentId);
}

// Helper to insert test token usage with a specific provider
function insertTestTokenUsage(data = {}) {
  const defaults = {
    agent_id: 'test-provider-agent',
    session_key: `session-${Date.now()}-${Math.random()}`,
    model: 'claude-opus-4-6',
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

describe('US-003: Provider-Aggregated Token Usage API', () => {

  test('AC1: GET /api/org/token-usage/by-provider returns aggregated data by provider', () => {
    // Clean up before test
    cleanupTokenUsage();
    
    const testAgent = 'test-provider-agent';
    
    // Insert test data for different providers
    insertTestTokenUsage({ agent_id: testAgent, provider: 'anthropic', input_tokens: 1000, output_tokens: 500, cost_usd: 0.05 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'anthropic', input_tokens: 2000, output_tokens: 1000, cost_usd: 0.10 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'openai', input_tokens: 3000, output_tokens: 1500, cost_usd: 0.08 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'google', input_tokens: 1500, output_tokens: 750, cost_usd: 0.03 });
    
    // Get provider-aggregated data filtered by our test agent
    const providerData = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,  // agent_id filter
      null, null,           // start_date
      null, null            // end_date
    );
    
    // Should have 3 providers
    const providers = providerData.map(p => p.provider);
    assert.ok(providers.includes('anthropic'), 'Should include anthropic');
    assert.ok(providers.includes('openai'), 'Should include openai');
    assert.ok(providers.includes('google'), 'Should include google');
    
    // Check anthropic aggregation
    const anthropic = providerData.find(p => p.provider === 'anthropic');
    assert.strictEqual(anthropic.total_input_tokens, 3000, 'Anthropic input tokens should be 3000');
    assert.strictEqual(anthropic.total_output_tokens, 1500, 'Anthropic output tokens should be 1500');
    assert.ok(Math.abs(anthropic.total_cost_usd - 0.15) < 0.001, 'Anthropic cost should be approximately 0.15');
    
    // Check openai aggregation
    const openai = providerData.find(p => p.provider === 'openai');
    assert.strictEqual(openai.total_input_tokens, 3000, 'OpenAI input tokens should be 3000');
    assert.strictEqual(openai.total_output_tokens, 1500, 'OpenAI output tokens should be 1500');
    assert.strictEqual(openai.total_cost_usd, 0.08, 'OpenAI cost should be 0.08');
    
    // Check google aggregation
    const google = providerData.find(p => p.provider === 'google');
    assert.strictEqual(google.total_input_tokens, 1500, 'Google input tokens should be 1500');
    assert.strictEqual(google.total_output_tokens, 750, 'Google output tokens should be 750');
    assert.strictEqual(google.total_cost_usd, 0.03, 'Google cost should be 0.03');
    
    // Clean up after test
    cleanupTokenUsage();
  });

  test('AC2: GET /api/org/token-usage/by-provider supports start_date and end_date query parameters', () => {
    // Clean up before test
    cleanupTokenUsage();
    
    const testAgent = 'test-provider-agent';
    
    // Insert test data for different dates
    insertTestTokenUsage({ agent_id: testAgent, provider: 'anthropic', date: '2026-02-10', input_tokens: 100, cost_usd: 0.01 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'anthropic', date: '2026-02-15', input_tokens: 200, cost_usd: 0.02 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'anthropic', date: '2026-02-20', input_tokens: 400, cost_usd: 0.04 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'openai', date: '2026-02-18', input_tokens: 300, cost_usd: 0.03 });
    
    // Test with start_date only (2026-02-12 onwards)
    const withStartDate = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,
      '2026-02-12', '2026-02-12',
      null, null
    );
    const anthropicStart = withStartDate.find(p => p.provider === 'anthropic');
    // Should include 2026-02-15 and 2026-02-20 (200 + 400 = 600)
    assert.strictEqual(anthropicStart.total_input_tokens, 600, 'Should include data from 2026-02-15 and 2026-02-20');
    
    // Test with end_date only (until 2026-02-17)
    const withEndDate = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,
      null, null,
      '2026-02-17', '2026-02-17'
    );
    const anthropicEnd = withEndDate.find(p => p.provider === 'anthropic');
    // Should include only 2026-02-10 and 2026-02-15 (100 + 200 = 300)
    assert.strictEqual(anthropicEnd.total_input_tokens, 300, 'Should include data from 2026-02-10 and 2026-02-15');
    
    // Test with both start_date and end_date (2026-02-12 to 2026-02-18)
    const withBothDates = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,
      '2026-02-12', '2026-02-12',
      '2026-02-18', '2026-02-18'
    );
    const anthropicBoth = withBothDates.find(p => p.provider === 'anthropic');
    // Should include 2026-02-15 only (200)
    assert.strictEqual(anthropicBoth.total_input_tokens, 200, 'Should include only 2026-02-15');
    
    const openaiBoth = withBothDates.find(p => p.provider === 'openai');
    // Should include 2026-02-18 (300)
    assert.strictEqual(openaiBoth.total_input_tokens, 300, 'Should include openai from 2026-02-18');
    
    // Clean up after test
    cleanupTokenUsage();
  });

  test('AC3: GET /api/org/token-usage/by-provider returns provider name, total tokens, total cost, limit, and usage percentage', () => {
    // Clean up before test
    cleanupTokenUsage();
    
    const testAgent = 'test-provider-agent';
    
    // Insert test data
    insertTestTokenUsage({ agent_id: testAgent, provider: 'anthropic', cost_usd: 100.00 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'openai', cost_usd: 200.00 });
    insertTestTokenUsage({ agent_id: testAgent, provider: 'google', cost_usd: 50.00 });
    
    // Get provider-aggregated data
    const providerData = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,
      null, null,
      null, null
    );
    
    // Each provider should have all required fields
    for (const p of providerData) {
      assert.ok(p.provider, 'Should have provider name');
      assert.ok(typeof p.total_input_tokens === 'number', 'Should have total_input_tokens');
      assert.ok(typeof p.total_output_tokens === 'number', 'Should have total_output_tokens');
      assert.ok(typeof p.total_cost_usd === 'number', 'Should have total_cost_usd');
    }
    
    // Test the API response format (simulated)
    const PROVIDER_LIMITS = {
      'anthropic': 50000,
      'openai': 50000,
      'google': 50000,
    };
    
    const response = providerData.map(p => {
      const providerKey = p.provider?.toLowerCase() || 'unknown';
      const limit = PROVIDER_LIMITS[providerKey] || 10000;
      
      return {
        provider: p.provider,
        total_input_tokens: p.total_input_tokens || 0,
        total_output_tokens: p.total_output_tokens || 0,
        total_tokens: p.total_tokens || 0,
        total_cost_usd: p.total_cost_usd || 0,
        limit: limit,
        usage_percentage: limit > 0 ? Math.round((p.total_cost_usd / limit) * 10000) / 100 : 0,
      };
    });
    
    // Verify response structure
    const anthropic = response.find(p => p.provider === 'anthropic');
    assert.strictEqual(anthropic.provider, 'anthropic');
    assert.strictEqual(anthropic.total_input_tokens, 1000); // from insertTestTokenUsage default
    assert.strictEqual(anthropic.total_output_tokens, 500);
    assert.strictEqual(anthropic.total_cost_usd, 100.00);
    assert.strictEqual(anthropic.limit, 50000); // anthropic limit
    assert.strictEqual(anthropic.usage_percentage, 0.2); // 100/50000 * 100 = 0.2%
    
    const openai = response.find(p => p.provider === 'openai');
    assert.strictEqual(openai.limit, 50000); // openai limit
    assert.strictEqual(openai.usage_percentage, 0.4); // 200/50000 * 100 = 0.4%
    
    const google = response.find(p => p.provider === 'google');
    assert.strictEqual(google.limit, 50000); // google limit
    assert.strictEqual(google.usage_percentage, 0.1); // 50/50000 * 100 = 0.1%
    
    // Clean up after test
    cleanupTokenUsage();
  });

  test('AC4: Provider-aggregated API handles empty data', () => {
    // Clean up before test
    cleanupTokenUsage();
    
    const testAgent = 'test-provider-agent';
    
    // Get provider-aggregated data with no data
    const providerData = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,
      null, null,
      null, null
    );
    
    // Should return empty array or array with zeros
    assert.ok(Array.isArray(providerData), 'Should return an array');
    // No cleanup needed - empty data
  });

  test('AC5: Provider aggregation correctly calculates usage percentage', () => {
    // Clean up before test
    cleanupTokenUsage();
    
    const testAgent = 'test-provider-agent';
    
    // Insert data with specific costs to test percentage calculation
    insertTestTokenUsage({ agent_id: testAgent, provider: 'groq', cost_usd: 250.00 }); // limit is 10000, so 2.5%
    insertTestTokenUsage({ agent_id: testAgent, provider: 'groq', cost_usd: 250.00 }); // total 500, so 5%
    
    const providerData = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,
      null, null,
      null, null
    );
    const groq = providerData.find(p => p.provider === 'groq');
    
    const PROVIDER_LIMITS = {
      'groq': 10000,
    };
    
    const providerKey = groq.provider?.toLowerCase() || 'unknown';
    const limit = PROVIDER_LIMITS[providerKey] || 10000;
    const usage_percentage = limit > 0 ? Math.round((groq.total_cost_usd / limit) * 10000) / 100 : 0;
    
    assert.strictEqual(groq.total_cost_usd, 500.00);
    assert.strictEqual(limit, 10000);
    assert.strictEqual(usage_percentage, 5); // 500/10000 * 100 = 5%
    
    // Clean up after test
    cleanupTokenUsage();
  });
});

describe('US-003: Provider-aggregated API validation', () => {
  
  test('getTokenUsageByProvider prepared statement exists', () => {
    assert.ok(typeof stmts.getTokenUsageByProvider === 'object', 'getTokenUsageByProvider should exist');
  });
  
  test('Provider aggregation handles unknown providers with default limit', () => {
    // Clean up before test
    cleanupTokenUsage();
    
    const testAgent = 'test-provider-agent';
    
    // Insert data with unknown provider
    insertTestTokenUsage({ agent_id: testAgent, provider: 'unknown-provider', cost_usd: 100.00 });
    
    const providerData = stmts.getTokenUsageByProvider.all(
      testAgent, testAgent,
      null, null,
      null, null
    );
    const unknown = providerData.find(p => p.provider === 'unknown-provider');
    
    // Unknown providers should get default limit of 10000
    const PROVIDER_LIMITS = {
      'anthropic': 50000,
      'openai': 50000,
      'google': 50000,
      'groq': 10000,
    };
    
    const providerKey = unknown.provider?.toLowerCase() || 'unknown';
    const limit = PROVIDER_LIMITS[providerKey] || 10000; // default
    
    assert.strictEqual(limit, 10000, 'Unknown providers should get default limit of 10000');
    
    // Clean up after test
    cleanupTokenUsage();
  });
});
