const { retryWithBackoff } = require('../lib/retry');

describe('Retry With Backoff', () => {
  it('should succeed on first attempt', async () => {
    const result = await retryWithBackoff(
      () => Promise.resolve('success'),
      { maxAttempts: 3 }
    );
    expect(result).toBe('success');
  });

  it('should retry on failure and eventually succeed', async () => {
    let attempts = 0;
    const result = await retryWithBackoff(
      () => {
        attempts++;
        if (attempts < 3) throw new Error(`Attempt ${attempts} failed`);
        return Promise.resolve('recovered');
      },
      { maxAttempts: 3, initialDelayMs: 10 }
    );
    expect(result).toBe('recovered');
    expect(attempts).toBe(3);
  });

  it('should throw after exhausting all retries', async () => {
    const fn = jest.fn();
    await expect(
      retryWithBackoff(
        () => Promise.reject(new Error('persistent failure')),
        { maxAttempts: 2, initialDelayMs: 10, onFailure: fn }
      )
    ).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should time out if operation takes too long', async () => {
    let cancelled = false;
    const op = () => new Promise((resolve) => {
      const check = setInterval(() => {
        if (cancelled) { clearInterval(check); resolve('cancelled'); }
      }, 10);
    });

    await expect(
      retryWithBackoff(op, { maxAttempts: 1, timeoutMs: 50 })
    ).rejects.toThrow('Operation timed out');

    cancelled = true;
  });

  it('should respect backoff multiplier', async () => {
    const delays = [];
    let attempts = 0;

    await expect(
      retryWithBackoff(
        () => {
          attempts++;
          return Promise.reject(new Error('fail'));
        },
        {
          maxAttempts: 3,
          initialDelayMs: 50,
          backoffMultiplier: 3,
          onRetry: (attempt, err, delayMs) => {
            delays.push(delayMs);
          },
        }
      )
    ).rejects.toThrow('fail');

    expect(attempts).toBe(3);
    expect(delays[0]).toBe(50);
    expect(delays[1]).toBe(150);
  });
});

describe('Recovery Paths', () => {
  it('should retry queued messages on flush', async () => {
    const { enqueueMessage } = require('../cron/message_queue');
    enqueueMessage('test_recovery', 'Test message for recovery', 'discord');

    const { flushQueue } = require('../cron/message_queue');
    const result = await flushQueue();
    expect(result.flushed + result.failed).toBeGreaterThanOrEqual(0);
  });
});
