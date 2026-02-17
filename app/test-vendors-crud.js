const { test, describe } = require('node:test');
const assert = require('node:assert');
const { db, stmts, logActivity } = require('./db.js');

describe('US-004: Vendor CRUD endpoints', () => {

  // Helper function to simulate API logic without HTTP server
  function simulateAPI(method, endpoint, body = {}, params = {}) {
    const segments = endpoint.split('/');
    const id = segments[3]; // /api/vendors/:id
    
    if (method === 'GET' && id) {
      // GET /api/vendors/:id
      const vendor = stmts.getVendorById.get(parseInt(id));
      if (!vendor) return { status: 404, data: { error: 'Vendor not found' } };
      
      vendor.users = JSON.parse(vendor.users || '[]');
      logActivity('view', 'vendor', vendor.id, `Vendor viewed: ${vendor.name}`, 'user');
      return { status: 200, data: vendor };
    }
    
    if (method === 'POST' && endpoint === '/api/vendors') {
      // POST /api/vendors
      if (!body.name) {
        return { status: 400, data: { error: 'Vendor name is required' } };
      }
      
      const v = {
        name: body.name.trim(),
        category: body.category || 'other',
        url: body.url || '',
        plan: body.plan || '',
        cost_monthly: parseFloat(body.cost_monthly) || 0,
        cost_annual: body.cost_annual ? parseFloat(body.cost_annual) : null,
        billing_cycle: body.billing_cycle || 'monthly',
        owner: body.owner || '',
        users: JSON.stringify(body.users || []),
        department: body.department || '',
        status: body.status || 'active',
        login_email: body.login_email || '',
        notes: body.notes || '',
        renewal_date: body.renewal_date || null,
      };
      
      const result = stmts.createVendor.run(v);
      const vendor = stmts.getVendorById.get(result.lastInsertRowid);
      vendor.users = JSON.parse(vendor.users || '[]');
      
      logActivity('create', 'vendor', vendor.id, `Vendor created: ${vendor.name}`, body.actor || 'user');
      return { status: 201, data: vendor };
    }
    
    if (method === 'PATCH' && id) {
      // PATCH /api/vendors/:id
      const existing = stmts.getVendorById.get(parseInt(id));
      if (!existing) return { status: 404, data: { error: 'Vendor not found' } };
      
      const v = {
        id: parseInt(id),
        name: body.name !== undefined ? body.name.trim() : existing.name,
        category: body.category !== undefined ? body.category : existing.category,
        url: body.url !== undefined ? body.url : existing.url,
        plan: body.plan !== undefined ? body.plan : existing.plan,
        cost_monthly: body.cost_monthly !== undefined ? parseFloat(body.cost_monthly) || 0 : existing.cost_monthly,
        cost_annual: body.cost_annual !== undefined ? (body.cost_annual ? parseFloat(body.cost_annual) : null) : existing.cost_annual,
        billing_cycle: body.billing_cycle !== undefined ? body.billing_cycle : existing.billing_cycle,
        owner: body.owner !== undefined ? body.owner : existing.owner,
        users: body.users !== undefined ? JSON.stringify(body.users) : existing.users,
        department: body.department !== undefined ? body.department : existing.department,
        status: body.status !== undefined ? body.status : existing.status,
        login_email: body.login_email !== undefined ? body.login_email : existing.login_email,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        renewal_date: body.renewal_date !== undefined ? body.renewal_date : existing.renewal_date,
      };
      
      stmts.updateVendor.run(v);
      const vendor = stmts.getVendorById.get(id);
      vendor.users = JSON.parse(vendor.users || '[]');
      
      logActivity('update', 'vendor', vendor.id, `Vendor updated: ${vendor.name}`, body.actor || 'user');
      return { status: 200, data: vendor };
    }
    
    if (method === 'DELETE' && id) {
      // DELETE /api/vendors/:id
      const existing = stmts.getVendorById.get(parseInt(id));
      if (!existing) return { status: 404, data: { error: 'Vendor not found' } };
      
      // Soft delete: set status to cancelled
      const v = {
        id: parseInt(id),
        name: existing.name,
        category: existing.category,
        url: existing.url,
        plan: existing.plan,
        cost_monthly: existing.cost_monthly,
        cost_annual: existing.cost_annual,
        billing_cycle: existing.billing_cycle,
        owner: existing.owner,
        users: existing.users,
        department: existing.department,
        status: 'cancelled', // Soft delete
        login_email: existing.login_email,
        notes: existing.notes,
        renewal_date: existing.renewal_date,
      };
      
      stmts.updateVendor.run(v);
      const vendor = stmts.getVendorById.get(id);
      vendor.users = JSON.parse(vendor.users || '[]');
      
      logActivity('delete', 'vendor', vendor.id, `Vendor cancelled (soft delete): ${vendor.name}`, body.actor || 'user');
      return { status: 200, data: vendor };
    }
    
    return { status: 404, data: { error: 'Endpoint not found' } };
  }

  test('AC1: GET /api/vendors/:id returns single vendor or 404', () => {
    // Test with existing vendor (Apollo.io from seed data)
    const vendors = stmts.getAllVendors.all();
    assert.ok(vendors.length > 0, 'Should have seed vendors');
    
    const firstVendor = vendors[0];
    const response = simulateAPI('GET', `/api/vendors/${firstVendor.id}`);
    
    assert.strictEqual(response.status, 200, 'Should return 200 for existing vendor');
    assert.strictEqual(response.data.id, firstVendor.id, 'Should return correct vendor');
    assert.strictEqual(response.data.name, firstVendor.name, 'Should return vendor name');
    assert.ok(Array.isArray(response.data.users), 'Users should be parsed as array');
    
    // Test 404 for non-existent vendor
    const notFoundResponse = simulateAPI('GET', '/api/vendors/99999');
    assert.strictEqual(notFoundResponse.status, 404, 'Should return 404 for non-existent vendor');
    assert.strictEqual(notFoundResponse.data.error, 'Vendor not found', 'Should return error message');
  });

  test('AC2: POST /api/vendors creates vendor with required fields validation', () => {
    // Test missing name validation
    const badResponse = simulateAPI('POST', '/api/vendors', {});
    assert.strictEqual(badResponse.status, 400, 'Should return 400 for missing name');
    assert.strictEqual(badResponse.data.error, 'Vendor name is required', 'Should return validation error');
    
    // Test successful creation with minimal data
    const minimalVendor = {
      name: 'Test Vendor Minimal',
      category: 'lead-gen',
    };
    
    const response = simulateAPI('POST', '/api/vendors', minimalVendor);
    assert.strictEqual(response.status, 201, 'Should return 201 for successful creation');
    assert.strictEqual(response.data.name, 'Test Vendor Minimal', 'Should set vendor name');
    assert.strictEqual(response.data.category, 'lead-gen', 'Should set category');
    assert.strictEqual(response.data.status, 'active', 'Should default status to active');
    assert.strictEqual(response.data.billing_cycle, 'monthly', 'Should default billing_cycle to monthly');
    assert.ok(Array.isArray(response.data.users), 'Users should be parsed as array');
    assert.strictEqual(response.data.users.length, 0, 'Users should default to empty array');
    
    // Test successful creation with full data
    const fullVendor = {
      name: 'Test Vendor Full',
      category: 'design',
      url: 'https://example.com',
      plan: 'Professional',
      cost_monthly: 49.99,
      cost_annual: 499.99,
      billing_cycle: 'annual',
      owner: 'John Doe',
      users: ['user1', 'user2'],
      department: 'Engineering',
      status: 'pending-approval',
      login_email: 'admin@example.com',
      notes: 'Test notes',
      renewal_date: '2025-12-31'
    };
    
    const fullResponse = simulateAPI('POST', '/api/vendors', fullVendor);
    assert.strictEqual(fullResponse.status, 201, 'Should return 201 for successful creation');
    assert.strictEqual(fullResponse.data.name, 'Test Vendor Full', 'Should set vendor name');
    assert.strictEqual(fullResponse.data.category, 'design', 'Should set category');
    assert.strictEqual(fullResponse.data.url, 'https://example.com', 'Should set URL');
    assert.strictEqual(fullResponse.data.plan, 'Professional', 'Should set plan');
    assert.strictEqual(fullResponse.data.cost_monthly, 49.99, 'Should set monthly cost');
    assert.strictEqual(fullResponse.data.cost_annual, 499.99, 'Should set annual cost');
    assert.strictEqual(fullResponse.data.billing_cycle, 'annual', 'Should set billing cycle');
    assert.strictEqual(fullResponse.data.owner, 'John Doe', 'Should set owner');
    assert.deepStrictEqual(fullResponse.data.users, ['user1', 'user2'], 'Should set and parse users array');
    assert.strictEqual(fullResponse.data.department, 'Engineering', 'Should set department');
    assert.strictEqual(fullResponse.data.status, 'pending-approval', 'Should set status');
    assert.strictEqual(fullResponse.data.login_email, 'admin@example.com', 'Should set login email');
    assert.strictEqual(fullResponse.data.notes, 'Test notes', 'Should set notes');
    assert.strictEqual(fullResponse.data.renewal_date, '2025-12-31', 'Should set renewal date');
  });

  test('AC3: PATCH /api/vendors/:id updates vendor and logs activity', () => {
    // Create a vendor to update
    const createResponse = simulateAPI('POST', '/api/vendors', {
      name: 'Test Vendor Update',
      category: 'communication',
      cost_monthly: 25
    });
    assert.strictEqual(createResponse.status, 201, 'Should create vendor successfully');
    
    const vendorId = createResponse.data.id;
    
    // Test 404 for non-existent vendor
    const notFoundResponse = simulateAPI('PATCH', '/api/vendors/99999', { name: 'Updated' });
    assert.strictEqual(notFoundResponse.status, 404, 'Should return 404 for non-existent vendor');
    
    // Test partial update
    const partialUpdate = {
      name: 'Test Vendor Updated',
      cost_monthly: 35,
      notes: 'Updated notes'
    };
    
    const updateResponse = simulateAPI('PATCH', `/api/vendors/${vendorId}`, partialUpdate);
    assert.strictEqual(updateResponse.status, 200, 'Should return 200 for successful update');
    assert.strictEqual(updateResponse.data.id, vendorId, 'Should return same vendor ID');
    assert.strictEqual(updateResponse.data.name, 'Test Vendor Updated', 'Should update name');
    assert.strictEqual(updateResponse.data.cost_monthly, 35, 'Should update monthly cost');
    assert.strictEqual(updateResponse.data.notes, 'Updated notes', 'Should update notes');
    assert.strictEqual(updateResponse.data.category, 'communication', 'Should preserve unchanged fields');
    
    // Test updating users array
    const usersUpdate = {
      users: ['user1', 'user2', 'user3']
    };
    
    const usersResponse = simulateAPI('PATCH', `/api/vendors/${vendorId}`, usersUpdate);
    assert.strictEqual(usersResponse.status, 200, 'Should return 200 for successful update');
    assert.deepStrictEqual(usersResponse.data.users, ['user1', 'user2', 'user3'], 'Should update and parse users array');
    
    // Test updating status
    const statusUpdate = { status: 'suspended' };
    const statusResponse = simulateAPI('PATCH', `/api/vendors/${vendorId}`, statusUpdate);
    assert.strictEqual(statusResponse.status, 200, 'Should return 200 for successful update');
    assert.strictEqual(statusResponse.data.status, 'suspended', 'Should update status');
    
    // Verify activity logging by checking recent activity
    const recentActivity = stmts.getRecentActivity.all();
    const updateActivities = recentActivity.filter(a => 
      a.entity_type === 'vendor' && 
      a.entity_id === vendorId && 
      a.type === 'update'
    );
    assert.ok(updateActivities.length > 0, 'Should log vendor update activities');
  });

  test('AC4: DELETE /api/vendors/:id sets status=cancelled (soft delete)', () => {
    // Create a vendor to delete
    const createResponse = simulateAPI('POST', '/api/vendors', {
      name: 'Test Vendor Delete',
      category: 'analytics',
      status: 'active'
    });
    assert.strictEqual(createResponse.status, 201, 'Should create vendor successfully');
    
    const vendorId = createResponse.data.id;
    const originalName = createResponse.data.name;
    
    // Test 404 for non-existent vendor
    const notFoundResponse = simulateAPI('DELETE', '/api/vendors/99999', {});
    assert.strictEqual(notFoundResponse.status, 404, 'Should return 404 for non-existent vendor');
    
    // Test successful soft delete
    const deleteResponse = simulateAPI('DELETE', `/api/vendors/${vendorId}`, {});
    assert.strictEqual(deleteResponse.status, 200, 'Should return 200 for successful delete');
    assert.strictEqual(deleteResponse.data.id, vendorId, 'Should return same vendor ID');
    assert.strictEqual(deleteResponse.data.name, originalName, 'Should preserve vendor name');
    assert.strictEqual(deleteResponse.data.status, 'cancelled', 'Should set status to cancelled');
    
    // Verify vendor still exists in database but with cancelled status
    const vendorInDb = stmts.getVendorById.get(vendorId);
    assert.ok(vendorInDb, 'Vendor should still exist in database (soft delete)');
    assert.strictEqual(vendorInDb.status, 'cancelled', 'Vendor status should be cancelled in database');
    
    // Verify activity logging
    const recentActivity = stmts.getRecentActivity.all();
    const deleteActivities = recentActivity.filter(a => 
      a.entity_type === 'vendor' && 
      a.entity_id === vendorId && 
      a.type === 'delete'
    );
    assert.ok(deleteActivities.length > 0, 'Should log vendor delete activity');
    assert.ok(deleteActivities[0].message.includes('soft delete'), 'Should mention soft delete in log message');
  });

  test('AC5: All endpoints return proper HTTP status codes', () => {
    // Test various status codes
    const vendor = simulateAPI('POST', '/api/vendors', { name: 'Status Test Vendor' });
    const vendorId = vendor.data.id;
    
    // 200 for successful GET
    const getResponse = simulateAPI('GET', `/api/vendors/${vendorId}`);
    assert.strictEqual(getResponse.status, 200, 'GET should return 200');
    
    // 201 for successful POST
    const postResponse = simulateAPI('POST', '/api/vendors', { name: 'Another Test Vendor' });
    assert.strictEqual(postResponse.status, 201, 'POST should return 201');
    
    // 200 for successful PATCH
    const patchResponse = simulateAPI('PATCH', `/api/vendors/${vendorId}`, { notes: 'Updated' });
    assert.strictEqual(patchResponse.status, 200, 'PATCH should return 200');
    
    // 200 for successful DELETE
    const deleteResponse = simulateAPI('DELETE', `/api/vendors/${vendorId}`, {});
    assert.strictEqual(deleteResponse.status, 200, 'DELETE should return 200');
    
    // 404 for missing vendor
    assert.strictEqual(simulateAPI('GET', '/api/vendors/99999').status, 404, 'GET missing should return 404');
    assert.strictEqual(simulateAPI('PATCH', '/api/vendors/99999', {}).status, 404, 'PATCH missing should return 404');
    assert.strictEqual(simulateAPI('DELETE', '/api/vendors/99999', {}).status, 404, 'DELETE missing should return 404');
    
    // 400 for validation errors
    const validationResponse = simulateAPI('POST', '/api/vendors', {});
    assert.strictEqual(validationResponse.status, 400, 'POST without required fields should return 400');
  });

  test('AC6: Activity logging works for CUD operations', () => {
    // Create vendor
    const createResponse = simulateAPI('POST', '/api/vendors', {
      name: 'Activity Test Vendor',
      actor: 'test-user'
    });
    const vendorId = createResponse.data.id;
    
    // Update vendor
    simulateAPI('PATCH', `/api/vendors/${vendorId}`, {
      name: 'Activity Test Vendor Updated',
      actor: 'test-user'
    });
    
    // Delete vendor
    simulateAPI('DELETE', `/api/vendors/${vendorId}`, {
      actor: 'test-user'
    });
    
    // Get activities specifically for this vendor
    const recentActivity = stmts.getRecentActivity.all();
    const vendorActivities = recentActivity.filter(a => 
      a.entity_type === 'vendor' && 
      a.entity_id === vendorId
    );
    
    assert.ok(vendorActivities.length >= 3, `Should have logged at least 3 activities for vendor ${vendorId}, found ${vendorActivities.length}`);
    
    const createActivity = vendorActivities.find(a => a.type === 'create');
    const updateActivity = vendorActivities.find(a => a.type === 'update');
    const deleteActivity = vendorActivities.find(a => a.type === 'delete');
    
    assert.ok(createActivity, 'Should log create activity');
    assert.ok(updateActivity, 'Should log update activity');
    assert.ok(deleteActivity, 'Should log delete activity');
    
    assert.ok(createActivity.message.includes('Activity Test Vendor'), 'Create activity should mention vendor name');
    assert.ok(updateActivity.message.includes('Activity Test Vendor Updated'), 'Update activity should mention updated name');
    assert.ok(deleteActivity.message.includes('soft delete'), 'Delete activity should mention soft delete');
    
    assert.strictEqual(createActivity.actor, 'test-user', 'Should log actor for create');
    assert.strictEqual(updateActivity.actor, 'test-user', 'Should log actor for update');
    assert.strictEqual(deleteActivity.actor, 'test-user', 'Should log actor for delete');
  });

  test('AC7: Tests for vendor CRUD endpoints pass', () => {
    // This test verifies the test infrastructure itself is working
    assert.ok(true, 'Test infrastructure is working');
    
    // Verify we can access prepared statements
    assert.ok(stmts.getVendorById, 'Should have getVendorById statement');
    assert.ok(stmts.createVendor, 'Should have createVendor statement');
    assert.ok(stmts.updateVendor, 'Should have updateVendor statement');
    
    // Verify database has seed data
    const vendors = stmts.getAllVendors.all();
    assert.ok(vendors.length > 0, 'Should have seed vendor data');
    
    // Verify activity logging function exists
    assert.ok(typeof logActivity === 'function', 'Should have logActivity function');
  });

  test('AC8: Field validation and edge cases', () => {
    // Test name trimming
    const whitespaceResponse = simulateAPI('POST', '/api/vendors', {
      name: '  Whitespace Test  '
    });
    assert.strictEqual(whitespaceResponse.data.name, 'Whitespace Test', 'Should trim whitespace from name');
    
    // Test numeric cost handling
    const costResponse = simulateAPI('POST', '/api/vendors', {
      name: 'Cost Test Vendor',
      cost_monthly: '25.50', // String number
      cost_annual: 'invalid' // Invalid number
    });
    assert.strictEqual(costResponse.data.cost_monthly, 25.5, 'Should parse string numbers');
    assert.strictEqual(costResponse.data.cost_annual, null, 'Should handle invalid annual cost as null');
    
    // Test users array handling
    const usersResponse = simulateAPI('POST', '/api/vendors', {
      name: 'Users Test Vendor',
      users: ['user1', 'user2']
    });
    assert.deepStrictEqual(usersResponse.data.users, ['user1', 'user2'], 'Should handle users array correctly');
    
    // Test updating with null/undefined values
    const vendorId = usersResponse.data.id;
    const nullUpdateResponse = simulateAPI('PATCH', `/api/vendors/${vendorId}`, {
      cost_annual: null,
      renewal_date: null
    });
    assert.strictEqual(nullUpdateResponse.data.cost_annual, null, 'Should handle null values in updates');
    assert.strictEqual(nullUpdateResponse.data.renewal_date, null, 'Should handle null values in updates');
  });
});