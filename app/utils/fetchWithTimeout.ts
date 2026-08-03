// Wraps Nuxt's $fetch so a request that never settles rejects instead of
// hanging forever (see app/stores/feed.ts's refresh flow, which otherwise
// leaves loading state wedged with no error). The AbortController cancels the
// in-flight request; the racing timeout promise guarantees rejection even when
// the underlying transport ignores the abort signal.

type FetchRequest = Parameters<typeof $fetch>[0];
type FetchOptions = NonNullable<Parameters<typeof $fetch>[1]>;

export class FetchTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

export function $fetchWithTimeout<T>(
  request: FetchRequest,
  options: FetchOptions,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new FetchTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  const response = $fetch<T>(request, {
    ...options,
    signal: controller.signal,
  });

  return Promise.race([response, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}
