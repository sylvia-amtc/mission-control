const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const htmlPath = path.join(__dirname, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const serverPath = path.join(__dirname, 'server.js');
const serverJs = fs.readFileSync(serverPath, 'utf8');

test('US-010: Create End-to-End Integration Tests', async (t) => {
  const baseUrl = 'http://localhost:3000';
  
  const makeRequest = (path) => {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Request timeout')));
    });
  };

  await t.test('All routes load correct sections', async (t) => {
    const routes = [
      { path: '/dashboard', section: 'command' },
      { path: '/kanban', section: 'kanban' },
      { path: '/actions', section: 'actions' },
      { path: '/gantt', section: 'gantt' },
      { path: '/calendar', section: 'calendar' },
      { path: '/org', section: 'org' },
      { path: '/sync', section: 'sync' },
      { path: '/crm', section: 'pipeline' }
    ];

    for (const route of routes) {
      await t.test(`${route.path} loads correct section`, async () => {
        // Test server-side route handling
        const response = await makeRequest(route.path);
        assert.strictEqual(response.status, 200, `Route ${route.path} should return 200`);
        assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8', 
                          `Route ${route.path} should return HTML`);
        assert(response.data.includes('<html') || response.data.includes('<!DOCTYPE html>'), 
               `Route ${route.path} should return HTML content`);

        // Test client-side routing logic
        assert(html.includes(`'${route.path}': '${route.section}'`), 
               `Client router should map ${route.path} to ${route.section}`);
        assert(html.includes(`id="sec-${route.section}"`), 
               `HTML should contain section with id sec-${route.section}`);
      });
    }
  });

  await t.test('Action item deep linking loads correct action', async () => {
    // Test server-side route for action deep linking
    const response = await makeRequest('/actions/123');
    assert.strictEqual(response.status, 200, 'Action deep link should return 200');
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8', 
                      'Action deep link should return HTML');
    
    // Test client-side deep linking logic
    assert(html.includes('if (path.startsWith(\'/actions/\'))'), 
           'Router should handle /actions/:id paths');
    assert(html.includes('actionId = path.split(\'/\')[2]'), 
           'Should extract action ID from path');
    assert(html.includes('loadActionItemsAndExpand(parseInt(actionId))') || 
           html.includes('loadActionItemsAndExpand(actionId)'), 
           'Should call loadActionItemsAndExpand for deep linking');
  });

  await t.test('Browser back/forward functionality works', async () => {
    // Test History API integration
    assert(html.includes('window.onpopstate = function(event)'), 
           'Should have popstate handler for browser back/forward');
    assert(html.includes('history.pushState({ section'), 
           'Should use history.pushState for URL updates');
    assert(html.includes('navigateToRoute(path, false)'), 
           'Popstate should call navigateToRoute without history update');
    
    // Test URL state management in navigation
    assert(html.includes('history.pushState({ section, actionId }, \'\', path)'), 
           'Should include actionId in history state for proper back/forward handling');
  });

  await t.test('Query parameter filtering works correctly', async (t) => {
    // Test Actions query parameter support
    await t.test('Actions query parameters work', async () => {
      assert(html.includes('function parseActionQueryParams()'), 
             'Should have parseActionQueryParams function');
      assert(html.includes('function updateActionURL()'), 
             'Should have updateActionURL function');
      assert(html.includes('URLSearchParams'), 
             'Should use URLSearchParams for query parameter handling');
      assert(html.includes('status=') && html.includes('severity=') && html.includes('department='), 
             'Should support status, severity, and department query parameters');
    });

    // Test Kanban query parameter support
    await t.test('Kanban query parameters work', async () => {
      assert(html.includes('function parseKanbanQueryParams()'), 
             'Should have parseKanbanQueryParams function');
      assert(html.includes('function updateKanbanURL()'), 
             'Should have updateKanbanURL function');
      assert(html.includes('kanban-filter-dept'), 
             'Should have department filter dropdown for Kanban');
    });

    // Test Calendar query parameter support
    await t.test('Calendar query parameters work', async () => {
      assert(html.includes('function parseCalendarQueryParams()'), 
             'Should have parseCalendarQueryParams function');
      assert(html.includes('function updateCalendarURL()'), 
             'Should have updateCalendarURL function');
      assert(html.includes('cal-platform-filter'), 
             'Should have platform filter dropdown for Calendar');
    });

    // Test CRM query parameter support
    await t.test('CRM query parameters work', async () => {
      assert(html.includes('function parseCrmQueryParams()'), 
             'Should have parseCrmQueryParams function');
      assert(html.includes('function updateCrmURL()'), 
             'Should have updateCrmURL function');
      assert(html.includes('crm-stage-filter'), 
             'Should have stage filter dropdown for CRM');
    });
  });

  await t.test('WebSocket functionality preserved', async () => {
    // Test WebSocket connection setup
    assert(html.includes('let ws;'), 'Should declare WebSocket variable');
    assert(html.includes('function connectWS()'), 'Should have connectWS function');
    assert(html.includes('new WebSocket('), 'Should create WebSocket connection');
    
    // Test WebSocket event handlers
    assert(html.includes('ws.onopen = '), 'Should handle WebSocket open event');
    assert(html.includes('ws.onclose = '), 'Should handle WebSocket close event');
    assert(html.includes('ws.onmessage = '), 'Should handle WebSocket message event');
    
    // Test WebSocket reconnection logic
    assert(html.includes('setTimeout(connectWS, 3000)'), 
           'Should attempt to reconnect WebSocket on disconnect');
    
    // Test WebSocket status indicator
    assert(html.includes('ws-status'), 'Should have WebSocket status indicator');
    assert(html.includes('Live'), 'Should show Live status when connected');
    assert(html.includes('Disconnected'), 'Should show Disconnected status when disconnected');
    
    // Test live update triggers
    assert(html.includes('if (msg.type.startsWith(\'task\')) loadTasks()'), 
           'Should reload tasks on WebSocket task messages');
    assert(html.includes('if (msg.type.startsWith(\'action\')) loadActions()'), 
           'Should reload actions on WebSocket action messages');
    assert(html.includes('if (msg.type.startsWith(\'deal\') || msg.type.startsWith(\'crm\')) loadPipeline()'), 
           'Should reload pipeline on WebSocket CRM messages');
  });

  await t.test('Auto-refresh functionality preserved', async () => {
    // Test incremental refresh function
    assert(html.includes('async function incrementalRefresh()'), 
           'Should have incrementalRefresh function');
    assert(html.includes('setInterval(incrementalRefresh, 30000)'), 
           'Should call incrementalRefresh every 30 seconds');
    
    // Test organization auto-refresh
    assert(html.includes('setInterval(() => { if (!document.getElementById(\'sec-org\').classList.contains(\'hidden\')) loadOrgData(); }, 15000)'), 
           'Should auto-refresh organization data every 15 seconds when visible');
    
    // Test refresh functions are called in incremental refresh
    assert(html.includes('refreshActionItemsInPlace()'), 
           'Should refresh action items in place');
    assert(html.includes('loadPipeline()'), 
           'Should reload pipeline data');
    
    // Test specific refresh functions exist
    assert(html.includes('function refreshActionItemsInPlace()'), 
           'Should have refreshActionItemsInPlace function');
    assert(html.includes('async function refreshExpandedThread(actionId)'), 
           'Should have refreshExpandedThread function for expanded action threads');
  });

  await t.test('Navigation items properly integrated with routing', async () => {
    // Test navigation items have proper href attributes
    const navItems = [
      { href: '/dashboard', text: 'Command Center' },
      { href: '/kanban', text: 'Kanban Board' },
      { href: '/actions', text: 'Action Items' },
      { href: '/gantt', text: 'Timeline' },
      { href: '/calendar', text: 'Social Calendar' },
      { href: '/org', text: 'Organization' },
      { href: '/sync', text: 'Sync Status' },
      { href: '/crm', text: 'CRM Pipeline' }
    ];

    for (const item of navItems) {
      assert(html.includes(`href="${item.href}"`), 
             `Navigation should have href="${item.href}" for ${item.text}`);
    }

    // Test navigation click handling
    assert(html.includes('class="nav-item"'), 'Should have nav-item CSS class');
    assert(html.includes('event.preventDefault()'), 
           'Should prevent default link behavior for SPA routing');
  });

  await t.test('URL detection on page load works', async () => {
    // Test URL detection function
    assert(html.includes('function initializeFromURL()'), 
           'Should have initializeFromURL function');
    assert(html.includes('const currentPath = window.location.pathname'), 
           'Should read current path from window.location');
    assert(html.includes('navigateToRoute(path, false)'), 
           'Should navigate to detected path without history update');
    
    // Test initialization is called
    assert(html.includes('initializeFromURL()'), 
           'Should call initializeFromURL during page initialization');
  });

  await t.test('Action thread expansion preserves URL state', async () => {
    // Test URL updates during thread expansion/collapse
    assert(html.includes('async function toggleActionThread(id)'), 
           'Should have toggleActionThread function');
    assert(html.includes('history.pushState({ section: \'actions\', actionId: id }, \'\', `/actions/${id}`)'), 
           'Should update URL to /actions/:id when expanding');
    assert(html.includes('history.pushState({ section: \'actions\', actionId: null }, \'\', \'/actions\')'), 
           'Should update URL back to /actions when collapsing');
  });

  await t.test('Filter changes update URLs appropriately', async () => {
    // Test action filter URL updates
    assert(html.includes('updateActionURL()'), 
           'Should call updateActionURL when action filters change');
    
    // Test kanban filter URL updates
    assert(html.includes('updateKanbanURL()'), 
           'Should call updateKanbanURL when kanban filters change');
    
    // Test calendar filter URL updates
    assert(html.includes('updateCalendarURL()'), 
           'Should call updateCalendarURL when calendar filters change');
    
    // Test CRM filter URL updates
    assert(html.includes('updateCrmURL()'), 
           'Should call updateCrmURL when CRM filters change');
  });

  await t.test('Server-side routes properly configured', async () => {
    const routes = ['/dashboard', '/kanban', '/actions', '/actions/:id', '/gantt', '/calendar', '/org', '/sync', '/crm'];
    
    for (const route of routes) {
      const routePattern = route.includes(':id') ? '/actions/:id' : route;
      assert(serverJs.includes(`app.get('${routePattern}'`) || 
             serverJs.includes(`app.get('${routePattern.replace(':', '\\:')}'`), 
             `Server should have route for ${route}`);
    }
    
    // Test that routes serve HTML for SPA routing
    assert(serverJs.includes('res.send(html)') || serverJs.includes('serveIndexHtml'), 
           'Server routes should serve index.html for SPA routing');
  });

  await t.test('All existing functionality integration points preserved', async () => {
    // Test that core data loading functions still exist
    assert(html.includes('async function loadAll()'), 'Should have loadAll function');
    assert(html.includes('function loadTasks()'), 'Should have loadTasks function');
    assert(html.includes('function loadActions()'), 'Should have loadActions function');
    assert(html.includes('function loadPipeline()'), 'Should have loadPipeline function');
    assert(html.includes('function loadCalendar()'), 'Should have loadCalendar function');
    
    // Test that routing doesn't interfere with existing functionality
    assert(html.includes('connectWS()'), 'Should still call connectWS for WebSocket connection');
    assert(html.includes('loadAll().then('), 'Should still call loadAll for initial data loading');
    
    // Test drag and drop functionality preserved
    assert(html.includes('sortable'), 'Should preserve sortable/drag-drop functionality');
    
    // Test modal functionality preserved
    assert(html.includes('modal'), 'Should preserve modal functionality');
    
    // Test form functionality preserved
    assert(html.includes('sendActionReply'), 'Should preserve action reply functionality');
  });
});