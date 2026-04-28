/**
 * Smoke tests — verify critical modules load without errors.
 * These establish that the require graph is intact and exports match expectations.
 */

const path = require('path');

describe('Module loading', () => {

  test('utils.js loads with all exports', () => {
    const utils = require('../utils.js');
    const expected = ['getEasternHour', 'isActiveHours', 'isQuietHours',
      'logLateSession', 'generateEmbedding', 'saveMemoryWithEmbedding',
      'retrySupabaseCall', 'logJson'];
    expected.forEach(name => {
      expect(utils).toHaveProperty(name);
      expect(typeof utils[name]).toBe('function');
    });
  });

  test('cron/message_queue.js loads with all exports', () => {
    const mq = require('../cron/message_queue.js');
    expect(mq).toHaveProperty('enqueue');
    expect(mq).toHaveProperty('enqueueMessage');
    expect(mq).toHaveProperty('flush');
    expect(mq).toHaveProperty('flushQueue');
    expect(mq).toHaveProperty('pending');
    expect(typeof mq.enqueue).toBe('function');
    expect(typeof mq.flush).toBe('function');
  });

  test('cron/message_bridge.js loads and exports sendMessage', () => {
    const mb = require('../cron/message_bridge.js');
    expect(mb).toHaveProperty('sendMessage');
    expect(typeof mb.sendMessage).toBe('function');
  });

  test('cron/capability_monitor.js loads with all exports', () => {
    const cm = require('../cron/capability_monitor.js');
    expect(cm).toHaveProperty('setCapabilityStatus');
    expect(cm).toHaveProperty('getCapabilityStatus');
    expect(cm).toHaveProperty('applyDependencyResults');
    expect(cm).toHaveProperty('CAPABILITIES');
    expect(typeof cm.setCapabilityStatus).toBe('function');
    expect(typeof cm.getCapabilityStatus).toBe('function');
    expect(typeof cm.applyDependencyResults).toBe('function');
  });

  test('cron/dependency_healthcheck.js exports checkDependencies', () => {
    const dh = require('../cron/dependency_healthcheck.js');
    expect(dh).toHaveProperty('checkDependencies');
    expect(typeof dh.checkDependencies).toBe('function');
  });

  test('security/input_sanitizer.js exports core functions', () => {
    const san = require('../security/input_sanitizer.js');
    expect(san).toHaveProperty('sanitizeInput');
    expect(san).toHaveProperty('sanitizeMemoryContent');
  });
});
