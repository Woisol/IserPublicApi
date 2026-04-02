export interface RetryOptions<T> {
  retries?: number;
  delayMs?: number;
  shouldRetry?: (result: T, attempt: number) => boolean;
  shouldRetryOnError?: (error: unknown, attempt: number) => boolean;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 通用异步重试：支持按返回值或异常决定是否继续重试。
 */
export async function retry<T>(
  task: () => Promise<T>,
  {
    retries = 2,
    delayMs = 1000,
    shouldRetry,
    shouldRetryOnError = () => true,
  }: RetryOptions<T> = {},
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const result = await task();
      const needRetry = shouldRetry?.(result, attempt) ?? false;
      if (!needRetry || attempt === retries) {
        return result;
      }
    } catch (error) {
      lastError = error;
      const allowRetry = shouldRetryOnError(error, attempt);
      if (!allowRetry || attempt === retries) {
        throw error;
      }
    }

    attempt += 1;
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error('Retry attempts exhausted');
}
