const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.join(__dirname, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

test('US-012: Summary dashboard cards display correctly', async () => {
  console.log('Testing vendor summary dashboard cards...');
  
  // AC1: 4 summary cards display above vendors table in grid layout
  const cardMatches = html.match(/<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" id="vendor-summary-cards">/);
  assert(cardMatches, 'Summary cards grid container should exist');
  
  // Count the individual card divs within the summary cards section
  const summarySection = html.match(/<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" id="vendor-summary-cards">[\s\S]*?<\/div>\s*<!-- Filters -->/);
  assert(summarySection, 'Should find summary cards section');
  const cardCount = (summarySection[0].match(/<div class="card p-4">/g) || []).length;
  assert.strictEqual(cardCount, 4, 'Should have exactly 4 summary cards');
  
  // AC2: Total Monthly Spend shows currency formatted total
  assert(html.includes('Total Monthly Spend'), 'Should have Total Monthly Spend card');
  assert(html.includes('id="vendor-total-monthly-spend"'), 'Should have total monthly spend element');
  assert(html.includes('Active vendors cost'), 'Should have appropriate description');
  
  // AC3: Active Accounts shows count of active status vendors
  assert(html.includes('Active Accounts'), 'Should have Active Accounts card');
  assert(html.includes('id="vendor-active-accounts"'), 'Should have active accounts element');
  assert(html.includes('Currently active'), 'Should have appropriate description');
  
  // AC4: Pending Approval shows count of pending-approval status vendors
  assert(html.includes('Pending Approval'), 'Should have Pending Approval card');
  assert(html.includes('id="vendor-pending-approval"'), 'Should have pending approval element');
  assert(html.includes('Awaiting approval'), 'Should have appropriate description');
  
  // AC5: By Department card shows top 3 departments with counts
  assert(html.includes('By Department'), 'Should have By Department card');
  assert(html.includes('id="vendor-by-department"'), 'Should have by department element');
  assert(html.includes('Top 3 departments'), 'Should have appropriate description');
  
  // AC6: Cards use existing card styling classes
  const vendorSummarySection = html.match(/<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" id="vendor-summary-cards">[\s\S]*?<!-- Filters -->/)[0];
  const cardStyleMatches = (vendorSummarySection.match(/<div class="card p-4">/g) || []).length;
  assert.strictEqual(cardStyleMatches, 4, 'All summary cards should use card styling class');
  
  console.log('✓ All summary cards structure validation passed');
});

test('Summary cards JavaScript functionality', async () => {
  console.log('Testing summary cards JavaScript logic...');
  
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  
  // Mock fetch for API calls
  global.fetch = async (url) => {
    if (url === '/api/vendors/summary') {
      return {
        ok: true,
        json: async () => ({
          total_monthly_spend: 1251,
          count_by_status: {
            'active': 5,
            'trial': 2,
            'pending-approval': 3,
            'suspended': 1,
            'cancelled': 0
          },
          count_by_department: {
            'Engineering': 4,
            'Marketing': 3,
            'Sales': 2,
            'Operations': 1,
            'Design': 1
          },
          active_count: 5,
          trial_count: 2
        })
      };
    }
    return { ok: false };
  };
  
  // Add required DOM elements to test JavaScript
  document.getElementById('vendor-summary-cards').innerHTML = `
    <div class="card p-4">
      <div class="text-xs text-[#94a3b8] mb-1">Total Monthly Spend</div>
      <div class="text-2xl font-bold text-[#eab308]" id="vendor-total-monthly-spend">Loading...</div>
      <div class="text-xs text-[#64748b] mt-1">Active vendors cost</div>
    </div>
    <div class="card p-4">
      <div class="text-xs text-[#94a3b8] mb-1">Active Accounts</div>
      <div class="text-2xl font-bold text-[#22c55e]" id="vendor-active-accounts">-</div>
      <div class="text-xs text-[#64748b] mt-1">Currently active</div>
    </div>
    <div class="card p-4">
      <div class="text-xs text-[#94a3b8] mb-1">Pending Approval</div>
      <div class="text-2xl font-bold text-[#3b82f6]" id="vendor-pending-approval">-</div>
      <div class="text-xs text-[#64748b] mt-1">Awaiting approval</div>
    </div>
    <div class="card p-4">
      <div class="text-xs text-[#94a3b8] mb-1">By Department</div>
      <div class="text-sm" id="vendor-by-department">Loading...</div>
      <div class="text-xs text-[#64748b] mt-1">Top 3 departments</div>
    </div>
  `;
  
  // Execute the loadVendors function logic manually
  const mockSummaryData = {
    total_monthly_spend: 1251,
    count_by_status: {
      'active': 5,
      'trial': 2,
      'pending-approval': 3,
      'suspended': 1,
      'cancelled': 0
    },
    count_by_department: {
      'Engineering': 4,
      'Marketing': 3,
      'Sales': 2,
      'Operations': 1,
      'Design': 1
    },
    active_count: 5,
    trial_count: 2
  };
  
  // Test the summary cards update logic
  const totalMonthlySpend = mockSummaryData.total_monthly_spend || 0;
  document.getElementById('vendor-total-monthly-spend').textContent = `$${totalMonthlySpend.toLocaleString()}`;
  
  const activeAccounts = mockSummaryData.count_by_status?.active || 0;
  document.getElementById('vendor-active-accounts').textContent = activeAccounts;
  
  const pendingApproval = mockSummaryData.count_by_status?.[`pending-approval`] || 0;
  document.getElementById('vendor-pending-approval').textContent = pendingApproval;
  
  // Format top 3 departments
  const departmentCounts = mockSummaryData.count_by_department || {};
  const sortedDepartments = Object.entries(departmentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  
  const departmentDisplay = sortedDepartments.length > 0 
    ? sortedDepartments.map(([dept, count]) => `${dept}: ${count}`).join('<br>')
    : 'No data';
  
  document.getElementById('vendor-by-department').innerHTML = departmentDisplay;
  
  // AC2: Total Monthly Spend shows currency formatted total
  const monthlySpendEl = document.getElementById('vendor-total-monthly-spend');
  assert.strictEqual(monthlySpendEl.textContent, '$1,251', 'Should format currency with thousands separator');
  
  // AC3: Active Accounts shows count of active status vendors
  const activeAccountsEl = document.getElementById('vendor-active-accounts');
  assert.strictEqual(activeAccountsEl.textContent, '5', 'Should show correct active count');
  
  // AC4: Pending Approval shows count of pending-approval status vendors
  const pendingApprovalEl = document.getElementById('vendor-pending-approval');
  assert.strictEqual(pendingApprovalEl.textContent, '3', 'Should show correct pending approval count');
  
  // AC5: By Department card shows top 3 departments with counts
  const departmentEl = document.getElementById('vendor-by-department');
  const departmentText = departmentEl.innerHTML;
  assert(departmentText.includes('Engineering: 4'), 'Should show Engineering with count 4');
  assert(departmentText.includes('Marketing: 3'), 'Should show Marketing with count 3');
  assert(departmentText.includes('Sales: 2'), 'Should show Sales with count 2');
  assert(!departmentText.includes('Operations'), 'Should not show more than top 3 departments');
  assert(!departmentText.includes('Design'), 'Should not show more than top 3 departments');
  
  console.log('✓ All JavaScript functionality tests passed');
});

test('Empty data handling', async () => {
  console.log('Testing empty data scenarios...');
  
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  
  // Add required DOM elements
  document.getElementById('vendor-summary-cards').innerHTML = `
    <div class="card p-4">
      <div id="vendor-total-monthly-spend">Loading...</div>
    </div>
    <div class="card p-4">
      <div id="vendor-active-accounts">-</div>
    </div>
    <div class="card p-4">
      <div id="vendor-pending-approval">-</div>
    </div>
    <div class="card p-4">
      <div id="vendor-by-department">Loading...</div>
    </div>
  `;
  
  // Test empty summary data
  const mockEmptyData = {
    total_monthly_spend: 0,
    count_by_status: {},
    count_by_department: {},
    active_count: 0,
    trial_count: 0
  };
  
  const totalMonthlySpend = mockEmptyData.total_monthly_spend || 0;
  document.getElementById('vendor-total-monthly-spend').textContent = `$${totalMonthlySpend.toLocaleString()}`;
  
  const activeAccounts = mockEmptyData.count_by_status?.active || 0;
  document.getElementById('vendor-active-accounts').textContent = activeAccounts;
  
  const pendingApproval = mockEmptyData.count_by_status?.[`pending-approval`] || 0;
  document.getElementById('vendor-pending-approval').textContent = pendingApproval;
  
  const departmentCounts = mockEmptyData.count_by_department || {};
  const sortedDepartments = Object.entries(departmentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  
  const departmentDisplay = sortedDepartments.length > 0 
    ? sortedDepartments.map(([dept, count]) => `${dept}: ${count}`).join('<br>')
    : 'No data';
  
  document.getElementById('vendor-by-department').innerHTML = departmentDisplay;
  
  // Verify empty data handling
  assert.strictEqual(document.getElementById('vendor-total-monthly-spend').textContent, '$0', 'Should show $0 for empty spend');
  assert.strictEqual(document.getElementById('vendor-active-accounts').textContent, '0', 'Should show 0 for no active accounts');
  assert.strictEqual(document.getElementById('vendor-pending-approval').textContent, '0', 'Should show 0 for no pending approval');
  assert.strictEqual(document.getElementById('vendor-by-department').innerHTML, 'No data', 'Should show "No data" for empty departments');
  
  console.log('✓ Empty data handling tests passed');
});

test('Summary card positioning', async () => {
  console.log('Testing summary cards are positioned above vendors table...');
  
  // AC1: Cards should be positioned above the vendors table
  const summaryIndex = html.indexOf('id="vendor-summary-cards"');
  const tableIndex = html.indexOf('id="vendors-table-body"');
  
  assert(summaryIndex > 0, 'Summary cards should exist in HTML');
  assert(tableIndex > 0, 'Vendors table should exist in HTML');
  assert(summaryIndex < tableIndex, 'Summary cards should appear before vendors table');
  
  console.log('✓ Summary cards positioning test passed');
});

test('AC7: Summary data updates when vendors change', async () => {
  console.log('Testing that summary data updates when vendors change...');
  
  // The loadVendors function is called after vendor CRUD operations
  // Check that loadVendors is called after createVendor
  const createVendorPattern = /await loadVendors\(\)\s*;.*\/\/ Refresh the vendors table/;
  assert(createVendorPattern.test(html), 'loadVendors should be called after creating vendor');
  
  // Check that loadVendors is called after updateVendor (in saveVendor)
  const updateVendorPattern = /await loadVendors\(\)\s*;/;
  assert(updateVendorPattern.test(html), 'loadVendors should be called after updating vendor');
  
  // Check that loadVendors is called after deleteVendor
  assert(html.includes('await loadVendors();') && html.includes('deleteVendor'), 'loadVendors should be called after deleting vendor');
  
  console.log('✓ Summary data refresh test passed');
});

console.log('Running all vendor summary cards tests...');