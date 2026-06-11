export async function fetchWithRetry(fetchFn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      // Exponential backoff: 1s, 2s, 4s:
      const delay = baseDelay * Math.pow(2, attempt);
      // Add jitter to prevent thundering herd:
      const jitter = Math.random() * 500;
      await new Promise(r => setTimeout(r, delay + jitter));
    }
  }

  throw lastError;
}
