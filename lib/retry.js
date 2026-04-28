/**
 * Centralized retry with exponential backoff.
 * Eliminates copy-pasted retry logic across the codebase.
 */

/**
 * Execute an operation with retry and exponential backoff.
 * @param {Function} operation - Async function to retry
 * @param {object} [options]
 * @param {number} [options.maxAttempts=3] - Maximum retry attempts
 * @param {number} [options.initialDelayMs=1000] - Initial delay before first retry
 * @param {number} [options.backoffMultiplier=2] - Multiplier for each subsequent delay
 * @param {number} [options.timeoutMs=30000] - Per-attempt timeout
 * @param {Function} [options.onRetry] - Called before each retry with (attempt, error, delayMs)
 * @param {Function} [options.onFailure] - Called after all retries exhausted with (error)
 * @returns {Promise<any>} Result of the operation
 * @throws {Error} Last error if all attempts fail
 */
async function retryWithBackoff(operation, options = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
    timeoutMs = 30000,
    onRetry = null,
    onFailure = null
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let timeoutTimer;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutTimer = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      });
      const result = await Promise.race([operation(), timeoutPromise]);
      clearTimeout(timeoutTimer);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        if (onRetry) {
          try {
            const result = onRetry(attempt, error, delayMs);
            if (result && typeof result.catch === 'function') result.catch(() => {});
          } catch (_) { /* ignore onRetry errors */ }
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  if (onFailure) {
    try {
      const result = onFailure(lastError);
      if (result && typeof result.then === 'function') await result;
    } catch (_) { /* ignore onFailure errors during cleanup */ }
  }
  throw lastError;
}

module.exports = { retryWithBackoff };
