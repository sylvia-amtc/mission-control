const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('US-014: Vendor MCP Tools', () => {
  
  it('AC1: vendor_list tool exists with proper schema', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check vendor_list tool exists
    assert(mcpContent.includes("server.tool('vendor_list'"), 'vendor_list tool should exist');
    assert(mcpContent.includes('List vendors with optional filters'), 'vendor_list should have proper description');
    
    // Check filtering parameters
    assert(mcpContent.includes("status: z.enum(['active', 'trial', 'pending-approval', 'suspended', 'cancelled'])"), 'vendor_list should support status filter');
    assert(mcpContent.includes('department: z.string().optional()'), 'vendor_list should support department filter');
    assert(mcpContent.includes("category: z.enum(['lead-gen', 'design', 'infrastructure', 'analytics', 'social', 'communication', 'other'])"), 'vendor_list should support category filter');
    assert(mcpContent.includes('limit: z.number().optional()'), 'vendor_list should support limit parameter');
  });

  it('AC2: vendor_get tool exists with proper schema', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check vendor_get tool exists
    assert(mcpContent.includes("server.tool('vendor_get'"), 'vendor_get tool should exist');
    assert(mcpContent.includes('Get a single vendor by ID'), 'vendor_get should have proper description');
    assert(mcpContent.includes('id: z.number().describe(\'Vendor ID\')'), 'vendor_get should require id parameter');
  });

  it('AC3: vendor_create tool exists with proper schema', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check vendor_create tool exists
    assert(mcpContent.includes("server.tool('vendor_create'"), 'vendor_create tool should exist');
    assert(mcpContent.includes('Create a new vendor record'), 'vendor_create should have proper description');
    
    // Check required fields
    assert(mcpContent.includes('name: z.string().describe(\'Vendor name\')'), 'vendor_create should require name');
    assert(mcpContent.includes("category: z.enum(['lead-gen', 'design', 'infrastructure', 'analytics', 'social', 'communication', 'other']).describe('Vendor category')"), 'vendor_create should require category');
    
    // Check optional fields
    assert(mcpContent.includes('url: z.string().optional()'), 'vendor_create should support optional url');
    assert(mcpContent.includes('cost_monthly: z.number().optional()'), 'vendor_create should support optional cost_monthly');
    assert(mcpContent.includes('users: z.array(z.string()).optional()'), 'vendor_create should support optional users array');
    
    // Check it uses API proxy
    assert(mcpContent.includes("apiResult(await api('POST', '/api/vendors', args))"), 'vendor_create should proxy to POST /api/vendors');
  });

  it('AC4: vendor_update tool exists with proper schema', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check vendor_update tool exists
    assert(mcpContent.includes("server.tool('vendor_update'"), 'vendor_update tool should exist');
    assert(mcpContent.includes('Update an existing vendor record'), 'vendor_update should have proper description');
    
    // Check required id parameter
    assert(mcpContent.includes('id: z.number().describe(\'Vendor ID\')'), 'vendor_update should require id parameter');
    
    // Check optional update fields
    assert(mcpContent.includes('name: z.string().optional()'), 'vendor_update should support optional name');
    assert(mcpContent.includes('category: z.enum([\'lead-gen\''), 'vendor_update should support optional category');
    assert(mcpContent.includes('status: z.enum([\'active\''), 'vendor_update should support optional status');
    
    // Check it uses API proxy with PATCH
    assert(mcpContent.includes("apiResult(await api('PATCH', `/api/vendors/${id}`, body))"), 'vendor_update should proxy to PATCH /api/vendors/:id');
  });

  it('AC5: vendor_summary tool exists with aggregated metrics', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check vendor_summary tool exists
    assert(mcpContent.includes("server.tool('vendor_summary'"), 'vendor_summary tool should exist');
    assert(mcpContent.includes('Get vendor summary with aggregated metrics'), 'vendor_summary should have proper description');
    
    // Check it uses database queries directly
    assert(mcpContent.includes('stmts.getVendorSummary.get()'), 'vendor_summary should use getVendorSummary prepared statement');
    assert(mcpContent.includes('stmts.getAllVendors.all()'), 'vendor_summary should get all vendors for aggregation');
    
    // Check aggregation logic
    assert(mcpContent.includes('count_by_status'), 'vendor_summary should count by status');
    assert(mcpContent.includes('count_by_department'), 'vendor_summary should count by department');
    assert(mcpContent.includes('total_monthly_spend'), 'vendor_summary should calculate monthly spend');
    assert(mcpContent.includes("v.status === 'active'"), 'vendor_summary should filter active vendors for spend calculation');
  });

  it('AC6: All tools follow existing MCP patterns', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check all vendor tools use proper return format
    const vendorToolMatches = mcpContent.match(/server\.tool\('vendor_\w+'/g);
    assert(vendorToolMatches && vendorToolMatches.length === 5, 'Should have exactly 5 vendor tools');
    
    // Check return patterns
    assert(mcpContent.includes("return { content: [{ type: 'text', text: JSON.stringify(vendors, null, 2) }] }"), 'vendor_list should return proper JSON format');
    assert(mcpContent.includes("return { content: [{ type: 'text', text: JSON.stringify(vendor, null, 2) }] }"), 'vendor_get should return proper JSON format');
    assert(mcpContent.includes("return { content: [{ type: 'text', text: 'Vendor not found' }], isError: true }"), 'vendor_get should handle not found errors');
    
    // Check write tools use apiResult pattern
    assert(mcpContent.includes('async (args) => apiResult(await api(\'POST\''), 'vendor_create should use apiResult pattern');
    assert(mcpContent.includes('async ({ id, ...body }) => apiResult(await api(\'PATCH\''), 'vendor_update should use apiResult pattern');
  });

  it('AC7: Tools handle errors gracefully', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check vendor_get handles not found case
    assert(mcpContent.includes("if (!vendor) return { content: [{ type: 'text', text: 'Vendor not found' }], isError: true }"), 'vendor_get should handle vendor not found');
    
    // Check JSON parsing error handling
    assert(mcpContent.includes('try { v.users = JSON.parse(v.users); } catch { v.users = []; }'), 'vendor_list should handle JSON parse errors');
    assert(mcpContent.includes('try { vendor.users = JSON.parse(vendor.users); } catch { vendor.users = []; }'), 'vendor_get should handle JSON parse errors');
    
    // Check write tools use apiResult which handles HTTP errors
    assert(mcpContent.includes('apiResult(await api('), 'Write tools should use apiResult for error handling');
  });

  it('AC8: vendor_list supports filtering parameters', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check multiple filter logic
    assert(mcpContent.includes('if (status) vendors = stmts.getVendorsByStatus.all(status)'), 'vendor_list should filter by status');
    assert(mcpContent.includes('else if (department) vendors = stmts.getVendorsByDept.all(department)'), 'vendor_list should filter by department');
    assert(mcpContent.includes('else if (category) vendors = stmts.getVendorsByCategory.all(category)'), 'vendor_list should filter by category');
    
    // Check multi-filter combinations
    assert(mcpContent.includes('if (status && department) vendors = vendors.filter(v => v.department === department)'), 'vendor_list should support status + department filters');
    assert(mcpContent.includes('if (status && department && category)'), 'vendor_list should support triple filter combinations');
    
    // Check limit parameter
    assert(mcpContent.includes('vendors = vendors.slice(0, limit || 50)'), 'vendor_list should respect limit parameter with default 50');
  });

  it('AC9: JSON users arrays are properly parsed', () => {
    const mcpContent = fs.readFileSync(path.join(__dirname, 'mcp-server.js'), 'utf8');
    
    // Check vendor_list parses users arrays
    assert(mcpContent.includes('vendors.forEach(v => {'), 'vendor_list should iterate through vendors');
    assert(mcpContent.includes('if (v.users) {'), 'vendor_list should check users field exists');
    assert(mcpContent.includes('try { v.users = JSON.parse(v.users); } catch { v.users = []; }'), 'vendor_list should parse JSON users with error handling');
    
    // Check vendor_get parses users array  
    assert(mcpContent.includes('if (vendor.users) {'), 'vendor_get should check users field exists');
    assert(mcpContent.includes('try { vendor.users = JSON.parse(vendor.users); } catch { vendor.users = []; }'), 'vendor_get should parse JSON users with error handling');
  });

});