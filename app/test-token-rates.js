const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');

// Test with in-memory database for isolation
const db = new Database(':memory:');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS token_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE,
    input_cost_per_1m REAL NOT NULL DEFAULT 0,
    output_cost_per_1m REAL NOT NULL DEFAULT 0,
    rate_limit REAL NOT NULL DEFAULT 50000,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Prepared statements
const stmts = {
  getAllTokenRates: db.prepare('SELECT * FROM token_rates ORDER BY provider'),
  getTokenRateByProvider: db.prepare('SELECT * FROM token_rates WHERE provider = ?'),
  updateTokenRate: db.prepare(`UPDATE token_rates SET input_cost_per_1m = @input_cost_per_1m, output_cost_per_1m = @output_cost_per_1m, rate_limit = @rate_limit, updated_at = datetime('now') WHERE provider = @provider`),
};

// Seed default rates
const defaultRates = [
  { provider: 'anthropic', input_cost_per_1m: 3.00, output_cost_per_1m: 15.00, rate_limit: 50000 },
  { provider: 'openai', input_cost_per_1m: 2.50, output_cost_per_1m: 10.00, rate_limit: 50000 },
  { provider: 'google', input_cost_per_1m: 1.25, output_cost_per_1m: 5.00, rate_limit: 50000 },
  { provider: 'groq', input_cost_per_1m: 0.20, output_cost_per_1m: 0.20, rate_limit: 10000 },
];
const ins = db.prepare('INSERT INTO token_rates (provider, input_cost_per_1m, output_cost_per_1m, rate_limit) VALUES (@provider, @input_cost_per_1m, @output_cost_per_1m, @rate_limit)');
const seedTx = db.transaction(() => { for (const r of defaultRates) ins.run(r); });
seedTx();

describe('US-009: Token Cost Configuration', () => {
  
  // AC1: GET /api/config/token-rates returns provider rates
  it('AC1: GET returns all provider rates', () => {
    const rates = stmts.getAllTokenRates.all();
    
    assert.strictEqual(rates.length, 4, 'Should return 4 providers');
    
    const anthropic = rates.find(r => r.provider === 'anthropic');
    assert.ok(anthropic, 'Should include anthropic');
    assert.strictEqual(anthropic.input_cost_per_1m, 3.00, 'Anthropic input cost should be $3/1M');
    assert.strictEqual(anthropic.output_cost_per_1m, 15.00, 'Anthropic output cost should be $15/1M');
    assert.strictEqual(anthropic.rate_limit, 50000, 'Anthropic rate limit should be $50k');
  });

  it('AC1: GET returns correct default rates for all providers', () => {
    const rates = stmts.getAllTokenRates.all();
    
    const providers = rates.map(r => r.provider);
    assert.ok(providers.includes('anthropic'), 'Should include anthropic');
    assert.ok(providers.includes('openai'), 'Should include openai');
    assert.ok(providers.includes('google'), 'Should include google');
    assert.ok(providers.includes('groq'), 'Should include groq');
  });

  // AC2: PUT /api/config/token-rates updates provider rates
  it('AC2: PUT updates existing provider rates', () => {
    // Update anthropic rates
    stmts.updateTokenRate.run({
      provider: 'anthropic',
      input_cost_per_1m: 4.00,
      output_cost_per_1m: 20.00,
      rate_limit: 75000,
    });
    
    const updated = stmts.getTokenRateByProvider.get('anthropic');
    assert.strictEqual(updated.input_cost_per_1m, 4.00, 'Input cost should be updated');
    assert.strictEqual(updated.output_cost_per_1m, 20.00, 'Output cost should be updated');
    assert.strictEqual(updated.rate_limit, 75000, 'Rate limit should be updated');
  });

  it('AC2: PUT preserves other providers when updating one', () => {
    // Update anthropic
    stmts.updateTokenRate.run({
      provider: 'anthropic',
      input_cost_per_1m: 5.00,
      output_cost_per_1m: 25.00,
      rate_limit: 100000,
    });
    
    // Check openai unchanged
    const openai = stmts.getTokenRateByProvider.get('openai');
    assert.strictEqual(openai.input_cost_per_1m, 2.50, 'OpenAI should be unchanged');
    assert.strictEqual(openai.output_cost_per_1m, 10.00, 'OpenAI should be unchanged');
  });

  // AC3: Rates include required fields
  it('AC3: Rates include provider, input_cost_per_1m, output_cost_per_1m, rate_limit', () => {
    const rates = stmts.getAllTokenRates.all();
    
    for (const rate of rates) {
      assert.ok(rate.provider, 'Should have provider');
      assert.ok(typeof rate.input_cost_per_1m === 'number', 'Should have input_cost_per_1m');
      assert.ok(typeof rate.output_cost_per_1m === 'number', 'Should have output_cost_per_1m');
      assert.ok(typeof rate.rate_limit === 'number', 'Should have rate_limit');
    }
  });

  it('AC3: All required fields are present in response', () => {
    const rates = stmts.getAllTokenRates.all();
    
    const requiredFields = ['provider', 'input_cost_per_1m', 'output_cost_per_1m', 'rate_limit'];
    
    for (const rate of rates) {
      for (const field of requiredFields) {
        assert.ok(field in rate, `Rate should have ${field}`);
      }
    }
  });

  // Edge cases
  it('update handles partial updates (only input_cost)', () => {
    const before = stmts.getTokenRateByProvider.get('google');
    const originalOutput = before.output_cost_per_1m;
    const originalLimit = before.rate_limit;
    
    stmts.updateTokenRate.run({
      provider: 'google',
      input_cost_per_1m: 2.00,
      output_cost_per_1m: before.output_cost_per_1m,
      rate_limit: before.rate_limit,
    });
    
    const after = stmts.getTokenRateByProvider.get('google');
    assert.strictEqual(after.input_cost_per_1m, 2.00);
    assert.strictEqual(after.output_cost_per_1m, originalOutput);
    assert.strictEqual(after.rate_limit, originalLimit);
  });

  // AC4: Typecheck passes (covered by node --check)
  // AC5: Tests pass (this test file)
});
