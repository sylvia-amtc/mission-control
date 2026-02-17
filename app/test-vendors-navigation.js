import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('US-006: Add vendors navigation item', () => {
  const indexHtmlPath = path.join(process.cwd(), 'public', 'index.html');
  let indexHtmlContent;

  test('setup: read index.html file', () => {
    assert.ok(fs.existsSync(indexHtmlPath), 'index.html should exist');
    indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  });

  test('AC1: 💳 Vendors appears in sidebar navigation', () => {
    assert.ok(
      indexHtmlContent.includes('💳 Vendors'),
      'Navigation should contain 💳 Vendors text'
    );
  });

  test('AC2: Navigation item uses existing nav-item CSS classes', () => {
    const vendorsNavMatch = indexHtmlContent.match(/<a[^>]*>💳 Vendors<\/a>/);
    assert.ok(vendorsNavMatch, 'Vendors navigation item should exist');
    
    const vendorsNav = vendorsNavMatch[0];
    assert.ok(
      vendorsNav.includes('class="nav-item"'),
      'Vendors nav should use nav-item CSS class'
    );
  });

  test('AC3: Navigation item has correct href and data-section', () => {
    const vendorsNavMatch = indexHtmlContent.match(/<a[^>]*>💳 Vendors<\/a>/);
    assert.ok(vendorsNavMatch, 'Vendors navigation item should exist');
    
    const vendorsNav = vendorsNavMatch[0];
    assert.ok(
      vendorsNav.includes('href="/vendors"'),
      'Vendors nav should have href="/vendors"'
    );
    assert.ok(
      vendorsNav.includes('data-section="vendors"'),
      'Vendors nav should have data-section="vendors"'
    );
  });

  test('AC4: URL updates to /vendors when clicked (route mapping)', () => {
    // Check that vendors route is in the routeMap
    const routeMapMatch = indexHtmlContent.match(/const routeMap = \{([^}]+)\}/s);
    assert.ok(routeMapMatch, 'routeMap should be defined');
    
    const routeMapContent = routeMapMatch[1];
    assert.ok(
      routeMapContent.includes("'/vendors': 'vendors'"),
      "routeMap should include '/vendors': 'vendors' mapping"
    );
  });

  test('AC5: Navigation item highlights as active when on vendors page (routing logic)', () => {
    // Check that navigateToRoute function exists and handles vendors section
    assert.ok(
      indexHtmlContent.includes('function navigateToRoute('),
      'navigateToRoute function should exist'
    );
    
    // Check that the function updates active nav items
    assert.ok(
      indexHtmlContent.includes("document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))"),
      'navigateToRoute should update active nav items'
    );
    
    // Check that vendors section loading is handled
    assert.ok(
      indexHtmlContent.includes("if (section === 'vendors') loadVendors()"),
      'navigateToRoute should load vendors when navigating to vendors section'
    );
  });

  test('AC6: Vendors view section exists with proper structure', () => {
    // Check that vendors section exists
    assert.ok(
      indexHtmlContent.includes('<section id="sec-vendors" class="hidden">'),
      'Vendors section should exist with correct id and hidden class'
    );
    
    // Check that vendors section has the required elements
    assert.ok(
      indexHtmlContent.includes('💳 Vendor Registry'),
      'Vendors section should have proper title'
    );
    
    // Check for summary cards
    assert.ok(
      indexHtmlContent.includes('id="vendor-summary-cards"'),
      'Vendors section should have summary cards'
    );
    
    // Check for vendors table
    assert.ok(
      indexHtmlContent.includes('id="vendors-table-body"'),
      'Vendors section should have vendors table'
    );
  });

  test('AC7: Vendors JavaScript functions are implemented', () => {
    // Check that loadVendors function exists
    assert.ok(
      indexHtmlContent.includes('async function loadVendors()'),
      'loadVendors function should be implemented'
    );
    
    // Check that renderVendorsTable function exists
    assert.ok(
      indexHtmlContent.includes('function renderVendorsTable()'),
      'renderVendorsTable function should be implemented'
    );
    
    // Check that syncVendors function exists
    assert.ok(
      indexHtmlContent.includes('async function syncVendors()'),
      'syncVendors function should be implemented'
    );
    
    // Check that vendors functions call the API
    assert.ok(
      indexHtmlContent.includes("await api('/api/vendors/summary')"),
      'loadVendors should call vendors summary API'
    );
    
    assert.ok(
      indexHtmlContent.includes("await api(url)") && indexHtmlContent.includes("url = '/api/vendors'"),
      'loadVendors should call vendors API'
    );
  });

  test('AC8: Navigation order is correct', () => {
    // Extract all navigation items in order
    const navItems = [...indexHtmlContent.matchAll(/<a[^>]*href="([^"]*)"[^>]*data-section="([^"]*)"[^>]*>([^<]*)</g)];
    
    // Find vendors nav item
    const vendorsIndex = navItems.findIndex(item => item[3].includes('💳 Vendors'));
    assert.ok(vendorsIndex >= 0, 'Vendors nav item should be found');
    
    // Check that vendors comes after revenue (since we added it before revenue)
    const revenueIndex = navItems.findIndex(item => item[3].includes('💹 Revenue'));
    assert.ok(
      vendorsIndex < revenueIndex,
      'Vendors nav should appear before Revenue nav'
    );
    
    // Check that vendors comes after reporting
    const reportingIndex = navItems.findIndex(item => item[3].includes('📅 Reporting'));
    assert.ok(
      vendorsIndex > reportingIndex,
      'Vendors nav should appear after Reporting nav'
    );
  });

  test('AC9: Filter functionality is implemented', () => {
    // Check for filter dropdowns
    assert.ok(
      indexHtmlContent.includes('id="vendor-status-filter"'),
      'Vendor status filter should exist'
    );
    
    assert.ok(
      indexHtmlContent.includes('id="vendor-category-filter"'),
      'Vendor category filter should exist'
    );
    
    assert.ok(
      indexHtmlContent.includes('id="vendor-department-filter"'),
      'Vendor department filter should exist'
    );
    
    // Check that filters call loadVendors when changed
    assert.ok(
      indexHtmlContent.includes('onchange="loadVendors()"'),
      'Filters should call loadVendors() on change'
    );
  });

  test('AC10: Sync and Add Vendor buttons are present', () => {
    assert.ok(
      indexHtmlContent.includes('onclick="syncVendors()"'),
      'Sync button should call syncVendors()'
    );
    
    assert.ok(
      indexHtmlContent.includes('onclick="openVendorModal()"'),
      'Add Vendor button should call openVendorModal()'
    );
    
    assert.ok(
      indexHtmlContent.includes('+ Add Vendor'),
      'Add Vendor button should have correct text'
    );
  });
});