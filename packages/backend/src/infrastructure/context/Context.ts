import type { CorrelationId } from '@core/domain/CorrelationId';

/**
 * Request-scoped context passed through all service, repo, and cache operations.
 * Similar to Go's context.Context - carries correlation IDs and cancellation signals.
 *
 * Context is created at system entry points:
 * - HTTP handlers: via buildRequestContext() - access as requestContext.ctx
 * - Task workers: via processJob() - creates Context with AbortController
 * - Auth middleware: createContext(correlationId, controller)
 * - System/cron: createContext(correlationId, new AbortController())
 *
 * Context flows through all layers:
 * Handler → Service → Repo/Cache
 *
 * All async operations should:
 * 1. Accept ctx as first parameter
 * 2. Check ctx.signal.aborted before long operations
 * 3. Pass ctx to downstream calls
 * 4. Call ctx.cancel() to programmatically abort operations
 */
export type Context = Readonly<{
  /* The correlation ID for tracing requests through the system */
  correlationId: CorrelationId;

  /* The AbortSignal to monitor for cancellation */
  signal: AbortSignal;

  /* Function to cancel the context, aborting ongoing operations */
  cancel: (reason?: string) => void;
}>;

/**
 * Creates a new Context. Use this for system-initiated operations
 * (cron jobs, startup tasks) where there's no incoming request.
 */
export function createContext(
  correlationId: CorrelationId,
  controller: AbortController,
): Context {
  return Object.freeze(new _Context(correlationId, controller));
}

/**
 * Creates a derived context with a new AbortController.
 * The derived signal aborts when:
 * - Parent signal aborts (automatically propagated)
 * - The returned cancel function is called
 *
 * Uses { once: true } for event listeners to prevent memory leaks.
 *
 * @param parentCtx - The parent context to derive from
 * @returns A derived context with its own cancel function
 */
export function deriveContext(parentCtx: Context): Context {
  const controller = new AbortController();

  // Link parent abort to child
  if (parentCtx.signal.aborted) {
    controller.abort(parentCtx.signal.reason);
  } else {
    parentCtx.signal.addEventListener(
      'abort',
      () => controller.abort(parentCtx.signal.reason),
      { once: true }, // Prevents memory leak
    );
  }

  return createContext(parentCtx.correlationId, controller);
}

class _Context {
  constructor(
    public readonly correlationId: CorrelationId,
    private readonly controller: AbortController,
  ) {}

  get signal() {
    return this.controller.signal;
  }

  cancel(reason?: string) {
    this.controller.abort(reason);
  }
}
