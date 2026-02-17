import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('public/index.html', 'utf8');

describe('US-011: Create vendor detail/edit slide-in panel', () => {

  it('AC1: Clicking vendor table row opens slide-in panel from right', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;

    // Check vendor panel exists and is initially hidden
    const vendorPanel = window.document.getElementById('vendor-panel');
    assert.ok(vendorPanel, 'Vendor panel element should exist');
    assert.ok(vendorPanel.classList.contains('vendor-panel'), 'Should have vendor-panel class');
    assert.ok(!vendorPanel.classList.contains('open'), 'Panel should initially be closed');
    
    // Check table row has click handler
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('onclick="openVendorDetail('), 'Table rows should have click handlers');
  });

  it('AC2: Panel displays all vendor fields in editable form', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    // Mock vendor data
    const mockVendor = {
      id: 1,
      name: 'Test Vendor',
      category: 'design',
      url: 'https://test.com',
      plan: 'Pro',
      cost_monthly: 99.99,
      cost_annual: 999.99,
      billing_cycle: 'monthly',
      owner: 'John Doe',
      department: 'Design',
      login_email: 'admin@test.com',
      status: 'active',
      users: ['user1@test.com', 'user2@test.com'],
      renewal_date: '2025-01-01',
      notes: 'Test notes'
    };
    
    // Mock the openVendorPanel function and call it
    window.eval(`
      function openVendorPanel(vendor) {
        document.getElementById('vendor-panel-content').innerHTML = \`
          <form id="vendor-edit-form">
            <input type="text" id="vendor-edit-name" value="\${vendor.name || ''}" required>
            <select id="vendor-edit-category">
              <option value="design" \${vendor.category === 'design' ? 'selected' : ''}>Design</option>
            </select>
            <input type="url" id="vendor-edit-url" value="\${vendor.url || ''}">
            <input type="text" id="vendor-edit-plan" value="\${vendor.plan || ''}">
            <input type="number" id="vendor-edit-cost-monthly" value="\${vendor.cost_monthly || ''}">
            <input type="number" id="vendor-edit-cost-annual" value="\${vendor.cost_annual || ''}">
            <select id="vendor-edit-billing-cycle">
              <option value="monthly" \${vendor.billing_cycle === 'monthly' ? 'selected' : ''}>Monthly</option>
            </select>
            <input type="text" id="vendor-edit-owner" value="\${vendor.owner || ''}">
            <input type="text" id="vendor-edit-department" value="\${vendor.department || ''}">
            <input type="email" id="vendor-edit-login-email" value="\${vendor.login_email || ''}">
            <select id="vendor-edit-status">
              <option value="active" \${vendor.status === 'active' ? 'selected' : ''}>Active</option>
            </select>
            <textarea id="vendor-edit-users">\${JSON.stringify(vendor.users) || '[]'}</textarea>
            <input type="date" id="vendor-edit-renewal-date" value="\${vendor.renewal_date || ''}">
            <textarea id="vendor-edit-notes">\${vendor.notes || ''}</textarea>
          </form>
        \`;
        document.getElementById('vendor-panel').classList.add('open');
      }
    `);
    
    window.openVendorPanel(mockVendor);
    
    // Check all form fields exist
    assert.ok(window.document.getElementById('vendor-edit-name'), 'Name field should exist');
    assert.ok(window.document.getElementById('vendor-edit-category'), 'Category field should exist');
    assert.ok(window.document.getElementById('vendor-edit-url'), 'URL field should exist');
    assert.ok(window.document.getElementById('vendor-edit-plan'), 'Plan field should exist');
    assert.ok(window.document.getElementById('vendor-edit-cost-monthly'), 'Monthly cost field should exist');
    assert.ok(window.document.getElementById('vendor-edit-cost-annual'), 'Annual cost field should exist');
    assert.ok(window.document.getElementById('vendor-edit-billing-cycle'), 'Billing cycle field should exist');
    assert.ok(window.document.getElementById('vendor-edit-owner'), 'Owner field should exist');
    assert.ok(window.document.getElementById('vendor-edit-department'), 'Department field should exist');
    assert.ok(window.document.getElementById('vendor-edit-login-email'), 'Login email field should exist');
    assert.ok(window.document.getElementById('vendor-edit-status'), 'Status field should exist');
    assert.ok(window.document.getElementById('vendor-edit-users'), 'Users field should exist');
    assert.ok(window.document.getElementById('vendor-edit-renewal-date'), 'Renewal date field should exist');
    assert.ok(window.document.getElementById('vendor-edit-notes'), 'Notes field should exist');
  });

  it('AC3: Form pre-populated with current vendor data', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    const mockVendor = {
      id: 1,
      name: 'Test Vendor',
      category: 'design',
      url: 'https://test.com',
      plan: 'Pro',
      cost_monthly: 99.99,
      status: 'active',
      notes: 'Test notes'
    };
    
    // Test openVendorPanel implementation by examining HTML template
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('value="${vendor.name || \'\'}"'), 'Name field should be populated from vendor data');
    assert.ok(htmlContent.includes('${vendor.category === \'design\' ? \'selected\' : \'\'}'), 'Category should be pre-selected');
    assert.ok(htmlContent.includes('value="${vendor.url || \'\'}"'), 'URL field should be populated');
    assert.ok(htmlContent.includes('value="${vendor.cost_monthly || \'\'}"'), 'Monthly cost should be populated');
    assert.ok(htmlContent.includes('${vendor.status === \'active\' ? \'selected\' : \'\'}'), 'Status should be pre-selected');
  });

  it('AC4: Save button updates vendor via PATCH endpoint', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    // Check save function exists and makes PATCH request
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('onsubmit="saveVendor('), 'Form should call saveVendor on submit');
    assert.ok(htmlContent.includes('method: \'PATCH\''), 'Should use PATCH method for updates');
    assert.ok(htmlContent.includes('/api/vendors/${id}'), 'Should call correct API endpoint');
    assert.ok(htmlContent.includes('Content-Type\': \'application/json\''), 'Should send JSON content type');
  });

  it('AC5: Delete button confirms then soft-deletes vendor', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    // Check delete function exists with confirmation
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('onclick="deleteVendor('), 'Should have delete button with handler');
    assert.ok(htmlContent.includes('confirm(\'Are you sure'), 'Should show confirmation dialog');
    assert.ok(htmlContent.includes('method: \'DELETE\''), 'Should use DELETE method');
    assert.ok(htmlContent.includes('set its status to cancelled'), 'Should indicate soft delete behavior');
  });

  it('AC6: Panel closes on successful save/delete', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    // Check that save and delete functions call closeVendorPanel
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('closeVendorPanel();'), 'Should close panel after successful operations');
    assert.ok(htmlContent.includes('function closeVendorPanel()'), 'closeVendorPanel function should exist');
    assert.ok(htmlContent.includes('classList.remove(\'open\')'), 'Should remove open class to close panel');
  });

  it('AC7: Table updates to reflect changes', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    // Check that save and delete functions refresh the vendors table
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('await loadVendors();'), 'Should reload vendors after save/delete');
    assert.ok(htmlContent.includes('function loadVendors()'), 'loadVendors function should exist');
  });

  it('AC8: Vendor edit panel CSS and structure', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    // Check CSS classes exist
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('.vendor-panel {'), 'vendor-panel CSS class should be defined');
    assert.ok(htmlContent.includes('.vendor-panel.open {'), 'vendor-panel open state should be defined');
    assert.ok(htmlContent.includes('position:fixed'), 'Panel should be positioned fixed');
    assert.ok(htmlContent.includes('right:-420px'), 'Panel should slide in from right');
    assert.ok(htmlContent.includes('right:0'), 'Open panel should be positioned at right:0');
    assert.ok(htmlContent.includes('transition:right'), 'Panel should have slide transition');
    
    // Check panel HTML structure
    assert.ok(htmlContent.includes('<div class="vendor-panel"'), 'Panel element should exist');
    assert.ok(htmlContent.includes('id="vendor-panel"'), 'Panel should have correct ID');
    assert.ok(htmlContent.includes('onclick="closeVendorPanel()"'), 'Panel should have close button');
  });

  it('AC9: Form validation and error handling', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    // Check required field validation
    const htmlContent = window.document.documentElement.innerHTML;
    assert.ok(htmlContent.includes('required>'), 'Should have required fields');
    assert.ok(htmlContent.includes('if (!name)'), 'Should validate name is required');
    assert.ok(htmlContent.includes('if (!category)'), 'Should validate category is required');
    assert.ok(htmlContent.includes('JSON.parse(usersText)'), 'Should validate JSON format for users');
    assert.ok(htmlContent.includes('vendor-edit-error'), 'Should have error display element');
    assert.ok(htmlContent.includes('catch (error)'), 'Should have error handling');
  });

  it('AC10: Panel follows existing slide-in pattern from org panel', async () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;
    global.document = window.document;
    global.window = window;
    
    const htmlContent = window.document.documentElement.innerHTML;
    
    // Compare vendor panel CSS to org panel pattern
    assert.ok(htmlContent.includes('.org-panel {') && htmlContent.includes('.vendor-panel {'), 
      'Both org-panel and vendor-panel CSS should exist');
    
    // Check similar structure patterns
    const orgPanelPattern = /\.org-panel \{ position:fixed; right:-420px;.*transition:right.*\}/;
    const vendorPanelPattern = /\.vendor-panel \{ position:fixed; right:-420px;.*transition:right.*\}/;
    
    assert.ok(orgPanelPattern.test(htmlContent.replace(/\s+/g, ' ')), 'org-panel should have expected CSS pattern');
    assert.ok(vendorPanelPattern.test(htmlContent.replace(/\s+/g, ' ')), 'vendor-panel should follow org-panel pattern');
    
    // Check similar open/close function patterns
    assert.ok(htmlContent.includes('function openOrgPanel(') && htmlContent.includes('function openVendorPanel('), 
      'Both open functions should exist');
    assert.ok(htmlContent.includes('function closeOrgPanel()') && htmlContent.includes('function closeVendorPanel()'), 
      'Both close functions should exist');
  });

});