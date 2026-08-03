// Wraps Nuxt's $fetch so a request that never settles rejects instead of
// hanging forever (see app/stores/feed.ts's refresh flow, which otherwise
// leaves loading state wedged with no error).
//
// Why not ofetch's built-in `timeout`: the racing timeout promise here
// guarantees rejection even when the underlying transport ignores the abort
// signal, and — unlike ofetch's internal timer — it can be exercised against a
// mocked $fetch, so the timeout behaviour stays unit-testable.

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
  timeoutMs: number,
  options: FetchOptions = {},
): Promise<T> {
  const controller = new AbortController();
  forwardAbort(options.signal, controller);

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      // abort() must precede reject() so the FetchTimeoutError wins the race and
      // callers see a timeout rather than the transport's own AbortError.
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

// Honour a caller-supplied abort signal instead of silently dropping it when we
// swap in our own controller for the timeout.
function forwardAbort(
  incoming: FetchOptions["signal"],
  controller: AbortController,
): void {
  if (!incoming) {
    return;
  }
  if (incoming.aborted) {
    controller.abort();
    return;
  }
  incoming.addEventListener("abort", () => controller.abort(), { once: true });
}
