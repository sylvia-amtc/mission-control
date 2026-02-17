const http = require('http');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe('US-009: Add Remaining Core Routes', () => {
  const baseUrl = 'http://localhost:3000';
  
  const fetchHTML = (path) => {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, html: data }));
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Request timeout')));
    });
  };

  it('should serve /gantt route and load Gantt timeline section', async () => {
    const response = await fetchHTML('/gantt');
    assert.strictEqual(response.status, 200, '/gantt should return 200 status');
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8', '/gantt should return HTML');
    
    const dom = new JSDOM(response.html);
    const ganttSection = dom.window.document.querySelector('#sec-gantt');
    assert(ganttSection, 'Gantt section should exist in HTML');
    
    // Verify routing maps correctly
    assert(response.html.includes("'/gantt': 'gantt'"), 'routeMap should include gantt route');
    
    // Should have gantt nav item
    const ganttNav = dom.window.document.querySelector('.nav-item[data-section="gantt"]');
    assert(ganttNav, 'Should have gantt navigation item');
    assert.strictEqual(ganttNav.getAttribute('href'), '/gantt', 'Gantt nav should have correct href');
  });

  it('should serve /org route and load organization chart section', async () => {
    const response = await fetchHTML('/org');
    assert.strictEqual(response.status, 200, '/org should return 200 status');
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8', '/org should return HTML');
    
    const dom = new JSDOM(response.html);
    const orgSection = dom.window.document.querySelector('#sec-org');
    assert(orgSection, 'Organization section should exist in HTML');
    
    // Verify routing maps correctly
    assert(response.html.includes("'/org': 'org'"), 'routeMap should include org route');
    
    // Should have org nav item
    const orgNav = dom.window.document.querySelector('.nav-item[data-section="org"]');
    assert(orgNav, 'Should have organization navigation item');
    assert.strictEqual(orgNav.getAttribute('href'), '/org', 'Organization nav should have correct href');
  });

  it('should serve /sync route and load sync status section', async () => {
    const response = await fetchHTML('/sync');
    assert.strictEqual(response.status, 200, '/sync should return 200 status');
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8', '/sync should return HTML');
    
    const dom = new JSDOM(response.html);
    const syncSection = dom.window.document.querySelector('#sec-sync');
    assert(syncSection, 'Sync section should exist in HTML');
    
    // Verify routing maps correctly
    assert(response.html.includes("'/sync': 'sync'"), 'routeMap should include sync route');
    
    // Should have sync nav item
    const syncNav = dom.window.document.querySelector('.nav-item[data-section="sync"]');
    assert(syncNav, 'Should have sync navigation item');
    assert.strictEqual(syncNav.getAttribute('href'), '/sync', 'Sync nav should have correct href');
  });

  it('should have all navigation items work with URL routing system', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    const dom = new JSDOM(response.html);
    const navItems = dom.window.document.querySelectorAll('.nav-item');
    
    // Should have nav items
    assert(navItems.length > 0, 'Should have navigation items');
    
    // Verify all nav items have proper href attributes (not # or javascript:)
    navItems.forEach(item => {
      const href = item.getAttribute('href');
      const section = item.getAttribute('data-section');
      
      assert(href, `Nav item for ${section} should have href attribute`);
      assert(href !== '#', `Nav item for ${section} should not have href="#"`);
      assert(!href.startsWith('javascript:'), `Nav item for ${section} should not use javascript: href`);
      assert(href.startsWith('/'), `Nav item for ${section} should have proper URL path`);
    });
    
    // Verify click handlers are set up for URL routing
    assert(response.html.includes('document.querySelectorAll(\'.nav-item\').forEach(n => {'), 
           'Should set up nav item click handlers');
    assert(response.html.includes('e.preventDefault();'), 
           'Should prevent default link behavior');
    assert(response.html.includes('navigateToRoute(route);'), 
           'Should use navigateToRoute for navigation');
  });

  it('should have every dashboard section mapped to a dedicated URL', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    const dom = new JSDOM(response.html);
    const navItems = dom.window.document.querySelectorAll('.nav-item[data-section]');
    
    // Get all sections from nav items
    const sections = Array.from(navItems).map(item => item.getAttribute('data-section'));
    
    // Verify each section has a route
    const routeMapString = response.html;
    sections.forEach(section => {
      const hasRoute = routeMapString.includes(`'${section}'`) || 
                      (section === 'command' && routeMapString.includes("'/dashboard': 'command'")) ||
                      (section === 'pipeline' && routeMapString.includes("'/crm': 'pipeline'"));
      
      assert(hasRoute, `Section '${section}' should have a corresponding route in routeMap`);
    });
    
    // Specifically verify our target sections
    assert(routeMapString.includes("'/gantt': 'gantt'"), 'Gantt section should have /gantt route');
    assert(routeMapString.includes("'/org': 'org'"), 'Organization section should have /org route');
    assert(routeMapString.includes("'/sync': 'sync'"), 'Sync section should have /sync route');
  });

  it('should handle direct navigation to remaining core routes', async () => {
    const coreRoutes = ['/gantt', '/org', '/sync'];
    
    for (const route of coreRoutes) {
      const response = await fetchHTML(route);
      assert.strictEqual(response.status, 200, `Route ${route} should return 200 status`);
      assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8', 
                        `Route ${route} should return HTML content`);
      
      // Should return the full SPA HTML with routing functionality
      assert(response.html.includes('function navigateToRoute'), 
            `Route ${route} should include routing functionality`);
      assert(response.html.includes('const routeMap'), 
            `Route ${route} should include route mapping`);
      assert(response.html.includes('initializeFromURL'), 
            `Route ${route} should include URL initialization`);
    }
  });

  it('should initialize correct section based on URL path', async () => {
    const response = await fetchHTML('/sync');
    assert.strictEqual(response.status, 200);
    
    // Should have initializeFromURL function that reads window.location.pathname
    assert(response.html.includes('function initializeFromURL()'), 
           'Should have URL initialization function');
    assert(response.html.includes('const currentPath = window.location.pathname'), 
           'Should read current pathname');
    assert(response.html.includes('navigateToRoute(path, false)'), 
           'Should navigate to the current path without pushing state');
    
    // Should call this function on page load
    assert(response.html.includes('initializeFromURL()'), 
           'Should call initializeFromURL on page load');
  });
});