// Wraps Nuxt's $fetch so a request that never settles rejects instead of
// hanging forever (see app/stores/feed.ts's refresh flow, which otherwise
// leaves loading state wedged with no error).
//
// Why not ofetch's built-in `timeout`: the racing guard promise here rejects on
// timeout even when the underlying transport ignores the abort signal, relays a
// caller's own abort so the returned promise settles promptly, and — unlike
// ofetch's internal timer — can be exercised against a mocked $fetch, so the
// timeout behaviour stays unit-testable.

type FetchRequest = Parameters<typeof $fetch>[0];
type FetchOptions = NonNullable<Parameters<typeof $fetch>[1]>;
type CallerSignal = FetchOptions["signal"];

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
  const callerSignal = options.signal;
  if (callerSignal?.aborted) {
    return Promise.reject(callerSignal.reason);
  }

  const controller = new AbortController();

  // Dispatch before arming the timer so a synchronous throw from $fetch
  // surfaces without leaving a dangling timeout behind.
  const response = $fetch<T>(request, {
    ...options,
    signal: controller.signal,
  });

  let timeoutId: ReturnType<typeof setTimeout>;
  let detachCallerAbort = () => {};

  const guard = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new FetchTimeoutError(timeoutMs);
      // Reject before aborting so the race settles as a timeout even if the
      // transport rejects synchronously the moment the signal aborts.
      reject(error);
      controller.abort(error);
    }, timeoutMs);
    detachCallerAbort = relayAbort(callerSignal, controller, reject);
  });

  return Promise.race([response, guard]).finally(() => {
    clearTimeout(timeoutId);
    detachCallerAbort();
  });
}

// Mirror a caller's abort onto our own controller and reject the guard promptly,
// so the returned promise settles even if the transport ignores the signal. The
// pre-aborted case is handled by the early return above, so the signal is live
// here. Returns a teardown so a reused, long-lived caller signal never
// accumulates listeners across requests.
function relayAbort(
  callerSignal: CallerSignal,
  controller: AbortController,
  reject: (_reason?: unknown) => void,
): () => void {
  if (!callerSignal) {
    return () => {};
  }
  const onAbort = () => {
    reject(callerSignal.reason);
    controller.abort(callerSignal.reason);
  };
  callerSignal.addEventListener("abort", onAbort);
  return () => callerSignal.removeEventListener("abort", onAbort);
}
