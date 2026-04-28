const fs = require('fs');
const { enqueueMessage, flushQueue } = require('../cron/message_queue.js');

describe('Message Queue', () => {
 const queueFile = '/data/.openclaw/workspace/message_queue.jsonl';

 beforeEach(() => {
 if (fs.existsSync(queueFile)) fs.unlinkSync(queueFile);
 });

 it('should enqueue message to disk', () => {
 const id = enqueueMessage('123456789', 'Test message', 'discord');
 expect(id).toBeDefined();
 expect(fs.existsSync(queueFile)).toBe(true);
 });

 it('should write valid JSONL format', () => {
 enqueueMessage('123456789', 'Test message 1', 'discord');
 enqueueMessage('123456789', 'Test message 2', 'discord');

 const content = fs.readFileSync(queueFile, 'utf-8');
 const lines = content.split('\n').filter(Boolean);
 expect(lines.length).toBe(2);

 lines.forEach(line => {
 const msg = JSON.parse(line);
 expect(msg.id).toBeDefined();
 expect(msg.retries).toBe(0);
 });
 });

 it('should handle queue file not existing gracefully', async () => {
 const result = await flushQueue();
 expect(result.flushed).toBe(0);
 expect(result.failed).toBe(0);
 });
});
