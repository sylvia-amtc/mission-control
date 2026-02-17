const http = require('http');
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Server-side SPA Route Handler', () => {
  const baseUrl = 'http://localhost:3000';
  
  const makeRequest = (path) => {
    return new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Request timeout')));
    });
  };

  it('should serve API routes normally', async () => {
    const response = await makeRequest('/api/data');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['content-type'], 'application/json; charset=utf-8');
    
    // Should be valid JSON
    const data = JSON.parse(response.data);
    assert(typeof data === 'object');
  });

  it('should serve index.html for /dashboard route', async () => {
    const response = await makeRequest('/dashboard');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8');
    
    // Should contain HTML content
    assert(response.data.includes('<html') || response.data.includes('<!DOCTYPE html>'));
  });

  it('should serve index.html for /kanban route', async () => {
    const response = await makeRequest('/kanban');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8');
    
    // Should contain HTML content
    assert(response.data.includes('<html') || response.data.includes('<!DOCTYPE html>'));
  });

  it('should serve index.html for /actions route', async () => {
    const response = await makeRequest('/actions');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8');
    
    // Should contain HTML content  
    assert(response.data.includes('<html') || response.data.includes('<!DOCTYPE html>'));
  });

  it('should serve index.html for /actions/123 route', async () => {
    const response = await makeRequest('/actions/123');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8');
    
    // Should contain HTML content
    assert(response.data.includes('<html') || response.data.includes('<!DOCTYPE html>'));
  });

  it('should serve index.html for other SPA routes', async () => {
    const routes = ['/calendar', '/org', '/sync', '/crm', '/gantt'];
    
    for (const route of routes) {
      const response = await makeRequest(route);
      assert.strictEqual(response.status, 200, `Route ${route} should return 200`);
      assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8', `Route ${route} should return HTML`);
      assert(response.data.includes('<html') || response.data.includes('<!DOCTYPE html>'), `Route ${route} should return HTML content`);
    }
  });

  it('should still serve API routes after adding catch-all', async () => {
    const apiRoutes = ['/api/tasks', '/api/actions', '/api/kpis', '/api/stats'];
    
    for (const route of apiRoutes) {
      const response = await makeRequest(route);
      assert.strictEqual(response.status, 200, `API route ${route} should return 200`);
      assert.strictEqual(response.headers['content-type'], 'application/json; charset=utf-8', `API route ${route} should return JSON`);
      
      // Should be valid JSON
      const data = JSON.parse(response.data);
      assert(typeof data === 'object', `API route ${route} should return JSON object`);
    }
  });

  it('should not interfere with static files', async () => {
    // Test that static files from public directory still work
    const response = await makeRequest('/index.html');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['content-type'], 'text/html; charset=utf-8');
    assert(response.data.includes('<html') || response.data.includes('<!DOCTYPE html>'));
  });
});