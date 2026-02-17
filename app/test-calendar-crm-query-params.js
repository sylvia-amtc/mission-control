const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Read the HTML file to get the functions
const htmlContent = fs.readFileSync('public/index.html', 'utf8');

test('Calendar query parameter parsing function exists', () => {
  assert(htmlContent.includes('function parseCalendarQueryParams()'), 'parseCalendarQueryParams function should exist');
});

test('Calendar URL update function exists', () => {
  assert(htmlContent.includes('function updateCalendarURL()'), 'updateCalendarURL function should exist');
});

test('CRM query parameter parsing function exists', () => {
  assert(htmlContent.includes('function parseCrmQueryParams()'), 'parseCrmQueryParams function should exist');
});

test('CRM URL update function exists', () => {
  assert(htmlContent.includes('function updateCrmURL()'), 'updateCrmURL function should exist');
});

test('Calendar platform filter has updateCalendarURL in onchange', () => {
  const platformFilterMatch = htmlContent.match(/id="cal-platform-filter"[^>]*onchange="([^"]+)"/);
  assert(platformFilterMatch, 'Calendar platform filter should have onchange attribute');
  assert(platformFilterMatch[1].includes('updateCalendarURL()'), 'Calendar platform filter should call updateCalendarURL()');
  assert(platformFilterMatch[1].includes('loadCalendar()'), 'Calendar platform filter should call loadCalendar()');
});

test('CRM stage filter exists with updateCrmURL in onchange', () => {
  const stageFilterMatch = htmlContent.match(/id="crm-stage-filter"[^>]*onchange="([^"]+)"/);
  assert(stageFilterMatch, 'CRM stage filter should have onchange attribute');
  assert(stageFilterMatch[1].includes('updateCrmURL()'), 'CRM stage filter should call updateCrmURL()');
  assert(stageFilterMatch[1].includes('loadPipeline()'), 'CRM stage filter should call loadPipeline()');
});

test('CRM stage filter dropdown has correct options', () => {
  const stageFilterSection = htmlContent.match(/<select id="crm-stage-filter"[^>]*>[\s\S]*?<\/select>/);
  assert(stageFilterSection, 'CRM stage filter dropdown should exist');
  
  const filterHTML = stageFilterSection[0];
  assert(filterHTML.includes('<option value="">All Stages</option>'), 'Should have "All Stages" option');
  assert(filterHTML.includes('<option value="lead">Leads</option>'), 'Should have "Leads" option');
  assert(filterHTML.includes('<option value="qualified">Qualified</option>'), 'Should have "Qualified" option');
  assert(filterHTML.includes('<option value="opportunity">Opportunity</option>'), 'Should have "Opportunity" option');
  assert(filterHTML.includes('<option value="proposal">Proposal</option>'), 'Should have "Proposal" option');
  assert(filterHTML.includes('<option value="closed_won">Closed Won</option>'), 'Should have "Closed Won" option');
  assert(filterHTML.includes('<option value="closed_lost">Closed Lost</option>'), 'Should have "Closed Lost" option');
});

test('Calendar query parameter parsing integrated into navigateToRoute', () => {
  const navigateFunctionMatch = htmlContent.match(/function navigateToRoute\([^}]*\{[\s\S]*?\n}/);
  assert(navigateFunctionMatch, 'navigateToRoute function should exist');
  
  const functionBody = navigateFunctionMatch[0];
  assert(functionBody.includes("if (section === 'calendar')"), 'Should check for calendar section');
  assert(functionBody.includes('parseCalendarQueryParams()'), 'Should call parseCalendarQueryParams()');
});

test('CRM query parameter parsing integrated into navigateToRoute', () => {
  const navigateFunctionMatch = htmlContent.match(/function navigateToRoute\([^}]*\{[\s\S]*?\n}/);
  assert(navigateFunctionMatch, 'navigateToRoute function should exist');
  
  const functionBody = navigateFunctionMatch[0];
  assert(functionBody.includes("if (section === 'pipeline')"), 'Should check for pipeline section');
  assert(functionBody.includes('parseCrmQueryParams()'), 'Should call parseCrmQueryParams()');
});

test('Calendar query parameter parsing integrated into initializeFromURL', () => {
  const initializeFunctionMatch = htmlContent.match(/function initializeFromURL\(\)[^}]*\{[\s\S]*?\n}/);
  assert(initializeFunctionMatch, 'initializeFromURL function should exist');
  
  const functionBody = initializeFunctionMatch[0];
  assert(functionBody.includes("if (path === '/calendar')"), 'Should check for /calendar path');
  assert(functionBody.includes('parseCalendarQueryParams()'), 'Should call parseCalendarQueryParams()');
});

test('CRM query parameter parsing integrated into initializeFromURL', () => {
  const initializeFunctionMatch = htmlContent.match(/function initializeFromURL\(\)[^}]*\{[\s\S]*?\n}/);
  assert(initializeFunctionMatch, 'initializeFromURL function should exist');
  
  const functionBody = initializeFunctionMatch[0];
  assert(functionBody.includes("if (path === '/crm')"), 'Should check for /crm path');
  assert(functionBody.includes('parseCrmQueryParams()'), 'Should call parseCrmQueryParams()');
});

test('loadPipeline function supports stage filtering', () => {
  const loadPipelineMatch = htmlContent.match(/async function loadPipeline\(\)[^}]*\{[\s\S]*?renderPipeline\(\);[\s\S]*?\}/);
  assert(loadPipelineMatch, 'loadPipeline function should exist');
  
  const functionBody = loadPipelineMatch[0];
  assert(functionBody.includes("document.getElementById('crm-stage-filter')"), 'Should get stage filter value');
  assert(functionBody.includes('/api/crm/deals?stage=${stageFilter}'), 'Should use deals endpoint for filtering');
  assert(functionBody.includes("api('/api/crm/pipeline')"), 'Should use pipeline endpoint when no filter');
});