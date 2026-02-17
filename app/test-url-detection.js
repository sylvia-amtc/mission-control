const http = require('http');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe('US-004: Add Page Load URL Detection', () => {
  const baseUrl = 'http://localhost:3000';
  
  const fetchHTML = (path) => {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, html: data }));
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Request timeout')));
    });
  };

  it('should have initializeFromURL function defined', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that initializeFromURL function is defined
    assert(response.html.includes('function initializeFromURL() {'), 
           'initializeFromURL function should be defined');
    assert(response.html.includes('const currentPath = window.location.pathname;'), 
           'initializeFromURL should read current pathname');
    assert(response.html.includes('const path = currentPath === \'/\' ? \'/dashboard\' : currentPath;'), 
           'initializeFromURL should handle default route (/) to show dashboard');
    assert(response.html.includes('navigateToRoute(path, false);'), 
           'initializeFromURL should call navigateToRoute with processed path');
  });

  it('should call initializeFromURL on page load', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that initializeFromURL is called in init section
    assert(response.html.includes('initializeFromURL(); // Initialize from URL to show correct page on load'), 
           'initializeFromURL should be called on page load');
  });

  it('should detect /dashboard URL and show dashboard section', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that the dashboard route is mapped correctly
    assert(response.html.includes("'/dashboard': 'command'"), 
           'Dashboard route should map to command section');
    
    // Verify the HTML structure exists for dashboard detection
    assert(response.html.includes('id="sec-command"'), 
           'Dashboard section should exist in HTML');
  });

  it('should detect /kanban URL and show kanban board', async () => {
    const response = await fetchHTML('/kanban');
    assert.strictEqual(response.status, 200);
    
    // Check that the kanban route is mapped correctly
    assert(response.html.includes("'/kanban': 'kanban'"), 
           'Kanban route should map to kanban section');
    
    // Verify the HTML structure exists for kanban detection
    assert(response.html.includes('id="sec-kanban"'), 
           'Kanban section should exist in HTML');
  });

  it('should detect /actions URL and show action items', async () => {
    const response = await fetchHTML('/actions');
    assert.strictEqual(response.status, 200);
    
    // Check that the actions route is mapped correctly
    assert(response.html.includes("'/actions': 'actions'"), 
           'Actions route should map to actions section');
    
    // Verify the HTML structure exists for actions detection
    assert(response.html.includes('id="sec-actions"'), 
           'Actions section should exist in HTML');
  });

  it('should default to dashboard for root path (/)', async () => {
    const response = await fetchHTML('/');
    assert.strictEqual(response.status, 200);
    
    // Check that initializeFromURL handles root path properly
    assert(response.html.includes('const path = currentPath === \'/\' ? \'/dashboard\' : currentPath;'), 
           'initializeFromURL should convert "/" to "/dashboard"');
    
    // Check default route handling in navigateToRoute
    assert(response.html.includes('section = \'command\';'), 
           'navigateToRoute should set section to command for dashboard');
    assert(response.html.includes('path = \'/dashboard\';'), 
           'navigateToRoute should set path to /dashboard for unmapped routes');
  });

  it('should preserve current section on page refresh', async () => {
    // Test multiple different URLs to ensure they all return the SPA with routing capability
    const testUrls = ['/dashboard', '/kanban', '/actions', '/gantt', '/calendar', '/org'];
    
    for (const url of testUrls) {
      const response = await fetchHTML(url);
      assert.strictEqual(response.status, 200, `${url} should return 200 status`);
      
      // Each URL should return the same SPA with routing functionality
      assert(response.html.includes('function initializeFromURL()'), 
             `${url} should include URL detection functionality`);
      assert(response.html.includes('const currentPath = window.location.pathname;'), 
             `${url} should read current pathname for routing`);
      assert(response.html.includes('navigateToRoute(path, false);'), 
             `${url} should initialize routing based on current path`);
    }
  });

  it('should detect URL on initial page load', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Verify initialization flow for URL detection
    assert(response.html.includes('loadAll().then(() => {'), 
           'Page should have initialization flow');
    assert(response.html.includes('initializeFromURL(); // Initialize from URL to show correct page on load'), 
           'URL detection should be part of page initialization');
    
    // Check that URL detection happens after loading
    const initIndex = response.html.indexOf('loadAll().then(() => {');
    const urlDetectionIndex = response.html.indexOf('initializeFromURL();');
    assert(initIndex < urlDetectionIndex, 
           'URL detection should happen after loadAll()');
  });

  it('should integrate with existing section initialization logic', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that navigateToRoute properly handles section switching
    assert(response.html.includes('document.querySelectorAll(\'#main > section\').forEach(s => s.classList.add(\'hidden\'));'), 
           'Should hide all sections before showing target section');
    assert(response.html.includes('document.getElementById(`sec-${section}`).classList.remove(\'hidden\');'), 
           'Should show the target section based on URL');
    
    // Check that nav highlighting is updated based on section
    assert(response.html.includes('document.querySelectorAll(\'.nav-item\').forEach(n => n.classList.remove(\'active\'));'), 
           'Should remove active class from all nav items');
    assert(response.html.includes('document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add(\'active\');'), 
           'Should add active class to nav item matching current section');
  });

  it('should handle all required page routes correctly', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Verify all required routes from acceptance criteria are mapped
    const requiredRouteMappings = [
      "'/dashboard': 'command'",  // Dashboard section
      "'/kanban': 'kanban'",     // Kanban board  
      "'/actions': 'actions'",    // Action items
    ];
    
    for (const mapping of requiredRouteMappings) {
      assert(response.html.includes(mapping), 
             `routeMap should include ${mapping}`);
    }
    
    // Verify default route handling
    assert(response.html.includes('if (!section) {'), 
           'Should handle unmapped routes');
    assert(response.html.includes('section = \'command\';'), 
           'Should default to command section');
    assert(response.html.includes('path = \'/dashboard\';'), 
           'Should default to /dashboard path');
  });
});