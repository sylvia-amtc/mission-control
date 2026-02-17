const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

test('US-005: Implement Action Item Deep Linking', async (t) => {
  await t.test('goToActionItem function uses URL routing (/actions/:id format)', async () => {
    // Check that goToActionItem function exists in HTML and uses navigateToRoute
    assert.ok(html.includes('function goToActionItem(actionId)'), 'goToActionItem function should be defined');
    assert.ok(html.includes('navigateToRoute(`/actions/${actionId}`)'), 
              'goToActionItem should use navigateToRoute with /actions/:id format');
  });

  await t.test('Kanban "Go to Action Item" buttons call goToActionItem function', async () => {
    // Check that Kanban cards have "Go to Action Item" buttons that call the function
    assert.ok(html.includes('Go to Action Item'), 'Should have "Go to Action Item" text');
    assert.ok(html.includes('goToActionItem('), 'Should have calls to goToActionItem function');
    assert.ok(html.includes('onclick="event.stopPropagation();goToActionItem('), 
              'Buttons should call goToActionItem with proper event handling');
  });

  await t.test('navigateToRoute function handles /actions/:id deep linking', async () => {
    // Check that navigateToRoute function can handle action ID parameters
    assert.ok(html.includes('function navigateToRoute(path, pushState = true)'), 
              'navigateToRoute function should be defined');
    assert.ok(html.includes('if (path.startsWith(\'/actions/\'))'), 
              'navigateToRoute should handle /actions/:id paths');
    assert.ok(html.includes('actionId = path.split(\'/\')[2]'), 
              'Should extract action ID from path');
    assert.ok(html.includes('section = \'actions\''), 
              'Should set section to actions for /actions/:id paths');
  });

  await t.test('loadActionItemsAndExpand function exists for deep linking behavior', async () => {
    // Check that the function exists to handle expand+scroll+highlight behavior
    assert.ok(html.includes('async function loadActionItemsAndExpand(targetId)'), 
              'loadActionItemsAndExpand function should be defined');
    assert.ok(html.includes('await toggleActionThread(targetId)'), 
              'Should call toggleActionThread to expand the item');
    assert.ok(html.includes('card.scrollIntoView({ behavior: \'smooth\', block: \'center\' })'), 
              'Should scroll to the expanded item');
    assert.ok(html.includes('card.style.boxShadow = \'0 0 0 2px var(--accent)'), 
              'Should highlight the expanded item');
  });

  await t.test('toggleActionThread function updates URL when expanding/collapsing', async () => {
    // This is the key functionality I added - URL should change when manually expanding items
    assert.ok(html.includes('async function toggleActionThread(id)'), 
              'toggleActionThread function should be defined');
    
    // Check for URL update when expanding
    assert.ok(html.includes('history.pushState({ section: \'actions\', actionId: id }, \'\', `/actions/${id}`)'), 
              'Should update URL to /actions/:id when expanding action item');
    
    // Check for URL update when collapsing
    assert.ok(html.includes('history.pushState({ section: \'actions\', actionId: null }, \'\', \'/actions\')'), 
              'Should update URL back to /actions when collapsing action item');
  });

  await t.test('server-side routing supports /actions/:id paths', async () => {
    // Check that server.js has the route for action item deep linking
    const serverPath = path.join(__dirname, 'server.js');
    const serverJs = fs.readFileSync(serverPath, 'utf8');
    
    assert.ok(serverJs.includes('app.get(\'/actions/:id\'') || serverJs.includes('app.get(\'/actions\\/:id\''), 
              'Server should have route for /actions/:id');
    assert.ok(serverJs.includes('res.send(html)') || serverJs.includes('res.sendFile') || serverJs.includes('serveIndexHtml'), 
              'Route should serve index.html for SPA routing');
  });

  await t.test('History API state management includes actionId', async () => {
    // Check that the routing infrastructure properly manages actionId in history state
    assert.ok(html.includes('history.pushState({ section, actionId }, \'\', path)'), 
              'navigateToRoute should include actionId in history state');
    
    // Check popstate handler
    assert.ok(html.includes('window.onpopstate = function(event)'), 
              'Should have popstate handler for browser back/forward');
    assert.ok(html.includes('navigateToRoute(path, false)'), 
              'Popstate should call navigateToRoute without pushState');
  });

  await t.test('action item deep linking integrates with page load detection', async () => {
    // Check that URL detection on page load handles action item deep links
    assert.ok(html.includes('function initializeFromURL()'), 
              'initializeFromURL function should exist');
    assert.ok(html.includes('const currentPath = window.location.pathname'), 
              'Should read current path from location');
    assert.ok(html.includes('navigateToRoute(path, false)'), 
              'Should route to detected path without history update');
  });

  await t.test('action item section handles actionId parameter from routing', async () => {
    // Check that when navigateToRoute is called with an actionId, the actions section handles it
    assert.ok(html.includes('if (section === \'actions\' && actionId)'), 
              'Actions section should handle actionId parameter');
    assert.ok(html.includes('loadActionItemsAndExpand(parseInt(actionId))') || 
              html.includes('loadActionItemsAndExpand(actionId)'), 
              'Should call loadActionItemsAndExpand when actionId is present');
  });
});