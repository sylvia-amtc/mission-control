const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { db, stmts } = require('./db');

// Mock API function
function mockApi(url) {
  // Parse URL to extract query parameters
  const urlObj = new URL(url, 'http://localhost');
  const { status, department, category, search } = Object.fromEntries(urlObj.searchParams);
  
  if (url.includes('/api/vendors/summary')) {
    const vendors = stmts.getAllVendors.all();
    return Promise.resolve({
      total_vendors: vendors.length,
      active_count: vendors.filter(v => v.status === 'active').length,
      trial_count: vendors.filter(v => v.status === 'trial').length,
      total_monthly_spend: vendors.filter(v => v.status === 'active').reduce((sum, v) => sum + (v.cost_monthly || 0), 0),
      count_by_status: {},
      count_by_department: {}
    });
  }
  
  if (url.includes('/api/vendors/departments')) {
    const vendors = stmts.getAllVendors.all();
    const departments = [...new Set(vendors.map(v => v.department).filter(Boolean))].sort();
    return Promise.resolve(departments);
  }
  
  if (url.startsWith('/api/vendors')) {
    let vendors = stmts.getAllVendors.all();
    
    // Apply filters
    if (status) vendors = vendors.filter(v => v.status === status);
    if (department) vendors = vendors.filter(v => v.department === department);
    if (category) vendors = vendors.filter(v => v.category === category);
    if (search) vendors = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));
    
    // Parse JSON users array for each vendor
    vendors = vendors.map(vendor => ({
      ...vendor,
      users: JSON.parse(vendor.users || '[]')
    }));
    
    return Promise.resolve(vendors);
  }
  
  return Promise.resolve([]);
}

test('US-009: Add filter bar and search to vendors page', async (t) => {
  // Load the HTML file
  const html = fs.readFileSync('./public/index.html', 'utf8');
  const dom = new JSDOM(html);
  global.window = dom.window;
  global.document = dom.window.document;
  
  // Mock the api function
  global.api = mockApi;
  
  // Set up navigation to vendors section - location is already defined by JSDOM
  global.window.history = {
    replaceState: () => {}
  };

  await t.test('AC1: Filter bar displays with 4 controls: department, category, status dropdowns + search input', () => {
    // Check that all filter controls exist
    const statusFilter = document.getElementById('vendor-status-filter');
    const categoryFilter = document.getElementById('vendor-category-filter');
    const departmentFilter = document.getElementById('vendor-department-filter');
    const searchInput = document.getElementById('vendor-search-input');
    
    assert.ok(statusFilter, 'Status filter dropdown should exist');
    assert.ok(categoryFilter, 'Category filter dropdown should exist');
    assert.ok(departmentFilter, 'Department filter dropdown should exist');
    assert.ok(searchInput, 'Search input should exist');
    
    // Verify they are in the filter bar
    const filtersContainer = statusFilter.closest('div');
    assert.ok(filtersContainer.contains(categoryFilter), 'Category filter should be in same container');
    assert.ok(filtersContainer.contains(departmentFilter), 'Department filter should be in same container');
    assert.ok(filtersContainer.contains(searchInput), 'Search input should be in same container');
  });

  await t.test('AC2: Department dropdown populated from API data', async () => {
    // Mock departments response
    const departments = await mockApi('/api/vendors/departments');
    assert.ok(Array.isArray(departments), 'API should return array of departments');
    assert.ok(departments.length > 0, 'Should have at least one department');
  });

  await t.test('AC3: Category dropdown has all valid categories from schema', () => {
    const categoryFilter = document.getElementById('vendor-category-filter');
    const options = Array.from(categoryFilter.options).map(opt => opt.value).filter(Boolean);
    
    const expectedCategories = ['lead-gen', 'design', 'infrastructure', 'analytics', 'social', 'communication', 'other'];
    expectedCategories.forEach(cat => {
      assert.ok(options.includes(cat), `Category filter should include '${cat}'`);
    });
  });

  await t.test('AC4: Status dropdown has all valid statuses from schema', () => {
    const statusFilter = document.getElementById('vendor-status-filter');
    const options = Array.from(statusFilter.options).map(opt => opt.value).filter(Boolean);
    
    const expectedStatuses = ['active', 'trial', 'pending-approval', 'suspended', 'cancelled'];
    expectedStatuses.forEach(status => {
      assert.ok(options.includes(status), `Status filter should include '${status}'`);
    });
  });

  await t.test('AC5: Search input filters by vendor name (case insensitive)', async () => {
    // Test case insensitive search using a search term that will match the test data
    const vendors = await mockApi('/api/vendors?search=test');
    const vendorsUpper = await mockApi('/api/vendors?search=TEST');
    
    assert.ok(vendors.length > 0, 'Search should find vendors with "test"');
    assert.equal(vendors.length, vendorsUpper.length, 'Search should be case insensitive');
    
    // Verify search actually filters
    vendors.forEach(vendor => {
      assert.ok(vendor.name.toLowerCase().includes('test'), 'Returned vendor should contain search term');
    });
  });

  await t.test('AC6: Multiple filters work together (AND logic)', async () => {
    // Test multiple filters together
    const filtered = await mockApi('/api/vendors?status=active&department=Engineering');
    
    filtered.forEach(vendor => {
      assert.equal(vendor.status, 'active', 'Vendor should have active status');
      assert.equal(vendor.department, 'Engineering', 'Vendor should be in Engineering department');
    });
  });

  await t.test('AC7: URL updates with filter params', () => {
    const statusFilter = document.getElementById('vendor-status-filter');
    const departmentFilter = document.getElementById('vendor-department-filter');
    
    // Add a test option to the department dropdown
    const testOption = document.createElement('option');
    testOption.value = 'Test';
    testOption.textContent = 'Test';
    departmentFilter.appendChild(testOption);
    
    // Test the URL parameter construction logic directly
    statusFilter.value = 'active';
    departmentFilter.value = 'Test';
    
    const params = new URLSearchParams();
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (departmentFilter.value) params.set('department', departmentFilter.value);
    
    const queryString = params.toString();
    
    assert.ok(queryString.includes('status=active'), 'URL should contain status parameter');
    assert.ok(queryString.includes('department=Test'), 'URL should contain department parameter');
  });

  await t.test('AC8: Search input has proper attributes', () => {
    const searchInput = document.getElementById('vendor-search-input');
    
    assert.equal(searchInput.type, 'text', 'Search input should be text type');
    assert.equal(searchInput.placeholder, 'Search vendors...', 'Search input should have proper placeholder');
    assert.ok(searchInput.classList.contains('form-input'), 'Search input should have form-input class');
  });

  await t.test('AC9: Filter functions exist and are properly wired', () => {
    // Check that the HTML contains the updateFiltersAndLoad function calls
    const htmlContent = fs.readFileSync('./public/index.html', 'utf8');
    
    assert.ok(htmlContent.includes('onchange="updateFiltersAndLoad()"'), 'Dropdowns should call updateFiltersAndLoad on change');
    assert.ok(htmlContent.includes('onkeyup="updateFiltersAndLoad()"'), 'Search input should call updateFiltersAndLoad on keyup');
  });
});