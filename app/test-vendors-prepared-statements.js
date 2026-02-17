const { test, describe } = require('node:test');
const assert = require('node:assert');
const { db, stmts } = require('./db.js');

describe('Vendor Prepared Statements & Seed Data', () => {

  test('AC1: 8 vendor prepared statements exist in stmts object', () => {
    const requiredStatements = [
      'getAllVendors',
      'getVendorById', 
      'createVendor',
      'updateVendor',
      'deleteVendor',
      'getVendorsByStatus',
      'getVendorsByDept',
      'getVendorSummary'
    ];

    for (const stmt of requiredStatements) {
      assert.ok(stmts[stmt], `Missing prepared statement: ${stmt}`);
      assert.strictEqual(typeof stmts[stmt], 'object', `${stmt} should be a prepared statement object`);
      assert.strictEqual(typeof stmts[stmt].run, 'function', `${stmt} should have run method`);
    }
  });

  test('AC2: 9 seed vendor records inserted', () => {
    const vendors = stmts.getAllVendors.all();
    assert.strictEqual(vendors.length, 9, `Expected 9 seed vendors, got ${vendors.length}`);
  });

  test('AC3: Seed data has correct categories, costs, owners, and status values', () => {
    const vendors = stmts.getAllVendors.all();
    
    // Check Google Workspace
    const googleWS = vendors.find(v => v.name === 'Google Workspace');
    assert.ok(googleWS, 'Google Workspace should exist');
    assert.strictEqual(googleWS.category, 'communication');
    assert.strictEqual(googleWS.cost_monthly, 0);
    assert.strictEqual(googleWS.billing_cycle, 'free');
    assert.strictEqual(googleWS.owner, 'David');
    assert.strictEqual(googleWS.status, 'active');
    assert.strictEqual(googleWS.department, 'Corporate');

    // Check Apollo.io
    const apollo = vendors.find(v => v.name === 'Apollo.io');
    assert.ok(apollo, 'Apollo.io should exist');
    assert.strictEqual(apollo.category, 'lead-gen');
    assert.strictEqual(apollo.cost_monthly, 49);
    assert.strictEqual(apollo.owner, 'Elena');
    assert.strictEqual(apollo.status, 'pending-approval');
    assert.strictEqual(apollo.department, 'Sales & Business Dev');

    // Check Figma
    const figma = vendors.find(v => v.name === 'Figma');
    assert.ok(figma, 'Figma should exist');
    assert.strictEqual(figma.category, 'design');
    assert.strictEqual(figma.status, 'active');
    assert.strictEqual(figma.owner, 'Zara');
  });

  test('AC4: JSON users arrays properly formatted for multi-user vendors', () => {
    const vendors = stmts.getAllVendors.all();
    
    // Check Google Workspace has multiple users in JSON array
    const googleWS = vendors.find(v => v.name === 'Google Workspace');
    assert.ok(googleWS.users, 'Google Workspace should have users');
    const users = JSON.parse(googleWS.users);
    assert.ok(Array.isArray(users), 'Users should be an array');
    assert.ok(users.length > 1, 'Google Workspace should have multiple users');
    assert.ok(users.includes('David'), 'Should include David');
    assert.ok(users.includes('Sylvia'), 'Should include Sylvia');

    // Check Apollo has multiple users
    const apollo = vendors.find(v => v.name === 'Apollo.io');
    const apolloUsers = JSON.parse(apollo.users);
    assert.ok(Array.isArray(apolloUsers), 'Apollo users should be an array');
    assert.ok(apolloUsers.includes('Elena'), 'Apollo should include Elena');
    assert.ok(apolloUsers.includes('Petra'), 'Apollo should include Petra');
  });

  test('AC5: getAllVendors.all() returns seeded data', () => {
    const vendors = stmts.getAllVendors.all();
    assert.ok(vendors.length > 0, 'getAllVendors should return data');
    assert.strictEqual(vendors.length, 9, 'Should return all 9 seed vendors');
    
    // Check required fields exist
    for (const vendor of vendors) {
      assert.ok(vendor.id, 'Vendor should have id');
      assert.ok(vendor.name, 'Vendor should have name');
      assert.ok(vendor.category, 'Vendor should have category');
      assert.ok(['lead-gen','design','infrastructure','analytics','social','communication','other'].includes(vendor.category), 
        `Invalid category: ${vendor.category}`);
      assert.ok(['active','trial','pending-approval','suspended','cancelled'].includes(vendor.status), 
        `Invalid status: ${vendor.status}`);
    }
  });

  test('AC6: getVendorById prepared statement works', () => {
    const vendors = stmts.getAllVendors.all();
    const firstVendor = vendors[0];
    
    const retrieved = stmts.getVendorById.get(firstVendor.id);
    assert.ok(retrieved, 'getVendorById should return a vendor');
    assert.strictEqual(retrieved.id, firstVendor.id);
    assert.strictEqual(retrieved.name, firstVendor.name);
  });

  test('AC6: createVendor prepared statement works', () => {
    const initialCount = stmts.getAllVendors.all().length;
    
    const newVendor = {
      name: 'Test Vendor',
      category: 'other',
      url: 'https://test.com',
      plan: 'Test Plan',
      cost_monthly: 25,
      cost_annual: null,
      billing_cycle: 'monthly',
      owner: 'TestOwner',
      users: '["TestOwner"]',
      department: 'Engineering',
      status: 'active',
      login_email: 'test@test.com',
      notes: 'Test notes',
      renewal_date: null
    };

    const result = stmts.createVendor.run(newVendor);
    assert.ok(result.lastInsertRowid, 'createVendor should return insert ID');
    
    const afterCount = stmts.getAllVendors.all().length;
    assert.strictEqual(afterCount, initialCount + 1, 'Vendor count should increase by 1');
    
    // Clean up
    stmts.deleteVendor.run(result.lastInsertRowid);
  });

  test('AC6: updateVendor prepared statement works', () => {
    const vendors = stmts.getAllVendors.all();
    const testVendor = vendors[0];
    
    const updatedData = {
      id: testVendor.id,
      name: 'Updated Name',
      category: testVendor.category,
      url: testVendor.url,
      plan: testVendor.plan,
      cost_monthly: testVendor.cost_monthly,
      cost_annual: testVendor.cost_annual,
      billing_cycle: testVendor.billing_cycle,
      owner: testVendor.owner,
      users: testVendor.users,
      department: testVendor.department,
      status: testVendor.status,
      login_email: testVendor.login_email,
      notes: testVendor.notes,
      renewal_date: testVendor.renewal_date
    };

    stmts.updateVendor.run(updatedData);
    
    const updated = stmts.getVendorById.get(testVendor.id);
    assert.strictEqual(updated.name, 'Updated Name', 'Name should be updated');
    
    // Restore original
    const originalData = { ...updatedData, name: testVendor.name };
    stmts.updateVendor.run(originalData);
  });

  test('AC6: getVendorsByStatus prepared statement works', () => {
    const activeVendors = stmts.getVendorsByStatus.all('active');
    assert.ok(activeVendors.length > 0, 'Should return active vendors');
    
    const pendingVendors = stmts.getVendorsByStatus.all('pending-approval');
    assert.ok(pendingVendors.length > 0, 'Should return pending vendors');
    
    for (const vendor of activeVendors) {
      assert.strictEqual(vendor.status, 'active');
    }
    for (const vendor of pendingVendors) {
      assert.strictEqual(vendor.status, 'pending-approval');
    }
  });

  test('AC6: getVendorsByDept prepared statement works', () => {
    const salesVendors = stmts.getVendorsByDept.all('Sales & Business Dev');
    assert.ok(salesVendors.length > 0, 'Should return sales department vendors');
    
    const corporateVendors = stmts.getVendorsByDept.all('Corporate');
    assert.ok(corporateVendors.length > 0, 'Should return corporate vendors');
    
    for (const vendor of salesVendors) {
      assert.strictEqual(vendor.department, 'Sales & Business Dev');
    }
    for (const vendor of corporateVendors) {
      assert.strictEqual(vendor.department, 'Corporate');
    }
  });

  test('AC6: getVendorSummary prepared statement works', () => {
    const summary = stmts.getVendorSummary.get();
    assert.ok(summary, 'getVendorSummary should return data');
    assert.ok(typeof summary.total_count === 'number', 'Should have total_count');
    assert.ok(typeof summary.active_count === 'number', 'Should have active_count');
    assert.ok(typeof summary.pending_count === 'number', 'Should have pending_count');
    assert.ok(typeof summary.total_monthly_cost === 'number', 'Should have total_monthly_cost');
    
    assert.strictEqual(summary.total_count, 9, 'Total count should be 9');
    assert.ok(summary.active_count > 0, 'Should have active vendors');
    assert.ok(summary.pending_count > 0, 'Should have pending vendors');
    assert.ok(summary.total_monthly_cost > 0, 'Should have total monthly cost');
  });

  test('AC6: deleteVendor prepared statement works', () => {
    // Create a test vendor first
    const testVendor = {
      name: 'Delete Test Vendor',
      category: 'other',
      url: 'https://deletetest.com',
      plan: 'Test',
      cost_monthly: 0,
      cost_annual: null,
      billing_cycle: 'free',
      owner: 'Test',
      users: '["Test"]',
      department: 'Engineering',
      status: 'active',
      login_email: 'delete@test.com',
      notes: 'For deletion test',
      renewal_date: null
    };

    const insertResult = stmts.createVendor.run(testVendor);
    const vendorId = insertResult.lastInsertRowid;
    
    // Verify it exists
    const beforeDelete = stmts.getVendorById.get(vendorId);
    assert.ok(beforeDelete, 'Vendor should exist before deletion');
    
    // Delete it
    stmts.deleteVendor.run(vendorId);
    
    // Verify it's gone
    const afterDelete = stmts.getVendorById.get(vendorId);
    assert.strictEqual(afterDelete, undefined, 'Vendor should not exist after deletion');
  });

  test('Seed data includes all required vendor names', () => {
    const vendors = stmts.getAllVendors.all();
    const vendorNames = vendors.map(v => v.name);
    
    const expectedVendors = [
      'Google Workspace',
      'Apollo.io',
      'GoLogin',
      'Figma',
      'LinkedIn Sales Navigator',
      'Cloudflare',
      'Brave Search API',
      'Groq',
      'ElevenLabs'
    ];

    for (const expectedName of expectedVendors) {
      assert.ok(vendorNames.includes(expectedName), `Missing vendor: ${expectedName}`);
    }
  });

});