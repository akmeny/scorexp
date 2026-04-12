export interface RetryOptions {
  retries: number;
  minDelayMs: number;
  factor?: number;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (
    error: unknown,
    attempt: number,
    nextDelayMs: number,
  ) => void | Promise<void>;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let attempt = 0;
  const factor = options.factor ?? 2;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= options.retries || !options.shouldRetry(error)) {
        throw error;
      }

      attempt += 1;
      const nextDelayMs = options.minDelayMs * factor ** (attempt - 1);

      await options.onRetry?.(error, attempt, nextDelayMs);
      await sleep(nextDelayMs);
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
