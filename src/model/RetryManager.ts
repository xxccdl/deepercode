export class RetryManager {
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(maxRetries: number = 3, baseDelayMs: number = 1000, maxDelayMs: number = 30000) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  async execute<T>(fn: () => Promise<T>, shouldRetry?: (error: Error, attempt: number) => boolean): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.maxRetries) {
          break;
        }

        if (shouldRetry && !shouldRetry(lastError, attempt)) {
          break;
        }

        const delay = Math.min(
          this.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          this.maxDelayMs,
        );

        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new Error('Request was aborted'));
      };

      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new Error('Request was aborted'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      fn()
        .then((result) => {
          clearTimeout(timer);
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          reject(error);
        });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
