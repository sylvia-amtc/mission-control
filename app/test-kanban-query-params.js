import { test } from 'node:test';
import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import fs from 'fs';

const html = fs.readFileSync('./public/index.html', 'utf8');

test('US-007 Kanban Query Parameters - parseKanbanQueryParams function exists', async () => {
  ok(html.includes('function parseKanbanQueryParams()'), 
     'parseKanbanQueryParams function should be defined');
  ok(html.includes('if (window.location.pathname !== \'/kanban\') return'),
     'Should only run on kanban page');
  ok(html.includes('new URLSearchParams(window.location.search)'),
     'Should use URLSearchParams to parse query parameters');
  ok(html.includes('params.get(\'department\')'),
     'Should parse department parameter');
});

test('US-007 Kanban Query Parameters - updateKanbanURL function exists', async () => {
  ok(html.includes('function updateKanbanURL()'), 
     'updateKanbanURL function should be defined');
  ok(html.includes('if (window.location.pathname !== \'/kanban\') return'),
     'Should only update URL on kanban page');
  ok(html.includes('new URLSearchParams()'),
     'Should create URLSearchParams for building query string');
  ok(html.includes('getElementById(\'kanban-filter-dept\')'),
     'Should read department filter value');
  ok(html.includes('getElementById(\'kanban-filter-priority\')'),
     'Should read priority filter value');
  ok(html.includes('history.pushState'),
     'Should use history.pushState to update URL');
});

test('US-007 Kanban Query Parameters - kanban filter event listeners call updateKanbanURL', async () => {
  ok(html.includes('addEventListener(\'change\', function() {'),
     'Should add change event listeners to filters');
  ok(html.includes('updateKanbanURL();'),
     'Event listeners should call updateKanbanURL');
  ok(html.includes('renderKanban();'),
     'Event listeners should call renderKanban');
});

test('US-007 Kanban Query Parameters - department parameter parsing logic', async () => {
  ok(html.includes('const department = params.get(\'department\')'),
     'Should parse department parameter');
  ok(html.includes('deptFilter.value = department'),
     'Should set department filter dropdown value');
  ok(html.includes('Array.from(deptFilter.options).find'),
     'Should validate department exists in dropdown options');
});

test('US-007 Kanban Query Parameters - URL building logic', async () => {
  ok(html.includes('params.set(\'department\', deptFilter.value)'),
     'Should set department parameter in URL');
  ok(html.includes('params.set(\'priority\', priorityFilter.value)'),
     'Should set priority parameter in URL');
  ok(html.includes('params.toString()'),
     'Should convert parameters to query string');
});

test('US-007 Kanban Query Parameters - initializeFromURL parses kanban query params', async () => {
  ok(html.includes('parseKanbanQueryParams()'),
     'initializeFromURL should call parseKanbanQueryParams');
  
  // Check initializeFromURL calls parseKanbanQueryParams for kanban page
  const initMatch = html.match(/function initializeFromURL[\s\S]*?^}/m);
  ok(initMatch, 'initializeFromURL function should exist');
  ok(initMatch[0].includes('if (path === \'/kanban\') {') &&
     initMatch[0].includes('parseKanbanQueryParams();'),
     'initializeFromURL should call parseKanbanQueryParams for kanban page');
});

test('US-007 Kanban Query Parameters - navigateToRoute parses kanban query params', async () => {
  ok(html.includes('parseKanbanQueryParams()'),
     'navigateToRoute should call parseKanbanQueryParams');
  
  // Check navigateToRoute calls parseKanbanQueryParams for kanban section
  const navMatch = html.match(/function navigateToRoute[\s\S]*?^}/m);
  ok(navMatch, 'navigateToRoute function should exist');
  ok(navMatch[0].includes('if (section === \'kanban\') {') &&
     navMatch[0].includes('parseKanbanQueryParams();'),
     'navigateToRoute should call parseKanbanQueryParams for kanban section');
});

test('US-007 Kanban Query Parameters - URL path restriction', async () => {
  ok(html.includes('if (window.location.pathname !== \'/kanban\') return'),
     'parseKanbanQueryParams should only run on kanban page');
  ok(html.includes('if (window.location.pathname !== \'/kanban\') return'),
     'updateKanbanURL should only update URL on kanban page');
});

test('US-007 Kanban Query Parameters - filter dropdown integration', async () => {
  ok(html.includes('getElementById(\'kanban-filter-dept\')'),
     'Should access department filter dropdown');
  ok(html.includes('getElementById(\'kanban-filter-priority\')'),
     'Should access priority filter dropdown');
  ok(html.includes('kanban-filter-dept'),
     'Department filter dropdown should exist in HTML');
  ok(html.includes('kanban-filter-priority'),
     'Priority filter dropdown should exist in HTML');
});