const http = require('http');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe('US-003: Convert Navigation Items to Proper Links', () => {
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

  it('should have proper href values instead of "#" in nav items', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    const dom = new JSDOM(response.html);
    const navItems = dom.window.document.querySelectorAll('.nav-item');
    
    // Should have nav items
    assert(navItems.length > 0, 'Should have nav items');
    
    // Check specific nav items have proper href values
    const expectedNavItems = [
      { selector: '.nav-item[data-section="command"]', expectedHref: '/dashboard', text: 'Command Center' },
      { selector: '.nav-item[data-section="kanban"]', expectedHref: '/kanban', text: 'Kanban Board' },
      { selector: '.nav-item[data-section="actions"]', expectedHref: '/actions', text: 'Action Items' },
      { selector: '.nav-item[data-section="gantt"]', expectedHref: '/gantt', text: 'Timeline' },
      { selector: '.nav-item[data-section="calendar"]', expectedHref: '/calendar', text: 'Social Calendar' },
      { selector: '.nav-item[data-section="org"]', expectedHref: '/org', text: 'Organization' },
      { selector: '.nav-item[data-section="sync"]', expectedHref: '/sync', text: 'Sync Status' },
      { selector: '.nav-item[data-section="pipeline"]', expectedHref: '/crm', text: 'CRM Pipeline' }
    ];
    
    for (const item of expectedNavItems) {
      const element = dom.window.document.querySelector(item.selector);
      assert(element, `Should have ${item.text} nav item`);
      assert.strictEqual(element.getAttribute('href'), item.expectedHref, 
                        `${item.text} should have href="${item.expectedHref}"`);
      assert.notStrictEqual(element.getAttribute('href'), '#', 
                           `${item.text} should not have href="#"`);
    }
  });

  it('should have all navigation sections mapped to routes', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that routeMap includes all navigation sections
    const requiredRoutes = [
      "'/dashboard': 'command'",
      "'/kanban': 'kanban'",
      "'/actions': 'actions'",
      "'/gantt': 'gantt'",
      "'/calendar': 'calendar'",
      "'/org': 'org'",
      "'/sync': 'sync'",
      "'/crm': 'pipeline'",
      "'/funnel': 'funnel'",
      "'/departments': 'departments'",
      "'/kpis': 'kpis'",
      "'/blockers': 'blockers'",
      "'/reports': 'reports'",
      "'/priorities': 'priorities'",
      "'/initiatives': 'initiatives'",
      "'/reporting': 'reporting'",
      "'/revenue': 'revenue'"
    ];
    
    for (const route of requiredRoutes) {
      assert(response.html.includes(route), `routeMap should include ${route}`);
    }
  });

  it('should have click handlers that prevent default and use URL router', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that click handlers are set up properly
    assert(response.html.includes('document.querySelectorAll(\'.nav-item\').forEach(n => {'), 
           'Should set up nav item event listeners');
    assert(response.html.includes('n.addEventListener(\'click\', e => {'), 
           'Should add click event listeners');
    assert(response.html.includes('e.preventDefault();'), 
           'Should prevent default click behavior');
    assert(response.html.includes('const route = n.getAttribute(\'href\');'), 
           'Should get route from href attribute');
    assert(response.html.includes('navigateToRoute(route);'), 
           'Should call navigateToRoute with the route');
  });

  it('should support right-click "Open in new tab" functionality', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    const dom = new JSDOM(response.html);
    const navItems = dom.window.document.querySelectorAll('.nav-item');
    
    // All nav items should be proper <a> tags with href attributes
    navItems.forEach(item => {
      assert.strictEqual(item.tagName.toLowerCase(), 'a', 'Nav item should be an <a> tag');
      const href = item.getAttribute('href');
      assert(href, 'Nav item should have href attribute');
      assert(href !== '#', 'Nav item should not have href="#"');
      assert(href.startsWith('/'), 'Nav item href should be a proper path');
    });
  });

  it('should update active nav highlighting based on current URL', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Check that active nav highlighting logic exists
    assert(response.html.includes('document.querySelectorAll(\'.nav-item\').forEach(n => n.classList.remove(\'active\'));'), 
           'Should remove active class from all nav items');
    assert(response.html.includes('document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add(\'active\');'), 
           'Should add active class to current section nav item');
  });

  it('should have nav items accessible via their URLs', async () => {
    const testUrls = [
      '/dashboard',
      '/kanban', 
      '/actions',
      '/gantt',
      '/calendar',
      '/org',
      '/sync',
      '/crm'
    ];
    
    // Test each URL returns the same HTML (SPA behavior)
    for (const url of testUrls) {
      const response = await fetchHTML(url);
      assert.strictEqual(response.status, 200, `${url} should return 200 status`);
      assert(response.html.includes('<title>Amtecco Mission Control</title>'), 
             `${url} should return the Mission Control app`);
      assert(response.html.includes('function navigateToRoute'), 
             `${url} should include routing functionality`);
    }
  });

  it('should preserve all existing navigation sections in HTML', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    const dom = new JSDOM(response.html);
    const expectedSections = [
      'command', 'kanban', 'gantt', 'pipeline', 'funnel', 'departments',
      'kpis', 'actions', 'calendar', 'blockers', 'reports', 'priorities',
      'initiatives', 'reporting', 'revenue', 'org', 'sync'
    ];
    
    for (const section of expectedSections) {
      const navItem = dom.window.document.querySelector(`.nav-item[data-section="${section}"]`);
      assert(navItem, `Should have nav item for ${section} section`);
      
      const href = navItem.getAttribute('href');
      assert(href && href !== '#', `Nav item for ${section} should have proper href`);
    }
  });

  it('should maintain backward compatibility with existing routing', async () => {
    const response = await fetchHTML('/dashboard');
    assert.strictEqual(response.status, 200);
    
    // Legacy navigate function should still exist
    assert(response.html.includes('function navigate(section) {'), 
           'Legacy navigate function should exist for backward compatibility');
    
    // Deep link functionality should still work  
    assert(response.html.includes('function goToActionItem(actionId) {'), 
           'goToActionItem function should exist');
    assert(response.html.includes('navigateToRoute(`/actions/${actionId}`);'), 
           'goToActionItem should use URL routing');
  });
});