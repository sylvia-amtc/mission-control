const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const indexPath = './public/index.html';
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

test('US-010: Add Vendor Modal - Acceptance Criteria', async (t) => {
  
  await t.test('AC1: Add Vendor button appears above vendors table', () => {
    // Check that the Add Vendor button exists with correct text and onclick
    const addButtonMatch = indexHtml.match(/<button[^>]*onclick="openVendorModal\(\)"[^>]*>\s*\+\s*Add Vendor\s*<\/button>/);
    assert.ok(addButtonMatch, 'Add Vendor button with openVendorModal() onclick should exist');
    
    // Verify button is in vendors section header
    const vendorsSection = indexHtml.match(/<section id="sec-vendors"[^>]*>[\s\S]*?<\/section>/);
    assert.ok(vendorsSection, 'Vendors section should exist');
    assert.ok(vendorsSection[0].includes('+ Add Vendor'), 'Add Vendor button should be in vendors section');
  });

  await t.test('AC2: Modal opens with form containing all vendor fields', () => {
    // Check modal structure exists
    assert.ok(indexHtml.includes('id="add-vendor-modal"'), 'Add vendor modal should exist');
    assert.ok(indexHtml.includes('modal-overlay'), 'Modal should use modal-overlay class');
    assert.ok(indexHtml.includes('Add New Vendor'), 'Modal should have correct title');
    
    // Check all required form fields exist
    const requiredFields = [
      'add-vendor-name',
      'add-vendor-category', 
      'add-vendor-url',
      'add-vendor-plan',
      'add-vendor-cost-monthly',
      'add-vendor-cost-annual',
      'add-vendor-billing-cycle',
      'add-vendor-owner',
      'add-vendor-department',
      'add-vendor-login-email',
      'add-vendor-status',
      'add-vendor-users',
      'add-vendor-renewal-date',
      'add-vendor-notes'
    ];
    
    requiredFields.forEach(fieldId => {
      assert.ok(indexHtml.includes(`id="${fieldId}"`), `Form should have ${fieldId} field`);
    });
    
    // Check form has submit handler
    assert.ok(indexHtml.includes('onsubmit="submitAddVendor(event)"'), 'Form should have submitAddVendor onsubmit handler');
  });

  await t.test('AC3: Required fields validated before submission', () => {
    // Check that name and category are marked as required
    assert.ok(indexHtml.includes('id="add-vendor-name"') && indexHtml.match(/id="add-vendor-name"[^>]*required/), 'Name field should be required');
    assert.ok(indexHtml.includes('id="add-vendor-category"') && indexHtml.match(/id="add-vendor-category"[^>]*required/), 'Category field should be required');
    
    // Check required field indicators exist  
    const nameFieldMatch = indexHtml.match(/<label[^>]*>[\s\S]*?Vendor Name[\s\S]*?<span class="text-red-400">\s*\*\s*<\/span>/);
    assert.ok(nameFieldMatch, 'Name field should have required indicator (*)');
    
    const categoryFieldMatch = indexHtml.match(/<label[^>]*>[\s\S]*?Category[\s\S]*?<span class="text-red-400">\s*\*\s*<\/span>/);
    assert.ok(categoryFieldMatch, 'Category field should have required indicator (*)');
    
    // Check error display element exists
    assert.ok(indexHtml.includes('id="add-vendor-error"'), 'Modal should have error display element');
  });

  await t.test('AC4: Form dropdowns populated with valid enum values', () => {
    // Check category dropdown has all valid options
    const categoryOptions = [
      'lead-gen',
      'design', 
      'infrastructure',
      'analytics',
      'social',
      'communication',
      'other'
    ];
    
    categoryOptions.forEach(option => {
      assert.ok(indexHtml.includes(`value="${option}"`), `Category dropdown should have ${option} option`);
    });
    
    // Check billing cycle dropdown has all valid options
    const billingCycleOptions = ['monthly', 'annual', 'one-time', 'free'];
    billingCycleOptions.forEach(option => {
      assert.ok(indexHtml.includes(`value="${option}"`), `Billing cycle dropdown should have ${option} option`);
    });
    
    // Check status dropdown has all valid options
    const statusOptions = ['active', 'trial', 'pending-approval', 'suspended', 'cancelled'];
    statusOptions.forEach(option => {
      assert.ok(indexHtml.includes(`value="${option}"`), `Status dropdown should have ${option} option`);
    });
  });

  await t.test('AC5: Users field accepts JSON array input', () => {
    // Check users field exists and has placeholder showing JSON format
    const usersFieldMatch = indexHtml.match(/<input[^>]*id="add-vendor-users"[^>]*>/);
    assert.ok(usersFieldMatch, 'Users input field should exist');
    
    // Check placeholder shows JSON array format
    assert.ok(indexHtml.includes('placeholder=\'["John Doe", "Jane Smith"]\''), 'Users field should have JSON array placeholder');
    
    // Check helper text explains JSON format
    assert.ok(indexHtml.includes('Enter as JSON array'), 'Users field should have helper text explaining JSON format');
    assert.ok(indexHtml.includes('JSON array format'), 'Users field should be labeled with JSON array format');
  });

  await t.test('AC6: Form submits to POST /api/vendors endpoint', () => {
    // Check submitAddVendor function exists and makes POST request
    const submitFunctionMatch = indexHtml.match(/async function submitAddVendor\(event\)[\s\S]*?fetch\('\/api\/vendors',[\s\S]*?method:\s*'POST'/);
    assert.ok(submitFunctionMatch, 'submitAddVendor function should make POST request to /api/vendors');
    
    // Check Content-Type header is set
    assert.ok(indexHtml.includes("'Content-Type': 'application/json'"), 'POST request should set Content-Type header');
    
    // Check data is sent as JSON
    assert.ok(indexHtml.includes('JSON.stringify(vendorData)'), 'POST request should send data as JSON');
  });

  await t.test('AC7: Table refreshes with new vendor after successful creation', () => {
    // Check that loadVendors is called after successful creation
    const successHandlingMatch = indexHtml.match(/closeAddVendorModal\(\)[\s\S]*?await loadVendors\(\)/);
    assert.ok(successHandlingMatch, 'Should call loadVendors() after successful vendor creation');
    
    // Check modal is closed on success
    assert.ok(indexHtml.includes('closeAddVendorModal();'), 'Should close modal on success');
  });

  await t.test('AC8: Modal has proper close functionality', () => {
    // Check close button exists
    const closeButtonMatch = indexHtml.match(/<button[^>]*onclick="closeAddVendorModal\(\)"[^>]*>&times;<\/button>/);
    assert.ok(closeButtonMatch, 'Modal should have close button with closeAddVendorModal onclick');
    
    // Check cancel button exists
    const cancelButtonMatch = indexHtml.match(/<button[^>]*onclick="closeAddVendorModal\(\)"[^>]*>Cancel<\/button>/);
    assert.ok(cancelButtonMatch, 'Modal should have cancel button');
    
    // Check closeAddVendorModal function exists
    const closeFunctionMatch = indexHtml.match(/function closeAddVendorModal\(\)[\s\S]*?classList\.add\('hidden'\)/);
    assert.ok(closeFunctionMatch, 'closeAddVendorModal function should exist and hide modal');
  });

  await t.test('AC9: Form validation handles edge cases', () => {
    // Check users JSON validation exists in submitAddVendor
    const usersValidationMatch = indexHtml.match(/JSON\.parse\(usersInput\)[\s\S]*?if \(!Array\.isArray\(users\)\)/);
    assert.ok(usersValidationMatch, 'Should validate users field as JSON array');
    
    // Check error handling for invalid JSON
    const jsonErrorMatch = indexHtml.match(/Users field must be valid JSON array format/);
    assert.ok(jsonErrorMatch, 'Should show error for invalid JSON in users field');
    
    // Check form clears on open
    const formClearMatch = indexHtml.match(/function openVendorModal[\s\S]*?value = '';/);
    assert.ok(formClearMatch, 'Form fields should be cleared when modal opens');
  });

  await t.test('AC10: Form follows existing styling patterns', () => {
    // Check form uses form-label and form-input classes
    assert.ok(indexHtml.includes('class="form-label"'), 'Form should use form-label class');
    assert.ok(indexHtml.includes('class="form-input"'), 'Form should use form-input class');
    
    // Check buttons use existing button classes
    assert.ok(indexHtml.includes('class="btn-primary"'), 'Submit button should use btn-primary class');
    assert.ok(indexHtml.includes('class="btn-secondary"'), 'Cancel button should use btn-secondary class');
    
    // Check modal uses existing modal classes
    assert.ok(indexHtml.includes('modal-content'), 'Modal should use modal-content class');
    
    // Check grid layout is used for form organization
    assert.ok(indexHtml.includes('grid grid-cols-2'), 'Form should use grid layout for organization');
  });

});