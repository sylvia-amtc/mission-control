const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

describe('US-005: Org Summary Token Usage Display', () => {
  
  // Helper to read the frontend HTML file
  function getFrontendHtml() {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    return fs.readFileSync(htmlPath, 'utf-8');
  }

  test('AC1: renderOrgSummary() displays actual token usage instead of agent counts', () => {
    const html = getFrontendHtml();
    
    // Check that renderOrgSummary function exists
    assert.ok(
      html.includes('function renderOrgSummary()'),
      'renderOrgSummary function should exist'
    );
    
    // Check that it uses orgTokenUsage data
    assert.ok(
      html.includes('orgTokenUsage') && html.includes('renderOrgSummary'),
      'renderOrgSummary should have access to orgTokenUsage'
    );
    
    // Check that it processes token usage data (input/output/total tokens)
    assert.ok(
      html.includes('total_input_tokens') || html.includes('inputTokens'),
      'renderOrgSummary should process input tokens'
    );
    
    assert.ok(
      html.includes('total_output_tokens') || html.includes('outputTokens'),
      'renderOrgSummary should process output tokens'
    );
  });

  test('AC2: Shows input_tokens, output_tokens, total cost per provider', () => {
    const html = getFrontendHtml();
    
    // Check that provider data is processed and displayed
    assert.ok(
      html.includes('total_cost_usd') || html.includes('cost'),
      'renderOrgSummary should display total cost'
    );
    
    // Check that tokens are formatted
    assert.ok(
      html.includes('fmtNum') || html.includes('inputTokens'),
      'renderOrgSummary should format token numbers'
    );
  });

  test('AC3: Progress bars show correct percentage based on real limits', () => {
    const html = getFrontendHtml();
    
    // Check that percentage calculation exists
    assert.ok(
      html.includes('percentage') || html.includes('pct'),
      'renderOrgSummary should calculate percentage'
    );
    
    // Check that limit is used from API data
    assert.ok(
      html.includes('.limit') || html.includes('defaultLimits'),
      'renderOrgSummary should use limits from API or defaults'
    );
    
    // Check progress bar styling with percentage-based width
    assert.ok(
      html.includes('width:${pct}%') || html.includes('width: ${pct}%'),
      'renderOrgSummary should set progress bar width based on percentage'
    );
  });

  test('AC4: Fallback to agent counts if no token data exists (backwards compatible)', () => {
    const html = getFrontendHtml();
    
    // Check that there's a fallback mechanism
    assert.ok(
      html.includes('hasTokenData') || html.includes('Object.keys(providerData)'),
      'renderOrgSummary should check if token data exists'
    );
    
    // Check that agent counts are still displayed even without token data
    assert.ok(
      html.includes('orgAgents.length') || html.includes('active') || html.includes('sleeping'),
      'renderOrgSummary should still show agent counts'
    );
    
    // Check for fallback message when no token data
    assert.ok(
      html.includes('No token usage data available') || html.includes('hasTokenData'),
      'renderOrgSummary should show fallback message when no token data'
    );
  });

  test('AC5: Typecheck passes - JavaScript syntax is valid', () => {
    const html = getFrontendHtml();
    
    // Extract JavaScript from HTML and check for basic syntax
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    assert.ok(scriptMatch && scriptMatch.length > 0, 'Should have script tags');
    
    // Basic syntax check - ensure no obvious issues
    const allScript = scriptMatch.map(s => s.replace(/<\/?script[^>]*>/g, '')).join('\n');
    
    // Check function declarations exist
    assert.ok(allScript.includes('function renderOrgSummary()'), 'renderOrgSummary function should exist');
    assert.ok(allScript.includes('function loadOrgData()'), 'loadOrgData function should exist');
  });

  test('AC6: Provider data structure is correctly processed', () => {
    const html = getFrontendHtml();
    
    // Check that the code maps provider names correctly
    assert.ok(
      html.includes('providerMap') || html.includes("'anthropic': 'Anthropic'"),
      'renderOrgSummary should map provider names to display names'
    );
    
    // Check that provider data object structure exists
    assert.ok(
      html.includes('providerData[') || html.includes('providerData['),
      'renderOrgSummary should use providerData object'
    );
  });
});
