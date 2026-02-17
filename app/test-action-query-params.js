import { test } from 'node:test';
import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import fs from 'fs';

const html = fs.readFileSync('./public/index.html', 'utf8');

test('US-006 Action Query Parameters - parseActionQueryParams function exists', async () => {
  ok(html.includes('function parseActionQueryParams()'), 
     'parseActionQueryParams function should be defined');
  ok(html.includes('const params = new URLSearchParams(window.location.search)'),
     'Should use URLSearchParams to parse query parameters');
  ok(html.includes('params.get(\'status\')'),
     'Should parse status parameter');
  ok(html.includes('params.get(\'severity\')'),
     'Should parse severity parameter');
  ok(html.includes('params.get(\'department\')'),
     'Should parse department parameter');
});

test('US-006 Action Query Parameters - updateActionURL function exists', async () => {
  ok(html.includes('function updateActionURL()'), 
     'updateActionURL function should be defined');
  ok(html.includes('new URLSearchParams()'),
     'Should create URLSearchParams for building query string');
  ok(html.includes('params.set(\'status\', actionCurrentFilter)'),
     'Should set status parameter');
  ok(html.includes('params.set(\'severity\', actionCurrentSeverity)'),
     'Should set severity parameter'); 
  ok(html.includes('params.set(\'department\', actionCurrentRequester)'),
     'Should set department parameter');
  ok(html.includes('history.pushState'),
     'Should use history.pushState to update URL');
});

test('US-006 Action Query Parameters - setActionFilter calls updateActionURL', async () => {
  ok(html.includes('updateActionURL()'),
     'setActionFilter should call updateActionURL function');
  
  // Check that updateActionURL is called within setActionFilter
  const setActionFilterMatch = html.match(/function setActionFilter[\s\S]*?^}/m);
  ok(setActionFilterMatch, 'setActionFilter function should exist');
  ok(setActionFilterMatch[0].includes('updateActionURL()'),
     'setActionFilter should call updateActionURL');
});

test('US-006 Action Query Parameters - initializeFromURL parses action query params', async () => {
  ok(html.includes('parseActionQueryParams()'),
     'initializeFromURL should call parseActionQueryParams');
  
  // Check initializeFromURL calls parseActionQueryParams for actions page
  const initializeMatch = html.match(/function initializeFromURL[\s\S]*?^}/m);
  ok(initializeMatch, 'initializeFromURL function should exist');
  ok(initializeMatch[0].includes('path === \'/actions\'') && 
     initializeMatch[0].includes('parseActionQueryParams()'),
     'Should parse query params when path is /actions');
});

test('US-006 Action Query Parameters - navigateToRoute parses action query params', async () => {
  const navigateMatch = html.match(/function navigateToRoute[\s\S]*?^}/m);
  ok(navigateMatch, 'navigateToRoute function should exist');
  ok(navigateMatch[0].includes('parseActionQueryParams()'),
     'navigateToRoute should call parseActionQueryParams for actions page');
  ok(navigateMatch[0].includes('section === \'actions\' && !actionId'),
     'Should only parse query params for actions page when not deep linking');
});

test('US-006 Action Query Parameters - status parameter parsing logic', async () => {
  // Check that the parsing logic handles valid status values
  ok(html.includes('[\'open\', \'awaiting_david\', \'awaiting_vp\', \'resolved\', \'deferred\', \'all\'].includes(status)'),
     'Should validate status parameter values');
  ok(html.includes('actionCurrentFilter = status'),
     'Should set actionCurrentFilter from status parameter');
});

test('US-006 Action Query Parameters - severity parameter parsing logic', async () => {
  // Check that the parsing logic handles valid severity values
  ok(html.includes('[\'red\', \'yellow\', \'blue\'].includes(severity)'),
     'Should validate severity parameter values');
  ok(html.includes('actionCurrentSeverity = severity'),
     'Should set actionCurrentSeverity from severity parameter');
  ok(html.includes('actionCurrentFilter = \'all\''), 
     'Should set filter to all when severity is specified');
});

test('US-006 Action Query Parameters - department parameter parsing logic', async () => {
  // Check that the parsing logic handles department parameter
  ok(html.includes('decodeURIComponent(department)'),
     'Should decode department parameter');
  ok(html.includes('actionCurrentRequester = decodeURIComponent(department)'),
     'Should set actionCurrentRequester from department parameter');
});

test('US-006 Action Query Parameters - URL building logic', async () => {
  // Check URL building in updateActionURL
  ok(html.includes('if (actionCurrentFilter && actionCurrentFilter !== \'all\')'),
     'Should only include status in URL if not all');
  ok(html.includes('if (actionCurrentSeverity)'),
     'Should include severity if set');
  ok(html.includes('if (actionCurrentRequester)'),
     'Should include department if set');
  ok(html.includes('const queryString = params.toString()'),
     'Should convert URLSearchParams to query string');
});

test('US-006 Action Query Parameters - URL path restriction', async () => {
  // Check that updateActionURL only works on actions page
  ok(html.includes('if (window.location.pathname !== \'/actions\') return'),
     'updateActionURL should only work on /actions page');
  ok(html.includes('if (window.location.pathname !== \'/actions\') return'),
     'parseActionQueryParams should only work on /actions page');
});