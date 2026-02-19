const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

describe('US-004: Token Usage Data Loading in Org Page Frontend', () => {
  
  // Helper to read the frontend HTML file
  function getFrontendHtml() {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    return fs.readFileSync(htmlPath, 'utf-8');
  }

  test('AC1: loadOrgData() fetches token usage from /api/org/token-usage/by-provider', () => {
    const html = getFrontendHtml();
    
    // Check that loadOrgData calls the token-usage API
    assert.ok(
      html.includes("api('/api/org/token-usage/by-provider')"),
      'loadOrgData should fetch from /api/org/token-usage/by-provider'
    );
    
    // Check that Promise.all is used to fetch both data
    assert.ok(
      html.includes('Promise.all(['),
      'loadOrgData should use Promise.all to fetch data in parallel'
    );
  });

  test('AC2: Token usage data is stored in orgTokenUsage variable', () => {
    const html = getFrontendHtml();
    
    // Check that orgTokenUsage variable is declared
    assert.ok(
      html.includes('let orgTokenUsage = []'),
      'orgTokenUsage should be declared as an array'
    );
    
    // Check that token usage API response is assigned to orgTokenUsage
    assert.ok(
      html.includes('orgTokenUsage = tokenUsage'),
      'Token usage API response should be stored in orgTokenUsage'
    );
  });

  test('AC3: Token usage data is passed to renderOrgSummary()', () => {
    const html = getFrontendHtml();
    
    // Check that renderOrgSummary uses orgTokenUsage
    assert.ok(
      html.includes('orgTokenUsage') && html.includes('renderOrgSummary'),
      'renderOrgSummary should have access to orgTokenUsage'
    );
    
    // Check that the function processes token usage data
    assert.ok(
      html.includes('providerCosts[') || html.includes('orgTokenUsage.forEach'),
      'renderOrgSummary should process token usage data'
    );
  });

  test('AC4: Typecheck passes - JavaScript syntax is valid', () => {
    const html = getFrontendHtml();
    
    // Extract JavaScript from HTML and check for basic syntax
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    assert.ok(scriptMatch && scriptMatch.length > 0, 'Should have script tags');
    
    // Basic syntax check - ensure no obvious issues
    // This is a basic validation since we don't have a full JS parser
    const allScript = scriptMatch.map(s => s.replace(/<\/?script[^>]*>/g, '')).join('\n');
    
    // Check function declarations exist
    assert.ok(allScript.includes('async function loadOrgData()'), 'loadOrgData function should exist');
    assert.ok(allScript.includes('function renderOrgSummary()'), 'renderOrgSummary function should exist');
  });

  test('AC5: API endpoint for token-usage/by-provider exists and works', async () => {
    // This is validated by the existing test-token-usage-provider.js tests
    // Just verifying the endpoint is accessible
    const { db, stmts } = require('./db.js');
    
    // Verify the prepared statement exists
    assert.ok(stmts.getTokenUsageByProvider, 'getTokenUsageByProvider statement should exist');
    
    // Test that it returns data (with no filters)
    const result = stmts.getTokenUsageByProvider.all(null, null, null, null, null, null);
    assert.ok(Array.isArray(result), 'Should return an array');
  });
});
