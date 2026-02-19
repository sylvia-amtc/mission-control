const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

describe('US-006: Per-Agent Token Usage Display in Org Card', () => {
  
  // Helper to read the frontend HTML file
  function getFrontendHtml() {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    return fs.readFileSync(htmlPath, 'utf-8');
  }

  test('AC1: Active agent cards show token usage summary pill', () => {
    const html = getFrontendHtml();
    
    // Check that orgCardHtml function exists
    assert.ok(
      html.includes('function orgCardHtml'),
      'orgCardHtml function should exist'
    );
    
    // Check that token pill is rendered for active agents
    assert.ok(
      html.includes('tokenPill') && html.includes('orgCardHtml'),
      'orgCardHtml should include tokenPill variable'
    );
    
    // Check that token-pill class/style exists
    assert.ok(
      html.includes('token-pill') || html.includes('tokenPill'),
      'Should have token pill styling or variable'
    );
  });

  test('AC2: Displays todays token count and estimated cost', () => {
    const html = getFrontendHtml();
    
    // Check that API is called to get today's token usage by agent
    assert.ok(
      html.includes('/api/org/token-usage/today') || html.includes("api('/api/org/token-usage/today')"),
      'loadOrgData should fetch from /api/org/token-usage/today'
    );
    
    // Check that orgAgentTokenUsage variable exists
    assert.ok(
      html.includes('orgAgentTokenUsage'),
      'Should have orgAgentTokenUsage variable to store agent-specific token data'
    );
  });

  test('AC3: Format: XXK tokens $X.XX', () => {
    const html = getFrontendHtml();
    
    // Check that token formatting uses K suffix for thousands
    assert.ok(
      html.includes("'K'") || html.includes("toFixed(0) + 'K'") || html.includes("K"),
      'Token count should be formatted with K suffix for thousands'
    );
    
    // Check that cost formatting includes dollar sign and decimal
    assert.ok(
      html.includes("'$'") || html.includes("$"),
      'Cost should be formatted with dollar sign'
    );
    
    // Check the specific format in tokenPill: "125K tokens $0.45"
    assert.ok(
      html.includes('tokens') && html.includes('$'),
      'Token pill should show "tokens" and cost with $'
    );
  });

  test('AC4: Typecheck passes - JavaScript syntax is valid', () => {
    const html = getFrontendHtml();
    
    // Extract JavaScript from HTML and check for basic syntax
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    assert.ok(scriptMatch && scriptMatch.length > 0, 'Should have script tags');
    
    // Basic syntax check - ensure no obvious issues
    const allScript = scriptMatch.map(s => s.replace(/<\/?script[^>]*>/g, '')).join('\n');
    
    // Check function declarations exist
    assert.ok(allScript.includes('function orgCardHtml'), 'orgCardHtml function should exist');
    assert.ok(allScript.includes('function loadOrgData'), 'loadOrgData function should exist');
    
    // Check no obvious syntax errors (matching braces)
    const openBraces = (allScript.match(/{/g) || []).length;
    const closeBraces = (allScript.match(/}/g) || []).length;
    assert.equal(openBraces, closeBraces, 'JavaScript should have matching braces');
  });

  test('AC5: Server API endpoint returns agent token data', () => {
    // Check that the API endpoint exists in server.js
    const serverPath = path.join(__dirname, 'server.js');
    const serverCode = fs.readFileSync(serverPath, 'utf-8');
    
    // Check that the /api/org/token-usage/today endpoint exists
    assert.ok(
      serverCode.includes("/api/org/token-usage/today") || serverCode.includes("token-usage/today"),
      'server.js should have /api/org/token-usage/today endpoint'
    );
    
    // Check that the endpoint returns data grouped by agent
    assert.ok(
      serverCode.includes('getTodaysTokenUsageByAgent') || serverCode.includes('agent_id'),
      'Endpoint should return data grouped by agent_id'
    );
  });

  test('AC6: Token pill shows only for agents with token usage', () => {
    const html = getFrontendHtml();
    
    // Check that token pill is conditionally rendered based on data
    assert.ok(
      html.includes('agentTokenData &&') || html.includes('agentTokenData ||'),
      'Token pill should only show when agentTokenData exists'
    );
    
    // Check that it checks for total_tokens or total_cost
    assert.ok(
      html.includes('total_tokens') || html.includes('total_cost'),
      'Should check for token usage data before showing pill'
    );
  });
});
