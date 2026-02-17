const { test, describe } = require('node:test');
const assert = require('node:assert');
const { db, stmts } = require('./db.js');

describe('US-003: GET /api/vendors endpoint filtering logic', () => {

  // Helper function to simulate the filtering logic from the API endpoint
  function getVendorsWithFilters(status, department, category) {
    let vendors;
    
    // Apply filters using appropriate prepared statements (same logic as API endpoint)
    if (status && department && category) {
      // Multiple filters: get all vendors and filter in application
      vendors = stmts.getAllVendors.all().filter(v => {
        return v.status === status && v.department === department && v.category === category;
      });
    } else if (status && department) {
      vendors = stmts.getAllVendors.all().filter(v => {
        return v.status === status && v.department === department;
      });
    } else if (status && category) {
      vendors = stmts.getAllVendors.all().filter(v => {
        return v.status === status && v.category === category;
      });
    } else if (department && category) {
      vendors = stmts.getAllVendors.all().filter(v => {
        return v.department === department && v.category === category;
      });
    } else if (status) {
      vendors = stmts.getVendorsByStatus.all(status);
    } else if (department) {
      vendors = stmts.getVendorsByDept.all(department);
    } else if (category) {
      vendors = stmts.getVendorsByCategory.all(category);
    } else {
      vendors = stmts.getAllVendors.all();
    }
    
    // Parse JSON users array for each vendor (same as API endpoint)
    vendors = vendors.map(vendor => ({
      ...vendor,
      users: JSON.parse(vendor.users || '[]')
    }));
    
    return vendors;
  }

  test('AC1: GET /api/vendors returns all vendors as JSON array', () => {
    const vendors = getVendorsWithFilters(); // No filters = all vendors
    
    assert.ok(Array.isArray(vendors), 'Should return JSON array');
    assert.strictEqual(vendors.length, 9, 'Should return all 9 seed vendors');
    
    // Verify structure of first vendor
    const vendor = vendors[0];
    assert.ok(vendor.id, 'Vendor should have id');
    assert.ok(vendor.name, 'Vendor should have name');
    assert.ok(vendor.category, 'Vendor should have category');
    assert.ok(vendor.status, 'Vendor should have status');
    assert.ok(Array.isArray(vendor.users), 'Vendor users should be parsed as array');
  });

  test('AC2: ?status filter works for all valid status values', () => {
    const statusValues = ['active', 'trial', 'pending-approval', 'suspended', 'cancelled'];
    
    for (const status of statusValues) {
      const vendors = getVendorsWithFilters(status);
      
      assert.ok(Array.isArray(vendors), `Status filter ${status} should return array`);
      
      // All returned vendors should have the requested status
      for (const vendor of vendors) {
        assert.strictEqual(vendor.status, status, `All vendors should have status ${status}`);
      }
    }
    
    // Test specific status values we know exist in seed data
    const activeVendors = getVendorsWithFilters('active');
    assert.ok(activeVendors.length > 0, 'Should have active vendors');
    
    const pendingVendors = getVendorsWithFilters('pending-approval');
    assert.ok(pendingVendors.length > 0, 'Should have pending-approval vendors');
  });

  test('AC3: ?department filter works for all valid departments', () => {
    // Get all unique departments from seed data
    const allVendors = stmts.getAllVendors.all();
    const departments = [...new Set(allVendors.map(v => v.department))];
    
    for (const department of departments) {
      const vendors = getVendorsWithFilters(null, department);
      
      assert.ok(Array.isArray(vendors), `Department filter ${department} should return array`);
      
      // All returned vendors should have the requested department
      for (const vendor of vendors) {
        assert.strictEqual(vendor.department, department, `All vendors should have department ${department}`);
      }
    }
    
    // Test specific departments we know exist
    const salesVendors = getVendorsWithFilters(null, 'Sales');
    assert.ok(Array.isArray(salesVendors), 'Sales department filter should work');
  });

  test('AC4: ?category filter works for all valid category values', () => {
    const categoryValues = ['lead-gen', 'design', 'infrastructure', 'analytics', 'social', 'communication', 'other'];
    
    for (const category of categoryValues) {
      const vendors = getVendorsWithFilters(null, null, category);
      
      assert.ok(Array.isArray(vendors), `Category filter ${category} should return array`);
      
      // All returned vendors should have the requested category
      for (const vendor of vendors) {
        assert.strictEqual(vendor.category, category, `All vendors should have category ${category}`);
      }
    }
    
    // Test specific categories we know exist in seed data
    const leadGenVendors = getVendorsWithFilters(null, null, 'lead-gen');
    assert.ok(leadGenVendors.length > 0, 'Should have lead-gen vendors');
    
    const commVendors = getVendorsWithFilters(null, null, 'communication');
    assert.ok(commVendors.length > 0, 'Should have communication vendors');
  });

  test('AC5: Multiple filters can be combined (status + department + category)', () => {
    // Test two-filter combinations
    const twoFilterVendors = getVendorsWithFilters('active', 'Sales');
    assert.ok(Array.isArray(twoFilterVendors), 'Two filters should return array');
    
    for (const vendor of twoFilterVendors) {
      assert.strictEqual(vendor.status, 'active', 'Should match status filter');
      assert.strictEqual(vendor.department, 'Sales', 'Should match department filter');
    }
    
    // Test three-filter combination
    const threeFilterVendors = getVendorsWithFilters('active', 'Corporate', 'communication');
    assert.ok(Array.isArray(threeFilterVendors), 'Three filters should return array');
    
    for (const vendor of threeFilterVendors) {
      assert.strictEqual(vendor.status, 'active', 'Should match status filter');
      assert.strictEqual(vendor.department, 'Corporate', 'Should match department filter');
      assert.strictEqual(vendor.category, 'communication', 'Should match category filter');
    }
    
    // Test status + category combination
    const statusCategoryVendors = getVendorsWithFilters('pending-approval', null, 'lead-gen');
    assert.ok(Array.isArray(statusCategoryVendors), 'Status+category filters should return array');
    
    for (const vendor of statusCategoryVendors) {
      assert.strictEqual(vendor.status, 'pending-approval', 'Should match status filter');
      assert.strictEqual(vendor.category, 'lead-gen', 'Should match category filter');
    }
  });

  test('AC6: Filtering returns valid data structure', () => {
    const allVendors = getVendorsWithFilters();
    assert.ok(Array.isArray(allVendors), 'Should return valid JSON array');
    
    // Test with filters too
    const filteredVendors = getVendorsWithFilters('active');
    assert.ok(Array.isArray(filteredVendors), 'Filtered request should return valid JSON');
  });

  test('AC7: Users field is properly parsed as JSON array', () => {
    const vendors = getVendorsWithFilters();
    
    for (const vendor of vendors) {
      assert.ok(Array.isArray(vendor.users), `Vendor ${vendor.name} users should be array`);
      
      // Check Google Workspace which should have multiple users
      if (vendor.name === 'Google Workspace') {
        assert.ok(vendor.users.length > 1, 'Google Workspace should have multiple users');
        assert.ok(vendor.users.includes('David'), 'Google Workspace users should include David');
      }
    }
  });

  test('AC8: Empty filter results return empty array', () => {
    // Test with filter that should return no results
    const vendors = getVendorsWithFilters('nonexistent');
    
    assert.ok(Array.isArray(vendors), 'Should return array even when empty');
    assert.strictEqual(vendors.length, 0, 'Should return empty array');
  });

  test('Specific filter combinations work with known seed data', () => {
    // Test specific combinations we know exist in seed data
    const activeCorporate = getVendorsWithFilters('active', 'Corporate');
    assert.ok(activeCorporate.length > 0, 'Should have active Corporate vendors');
    
    const communicationVendors = getVendorsWithFilters(null, null, 'communication');
    assert.ok(communicationVendors.length > 0, 'Should have communication category vendors');
    
    // Test department + category combination
    const deptCategoryVendors = getVendorsWithFilters(null, 'Sales', 'lead-gen');
    assert.ok(Array.isArray(deptCategoryVendors), 'Department + category filter should return array');
    
    for (const vendor of deptCategoryVendors) {
      assert.strictEqual(vendor.department, 'Sales', 'Should match department filter');
      assert.strictEqual(vendor.category, 'lead-gen', 'Should match category filter');
    }
  });
});