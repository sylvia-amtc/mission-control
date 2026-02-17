const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// US-013: Add cost breakdown visualization

describe('US-013: Cost Breakdown Visualization', () => {
  let dom, document, window;
  
  test('setup', () => {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    document = dom.window.document;
    window = dom.window;
    
    // Mock Chart.js since it won't load in JSDOM
    window.Chart = class MockChart {
      constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.data = config.data;
        this.options = config.options;
      }
      
      destroy() {
        // Mock destroy method
      }
    };
    
    // Mock console methods to avoid test noise
    window.console.error = () => {};
    window.console.log = () => {};
  });

  test('AC1: Cost breakdown chart displays below summary cards', () => {
    // Find the cost breakdown section
    const costBreakdownChart = document.getElementById('cost-breakdown-chart');
    assert.ok(costBreakdownChart, 'Cost breakdown chart canvas should exist');
    
    const costBreakdownSection = costBreakdownChart.closest('.card');
    assert.ok(costBreakdownSection, 'Cost breakdown chart section should exist');
    
    // Check it's positioned after summary cards
    const summaryCards = document.getElementById('vendor-summary-cards');
    const statusFilter = document.getElementById('vendor-status-filter');
    
    assert.ok(summaryCards, 'Summary cards should exist');
    assert.ok(statusFilter, 'Status filter should exist');
    
    // Check the cost breakdown section appears between summary cards and filters
    const vendorsSection = document.getElementById('sec-vendors');
    assert.ok(vendorsSection, 'Vendors section should exist');
    
    const allElements = Array.from(vendorsSection.children);
    const summaryIndex = allElements.findIndex(el => el.id === 'vendor-summary-cards' || el.querySelector('#vendor-summary-cards'));
    const chartIndex = allElements.findIndex(el => el.querySelector('#cost-breakdown-chart'));
    const filtersIndex = allElements.findIndex(el => el.querySelector('#vendor-status-filter'));
    
    assert.ok(summaryIndex >= 0, 'Should find summary cards');
    assert.ok(chartIndex >= 0, 'Should find cost breakdown chart');
    assert.ok(filtersIndex >= 0, 'Should find filters');
    assert.ok(summaryIndex < chartIndex, 'Cost breakdown should be after summary cards');
    assert.ok(chartIndex < filtersIndex, 'Cost breakdown should be before filters');
  });

  test('AC2: Chart canvas and container structure exists', () => {
    const canvas = document.getElementById('cost-breakdown-chart');
    assert.ok(canvas, 'Chart canvas should exist');
    assert.equal(canvas.tagName, 'CANVAS', 'Element should be a canvas');
    
    // Check canvas is in proper container structure
    const container = canvas.closest('div[style*="width:400px"]');
    assert.ok(container, 'Canvas should be in proper sized container');
    
    // Check header text
    const header = document.querySelector('.card:has(#cost-breakdown-chart) h3');
    assert.ok(header, 'Chart section should have header');
    assert.ok(header.textContent.includes('Cost Breakdown by Department'), 'Header should mention cost breakdown');
  });

  test('AC3: renderCostBreakdownChart function exists and is properly structured', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check function exists
    assert.ok(htmlContent.includes('function renderCostBreakdownChart'), 'renderCostBreakdownChart function should exist');
    
    // Check it's async for API calls
    assert.ok(htmlContent.includes('async function renderCostBreakdownChart'), 'Function should be async');
    
    // Check it fetches active vendors
    assert.ok(htmlContent.includes("api('/api/vendors?status=active')"), 'Function should fetch active vendors');
    
    // Check it filters for positive costs
    assert.ok(htmlContent.includes('monthlyCost > 0'), 'Function should exclude $0 spend');
    
    // Check Chart.js initialization
    assert.ok(htmlContent.includes('new Chart('), 'Function should create Chart.js instance');
    assert.ok(htmlContent.includes("type: 'doughnut'"), 'Chart should use doughnut type');
  });

  test('AC4: Department color mapping exists and uses consistent colors', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check department colors object exists
    assert.ok(htmlContent.includes('departmentColors'), 'Department colors mapping should exist');
    
    // Check specific color mappings match existing department styling
    assert.ok(htmlContent.includes("'Engineering': '#60a5fa'"), 'Engineering should use blue color');
    assert.ok(htmlContent.includes("'Marketing': '#06b6d4'"), 'Marketing should use cyan color');
    assert.ok(htmlContent.includes("'Sales': '#4ade80'"), 'Sales should use green color');
    assert.ok(htmlContent.includes("'Operations': '#94a3b8'"), 'Operations should use gray color');
    assert.ok(htmlContent.includes("'Research': '#c084fc'"), 'Research should use purple color');
    assert.ok(htmlContent.includes("'Design': '#f472b6'"), 'Design should use pink color');
    assert.ok(htmlContent.includes("'Unassigned': '#64748b'"), 'Unassigned should use default gray');
  });

  test('AC5: Chart legend configuration shows department names and amounts', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check legend configuration
    assert.ok(htmlContent.includes("position: 'bottom'"), 'Legend should be positioned at bottom');
    assert.ok(htmlContent.includes('generateLabels'), 'Legend should have custom label generation');
    
    // Check label formatting includes amounts
    assert.ok(htmlContent.includes('${label}: ${formatted}'), 'Legend labels should include department and amount');
    assert.ok(htmlContent.includes('toFixed(0)'), 'Amounts should be formatted as currency');
  });

  test('AC6: Chart tooltip shows detailed information', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check tooltip configuration exists
    assert.ok(htmlContent.includes('tooltip:'), 'Chart should have tooltip configuration');
    
    // Check tooltip styling uses app colors
    assert.ok(htmlContent.includes("backgroundColor: '#1a1d2e'"), 'Tooltip should use app background color');
    assert.ok(htmlContent.includes("titleColor: '#e2e8f0'"), 'Tooltip should use app text color');
    
    // Check tooltip shows percentage
    assert.ok(htmlContent.includes('percentage'), 'Tooltip should show percentage');
    assert.ok(htmlContent.includes('toFixed(1)'), 'Percentage should be formatted to 1 decimal');
  });

  test('AC7: Chart instance management and cleanup', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check global chart instance variable
    assert.ok(htmlContent.includes('costBreakdownChartInstance'), 'Should have global chart instance variable');
    
    // Check destroy existing chart before creating new one
    assert.ok(htmlContent.includes('costBreakdownChartInstance.destroy()'), 'Should destroy existing chart');
    assert.ok(htmlContent.includes('costBreakdownChartInstance = null'), 'Should reset instance to null');
  });

  test('AC8: Chart updates when vendor data changes - integration with loadVendors', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check that renderCostBreakdownChart is called from loadVendors
    // Use a more flexible pattern since there might be nested braces
    const loadVendorsStart = htmlContent.indexOf('async function loadVendors()');
    assert.ok(loadVendorsStart !== -1, 'loadVendors function should exist');
    
    // Find the end of the function by counting braces
    let braceCount = 0;
    let i = loadVendorsStart;
    let functionStart = -1;
    
    while (i < htmlContent.length) {
      if (htmlContent[i] === '{') {
        if (functionStart === -1) functionStart = i;
        braceCount++;
      } else if (htmlContent[i] === '}') {
        braceCount--;
        if (braceCount === 0) break;
      }
      i++;
    }
    
    const loadVendorsFunction = htmlContent.substring(loadVendorsStart, i + 1);
    assert.ok(loadVendorsFunction.includes('renderCostBreakdownChart'), 'loadVendors should call renderCostBreakdownChart');
    
    // Check it's called after vendors are loaded, not before
    const vendorsAssignIndex = loadVendorsFunction.indexOf('VENDORS = await api(url)');
    const chartCallIndex = loadVendorsFunction.indexOf('renderCostBreakdownChart');
    assert.ok(vendorsAssignIndex !== -1, 'VENDORS should be assigned in loadVendors');
    assert.ok(chartCallIndex !== -1, 'renderCostBreakdownChart should be called in loadVendors');
    assert.ok(vendorsAssignIndex < chartCallIndex, 'Chart should render after vendors are loaded');
  });

  test('AC9: Error handling for chart rendering', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check try-catch block exists
    assert.ok(htmlContent.includes('try {'), 'Function should have error handling');
    assert.ok(htmlContent.includes('} catch (error)'), 'Function should catch errors');
    
    // Check fallback error display
    assert.ok(htmlContent.includes('Error loading chart'), 'Should show error message on canvas');
    
    // Check empty data handling
    assert.ok(htmlContent.includes('No active vendor spending data'), 'Should handle empty data gracefully');
  });

  test('AC10: Chart styling and responsiveness', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Check responsive configuration
    assert.ok(htmlContent.includes('responsive: true'), 'Chart should be responsive');
    assert.ok(htmlContent.includes('maintainAspectRatio: true'), 'Chart should maintain aspect ratio');
    
    // Check container sizing
    assert.ok(htmlContent.includes('width:400px;height:300px'), 'Chart container should have fixed dimensions');
    
    // Check font styling matches app
    assert.ok(htmlContent.includes("family: 'Inter'"), 'Chart should use Inter font');
  });

  test('AC11: Chart description and accessibility', () => {
    const costBreakdownChart = document.getElementById('cost-breakdown-chart');
    assert.ok(costBreakdownChart, 'Chart canvas should exist');
    
    const chartSection = costBreakdownChart.closest('.card');
    assert.ok(chartSection, 'Chart section should exist');
    
    // Check descriptive text
    const description = chartSection.querySelector('.text-center.text-xs');
    assert.ok(description, 'Chart should have description text');
    assert.ok(description.textContent.includes('Monthly spend by department'), 'Description should mention monthly spend');
    assert.ok(description.textContent.includes('active vendors only'), 'Description should mention active vendors only');
  });
});