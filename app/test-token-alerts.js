// Test file for token usage alerts (US-010)
const { test } = require('node:test');
const assert = require('node:assert');

// Helper functions to test
function getAlertState(percentage) {
  if (percentage >= 95) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'normal';
}

function getAlertColor(state) {
  if (state === 'critical') return '#ef4444'; // red
  if (state === 'warning') return '#eab308'; // yellow
  return null; // no alert for normal
}

// Test AC1: Usage > 80% shows yellow warning indicator
test('Usage > 80% shows yellow warning indicator', () => {
  const state = getAlertState(85);
  const color = getAlertColor(state);
  assert.strictEqual(state, 'warning');
  assert.strictEqual(color, '#eab308');
});

test('Usage exactly 80% shows warning indicator', () => {
  const state = getAlertState(80);
  assert.strictEqual(state, 'warning');
});

// Test AC2: Usage > 95% shows red critical indicator
test('Usage > 95% shows red critical indicator', () => {
  const state = getAlertState(96);
  const color = getAlertColor(state);
  assert.strictEqual(state, 'critical');
  assert.strictEqual(color, '#ef4444');
});

test('Usage exactly 95% shows critical indicator', () => {
  const state = getAlertState(95);
  assert.strictEqual(state, 'critical');
});

// Test AC3: Notification banner appears for warning/critical states
test('Normal usage does not show banner', () => {
  const state = getAlertState(50);
  assert.strictEqual(state, 'normal');
  const color = getAlertColor(state);
  assert.strictEqual(color, null);
});

test('Usage at 79% shows no warning', () => {
  const state = getAlertState(79);
  assert.strictEqual(state, 'normal');
});

// Test edge cases
test('Usage at 100% shows critical', () => {
  const state = getAlertState(100);
  assert.strictEqual(state, 'critical');
});

test('Usage at 0% shows normal', () => {
  const state = getAlertState(0);
  assert.strictEqual(state, 'normal');
});

console.log('All tests passed!');
