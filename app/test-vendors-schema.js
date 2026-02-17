const { test } = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Create a temporary test database
const TEST_DB_PATH = ':memory:';

test('US-001: Create vendors table schema and migration', async (t) => {
  let testDb;

  await t.test('Database setup and schema creation', async () => {
    // Create test database with same structure as main db.js
    testDb = new Database(TEST_DB_PATH);
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');

    // Execute the same schema as in db.js
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('lead-gen','design','infrastructure','analytics','social','communication','other')),
        url TEXT DEFAULT '',
        plan TEXT DEFAULT '',
        cost_monthly DECIMAL DEFAULT 0,
        cost_annual DECIMAL,
        billing_cycle TEXT DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual','one-time','free')),
        owner TEXT DEFAULT '',
        users TEXT DEFAULT '[]',
        department TEXT DEFAULT '',
        status TEXT DEFAULT 'active' CHECK(status IN ('active','trial','pending-approval','suspended','cancelled')),
        login_email TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        renewal_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
      CREATE INDEX IF NOT EXISTS idx_vendors_department ON vendors(department);
      CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
    `);
  });

  await t.test('AC1: vendors table exists with all 15 required columns', async () => {
    const tableInfo = testDb.prepare("PRAGMA table_info(vendors)").all();
    const columnNames = tableInfo.map(col => col.name);
    
    const expectedColumns = [
      'id', 'name', 'category', 'url', 'plan', 
      'cost_monthly', 'cost_annual', 'billing_cycle', 'owner', 'users',
      'department', 'status', 'login_email', 'notes', 'renewal_date',
      'created_at', 'updated_at'
    ];

    assert.strictEqual(columnNames.length, 17, 'Should have 17 columns total');
    expectedColumns.forEach(col => {
      assert(columnNames.includes(col), `Should have column: ${col}`);
    });
  });

  await t.test('AC2: CHECK constraints enforce valid enum values', async () => {
    // Test category constraint
    const insertStmt = testDb.prepare(`INSERT INTO vendors (name, category, billing_cycle, status) VALUES (?, ?, ?, ?)`);
    
    // Valid values should work
    assert.doesNotThrow(() => {
      insertStmt.run('Test Vendor', 'lead-gen', 'monthly', 'active');
    }, 'Should accept valid category');

    // Invalid category should fail
    assert.throws(() => {
      insertStmt.run('Invalid Vendor', 'invalid-category', 'monthly', 'active');
    }, 'Should reject invalid category');

    // Test billing_cycle constraint
    assert.throws(() => {
      insertStmt.run('Invalid Billing', 'design', 'invalid-billing', 'active');
    }, 'Should reject invalid billing_cycle');

    // Test status constraint  
    assert.throws(() => {
      insertStmt.run('Invalid Status', 'design', 'monthly', 'invalid-status');
    }, 'Should reject invalid status');
  });

  await t.test('AC3: Indexes created on status, department, category columns', async () => {
    const indexes = testDb.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='vendors'").all();
    const indexNames = indexes.map(idx => idx.name);
    
    assert(indexNames.includes('idx_vendors_status'), 'Should have status index');
    assert(indexNames.includes('idx_vendors_department'), 'Should have department index');  
    assert(indexNames.includes('idx_vendors_category'), 'Should have category index');
  });

  await t.test('AC4: created_at and updated_at have datetime(now) defaults', async () => {
    const tableInfo = testDb.prepare("PRAGMA table_info(vendors)").all();
    
    const createdAtCol = tableInfo.find(col => col.name === 'created_at');
    const updatedAtCol = tableInfo.find(col => col.name === 'updated_at');
    
    assert.strictEqual(createdAtCol.dflt_value, "datetime('now')", 'created_at should have datetime(now) default');
    assert.strictEqual(updatedAtCol.dflt_value, "datetime('now')", 'updated_at should have datetime(now) default');
  });

  await t.test('AC5: users column stores JSON array', async () => {
    const insertStmt = testDb.prepare(`INSERT INTO vendors (name, category, users) VALUES (?, ?, ?)`);
    const selectStmt = testDb.prepare(`SELECT users FROM vendors WHERE name = ?`);
    
    // Test JSON array storage
    const testUsers = JSON.stringify(['user1', 'user2', 'user3']);
    insertStmt.run('JSON Test Vendor', 'design', testUsers);
    
    const result = selectStmt.get('JSON Test Vendor');
    assert.strictEqual(result.users, testUsers, 'Should store JSON array as text');
    
    // Verify it can be parsed back to array
    const parsedUsers = JSON.parse(result.users);
    assert(Array.isArray(parsedUsers), 'Should parse back to array');
    assert.strictEqual(parsedUsers.length, 3, 'Should have 3 users');
  });

  await t.test('AC6: cost_monthly and cost_annual are DECIMAL type', async () => {
    const tableInfo = testDb.prepare("PRAGMA table_info(vendors)").all();
    
    const costMonthlyCol = tableInfo.find(col => col.name === 'cost_monthly');
    const costAnnualCol = tableInfo.find(col => col.name === 'cost_annual');
    
    assert.strictEqual(costMonthlyCol.type, 'DECIMAL', 'cost_monthly should be DECIMAL type');
    assert.strictEqual(costAnnualCol.type, 'DECIMAL', 'cost_annual should be DECIMAL type');
  });

  await t.test('AC7: Basic vendor operations work correctly', async () => {
    const insertStmt = testDb.prepare(`INSERT INTO vendors (name, category, cost_monthly, cost_annual, billing_cycle, owner, users, department, status, login_email, notes) VALUES (@name, @category, @cost_monthly, @cost_annual, @billing_cycle, @owner, @users, @department, @status, @login_email, @notes)`);
    const selectStmt = testDb.prepare(`SELECT * FROM vendors WHERE name = ?`);
    
    // Insert test vendor
    const testVendor = {
      name: 'Apollo.io',
      category: 'lead-gen',
      cost_monthly: 49.00,
      cost_annual: 490.00,
      billing_cycle: 'monthly',
      owner: 'Elena',
      users: JSON.stringify(['Elena', 'Petra', 'Isla']),
      department: 'Sales & Business Dev',
      status: 'pending-approval',
      login_email: 'elena@amtc.tv',
      notes: 'Lead generation tool for sales team'
    };
    
    insertStmt.run(testVendor);
    
    const result = selectStmt.get('Apollo.io');
    assert.strictEqual(result.name, testVendor.name);
    assert.strictEqual(result.category, testVendor.category);
    assert.strictEqual(result.cost_monthly, testVendor.cost_monthly);
    assert.strictEqual(result.billing_cycle, testVendor.billing_cycle);
    assert.strictEqual(result.status, testVendor.status);
    assert(result.created_at, 'Should have created_at timestamp');
    assert(result.updated_at, 'Should have updated_at timestamp');
  });

  await t.test('Prepared statements work with main database', async () => {
    // Test that main database file loads without errors
    const { db, stmts } = require('./db.js');
    
    // Test vendor prepared statements exist
    assert(stmts.getAllVendors, 'Should have getAllVendors statement');
    assert(stmts.getVendorsByStatus, 'Should have getVendorsByStatus statement');
    assert(stmts.getVendorsByDepartment, 'Should have getVendorsByDepartment statement');
    assert(stmts.getVendorsByCategory, 'Should have getVendorsByCategory statement');
    assert(stmts.insertVendor, 'Should have insertVendor statement');
    assert(stmts.updateVendor, 'Should have updateVendor statement');
    assert(stmts.vendorSummary, 'Should have vendorSummary statement');
    
    // Test basic query execution (should not throw)
    const vendors = stmts.getAllVendors.all();
    assert(Array.isArray(vendors), 'getAllVendors should return array');
    
    // Test summary query
    const summary = stmts.vendorSummary.get();
    assert(typeof summary === 'object', 'vendorSummary should return object');
    assert(typeof summary.total_count === 'number', 'Should have total_count');
  });

  // Cleanup
  if (testDb) {
    testDb.close();
  }
});