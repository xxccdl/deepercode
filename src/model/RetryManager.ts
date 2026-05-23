export interface RetryOptions {
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

export class RetryManager {
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(maxRetries: number = 3, baseDelayMs: number = 1000, maxDelayMs: number = 30000) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean,
    options?: RetryOptions,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.maxRetries) break;

        if (shouldRetry && !shouldRetry(lastError, attempt)) break;

        if (!shouldRetry && this.isDefaultNonRetryable(lastError)) break;

        const delay = this.calculateDelay(attempt);

        if (options?.onRetry) {
          options.onRetry(lastError, attempt, delay);
        }

        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  withTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    parentSignal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onParentAbort = (): void => {
        clearTimeout(timer);
        controller.abort();
        reject(new Error('Request was aborted'));
      };

      if (parentSignal) {
        if (parentSignal.aborted) {
          clearTimeout(timer);
          reject(new Error('Request was aborted'));
          return;
        }
        parentSignal.addEventListener('abort', onParentAbort, { once: true });
      }

      fn(controller.signal)
        .then((result) => {
          clearTimeout(timer);
          if (parentSignal) {
            parentSignal.removeEventListener('abort', onParentAbort);
          }
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          if (parentSignal) {
            parentSignal.removeEventListener('abort', onParentAbort);
          }
          reject(error);
        });
    });
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.maxDelayMs);
  }

  private isDefaultNonRetryable(error: Error): boolean {
    const msg = error.message.toLowerCase();
    if (msg.includes('400') && !msg.includes('429')) return true;
    if (msg.includes('401') || msg.includes('unauthorized')) return true;
    if (msg.includes('403') || msg.includes('forbidden')) return true;
    if (msg.includes('404') || msg.includes('not found')) return true;
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
