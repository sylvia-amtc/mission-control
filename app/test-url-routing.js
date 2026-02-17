const http = require('http');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe('Client-Side URL Routing Infrastructure', () => {
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

  it('should have route-to-section mapping defined', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    const dom = new JSDOM(response.html);
    const window = dom.window;
    const script = response.html;
    
    // Check that routeMap is defined
    assert(script.includes('const routeMap = {'), 'routeMap should be defined');
    assert(script.includes("'/dashboard': 'command'"), 'Dashboard route should map to command section');
    assert(script.includes("'/kanban': 'kanban'"), 'Kanban route should be defined');
    assert(script.includes("'/actions': 'actions'"), 'Actions route should be defined');
    assert(script.includes("'/org': 'org'"), 'Org route should be defined');
    assert(script.includes("'/sync': 'sync'"), 'Sync route should be defined');
    assert(script.includes("'/crm': 'pipeline'"), 'CRM route should map to pipeline section');
  });

  it('should have navigateToRoute function defined', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that navigateToRoute function is defined
    assert(response.html.includes('function navigateToRoute(path, pushState = true)'), 
           'navigateToRoute function should be defined with proper parameters');
  });

  it('should have window.onpopstate handler for back/forward', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that window.onpopstate is defined
    assert(response.html.includes('window.onpopstate = function(event)'), 
           'window.onpopstate handler should be defined');
    assert(response.html.includes('navigateToRoute(path, false)'), 
           'onpopstate should call navigateToRoute without pushState');
  });

  it('should have initializeRouting function', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that initializeRouting function is defined
    assert(response.html.includes('function initializeRouting()'), 
           'initializeRouting function should be defined');
    assert(response.html.includes('const currentPath = window.location.pathname'), 
           'initializeRouting should read current pathname');
    assert(response.html.includes('navigateToRoute(currentPath, false)'), 
           'initializeRouting should call navigateToRoute with current path');
  });

  it('should initialize routing on page load', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that initializeRouting is called in init section
    assert(response.html.includes('initializeRouting(); // Initialize URL-based routing'), 
           'initializeRouting should be called on page load');
  });

  it('should have nav items with proper href attributes', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    const dom = new JSDOM(response.html);
    const navItems = dom.window.document.querySelectorAll('.nav-item');
    
    // Should have nav items
    assert(navItems.length > 0, 'Should have nav items');
    
    // Check that nav items have proper href values in HTML (not set by JavaScript)
    navItems.forEach(item => {
      const href = item.getAttribute('href');
      assert(href, 'Nav item should have href attribute');
      assert(href !== '#', 'Nav item should not have href="#"');
      assert(href.startsWith('/'), 'Nav item href should be a proper path');
    });
    
    // Check that nav items have click handlers
    assert(response.html.includes('n.addEventListener(\'click\', e => {'), 
           'Nav items should have click handlers');
    assert(response.html.includes('e.preventDefault();'), 
           'Nav click handlers should prevent default');
    assert(response.html.includes('const route = n.getAttribute(\'href\');'), 
           'Nav click handlers should get route from href attribute');
    assert(response.html.includes('navigateToRoute(route);'), 
           'Nav click handlers should call navigateToRoute');
  });

  it('should handle action item deep links', async () => {
    const response = await fetchHTML('/actions/123');
    assert.strictEqual(response.status, 200);
    
    // Check that deep link handling is implemented
    assert(response.html.includes("if (path.startsWith('/actions/'))"), 
           'Should handle /actions/:id paths');
    assert(response.html.includes("actionId = path.split('/')[2];"), 
           'Should extract action ID from path');
    assert(response.html.includes("section = 'actions';"), 
           'Should map /actions/:id to actions section');
  });

  it('should update goToActionItem to use URL routing', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that goToActionItem uses new routing
    assert(response.html.includes('function goToActionItem(actionId) {'), 
           'goToActionItem function should exist');
    assert(response.html.includes('navigateToRoute(`/actions/${actionId}`);'), 
           'goToActionItem should use URL-based routing with action ID');
  });

  it('should preserve legacy navigate function for backward compatibility', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that legacy navigate function still exists
    assert(response.html.includes('function navigate(section) {'), 
           'Legacy navigate function should exist for backward compatibility');
    assert(response.html.includes('const route = sectionToRoute[section] || \'/dashboard\';'), 
           'Legacy navigate should map section to route');
    assert(response.html.includes('navigateToRoute(route);'), 
           'Legacy navigate should call navigateToRoute');
  });

  it('should have section-to-route reverse mapping', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that sectionToRoute mapping is created
    assert(response.html.includes('const sectionToRoute = {};'), 
           'sectionToRoute mapping should be defined');
    assert(response.html.includes('Object.entries(routeMap).forEach(([route, section]) => {'), 
           'sectionToRoute should be built from routeMap');
    assert(response.html.includes('sectionToRoute[section] = route;'), 
           'sectionToRoute should map sections to routes');
  });

  it('should handle History API state management', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that history.pushState is used
    assert(response.html.includes('history.pushState({ section, actionId }, \'\', path);'), 
           'Should use history.pushState to update URL');
    assert(response.html.includes('if (pushState) {'), 
           'Should conditionally push state');
  });
});