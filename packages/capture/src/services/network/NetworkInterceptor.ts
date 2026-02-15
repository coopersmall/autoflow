import { ok, err, type Result } from 'neverthrow';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { EventId } from '@capture/domain/EventId';
import type {
  NetworkRequestEvent,
  StreamingChunk,
} from '@capture/domain/events/NetworkRequestEvent';

export interface NetworkInterceptorConfig {
  readonly logger?: {
    debug(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
  };
}

export interface INetworkInterceptor {
  readonly intercept: (
    win: Window & typeof globalThis,
  ) => Result<void, AppError>;
  readonly getRequests: () => ReadonlyArray<NetworkRequestEvent>;
  readonly stopIntercepting: () => void;
}

export { createNetworkInterceptor };

function createNetworkInterceptor(
  config?: NetworkInterceptorConfig,
): INetworkInterceptor {
  const instance = new NetworkInterceptor(config);
  return {
    intercept: (win) => instance.intercept(win),
    getRequests: () => instance.getRequests(),
    stopIntercepting: () => instance.stopIntercepting(),
  };
}

function headersToRecord(
  headers: Headers | Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } else {
    Object.assign(result, headers);
  }
  return result;
}

function isStreamingResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') ?? '';
  return (
    contentType.includes('text/event-stream') ||
    contentType.includes('application/x-ndjson') ||
    contentType.includes('application/stream+json')
  );
}

class NetworkInterceptor implements INetworkInterceptor {
  private requests: NetworkRequestEvent[] = [];
  private originalFetch: typeof fetch | null = null;
  private originalXhrOpen:
    | typeof XMLHttpRequest.prototype.open
    | null = null;
  private originalXhrSend:
    | typeof XMLHttpRequest.prototype.send
    | null = null;
  private interceptedWindow: (Window & typeof globalThis) | null =
    null;

  constructor(
    private readonly config?: NetworkInterceptorConfig,
  ) {}

  intercept(
    win: Window & typeof globalThis,
  ): Result<void, AppError> {
    if (this.interceptedWindow) {
      return err(
        internalError('Network interception already active'),
      );
    }

    this.interceptedWindow = win;
    this.interceptFetch(win);
    this.interceptXhr(win);

    this.config?.logger?.debug('Network interception started');

    return ok(undefined);
  }

  getRequests(): ReadonlyArray<NetworkRequestEvent> {
    return this.requests;
  }

  stopIntercepting(): void {
    if (!this.interceptedWindow) {
      return;
    }

    const win = this.interceptedWindow;

    if (this.originalFetch) {
      win.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    if (this.originalXhrOpen && this.originalXhrSend) {
      win.XMLHttpRequest.prototype.open = this.originalXhrOpen;
      win.XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrOpen = null;
      this.originalXhrSend = null;
    }

    this.interceptedWindow = null;

    this.config?.logger?.debug('Network interception stopped', {
      totalRequests: this.requests.length,
    });
  }

  private interceptFetch(
    win: Window & typeof globalThis,
  ): void {
    this.originalFetch = win.fetch.bind(win);
    const self = this;
    const originalFetch = this.originalFetch;

    // biome-ignore lint: Overriding fetch for interception requires type assertion
    (win as any).fetch = async function interceptedFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const startTime = Date.now();
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.toString()
            : input;
      const method =
        init?.method ??
        (input instanceof Request ? input.method : 'GET');

      const event: NetworkRequestEvent = {
        id: EventId(),
        type: 'network-request',
        timestamp: new Date(),
        method: method.toUpperCase(),
        url,
        requestHeaders: init?.headers
          ? headersToRecord(
              new Headers(
                init.headers as HeadersInit,
              ),
            )
          : undefined,
        requestBody:
          typeof init?.body === 'string' ? init.body : undefined,
      };

      try {
        const response = await originalFetch(input, init);
        event.status = response.status;
        event.responseHeaders = headersToRecord(response.headers);

        if (
          isStreamingResponse(response) &&
          response.body
        ) {
          const clonedResponse = response.clone();
          self.captureStream(event, clonedResponse, startTime);
        } else {
          const clonedResponse = response.clone();
          clonedResponse
            .text()
            .then((body) => {
              event.responseBody = body;
              event.durationMs = Date.now() - startTime;
            })
            .catch(() => {
              event.durationMs = Date.now() - startTime;
            });
        }

        self.requests.push(event);
        return response;
      } catch (fetchError: unknown) {
        event.error =
          fetchError instanceof Error
            ? fetchError.message
            : 'Unknown fetch error';
        event.durationMs = Date.now() - startTime;
        self.requests.push(event);

        // biome-ignore lint: Re-throwing original error to preserve fetch behavior
        throw fetchError;
      }
    };
  }

  private interceptXhr(
    win: Window & typeof globalThis,
  ): void {
    this.originalXhrOpen =
      win.XMLHttpRequest.prototype.open;
    this.originalXhrSend =
      win.XMLHttpRequest.prototype.send;

    const self = this;
    const originalOpen = this.originalXhrOpen;
    const originalSend = this.originalXhrSend;

    type XhrWithMeta = XMLHttpRequest & {
      _captureMethod?: string;
      _captureUrl?: string;
    };

    win.XMLHttpRequest.prototype.open = function xhrOpen(
      this: XhrWithMeta,
      method: string,
      url: string | URL,
    ) {
      this._captureMethod = method;
      this._captureUrl =
        url instanceof URL ? url.toString() : url;
      return originalOpen.apply(this, [
        method,
        url,
        true,
      ] as unknown as Parameters<typeof originalOpen>);
    };

    win.XMLHttpRequest.prototype.send = function xhrSend(
      this: XhrWithMeta,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const startTime = Date.now();

      const event: NetworkRequestEvent = {
        id: EventId(),
        type: 'network-request',
        timestamp: new Date(),
        method: (this._captureMethod ?? 'GET').toUpperCase(),
        url: this._captureUrl ?? '',
        requestBody:
          typeof body === 'string' ? body : undefined,
      };

      this.addEventListener('load', function onLoad() {
        event.status = this.status;
        event.responseBody = this.responseText;
        event.durationMs = Date.now() - startTime;

        const rawHeaders = this.getAllResponseHeaders();
        if (rawHeaders) {
          const headers: Record<string, string> = {};
          for (const line of rawHeaders.trim().split(/[\r\n]+/)) {
            const idx = line.indexOf(':');
            if (idx > 0) {
              headers[line.substring(0, idx).trim().toLowerCase()] =
                line.substring(idx + 1).trim();
            }
          }
          event.responseHeaders = headers;
        }
      });

      this.addEventListener('error', function onError() {
        event.error = 'XHR request failed';
        event.durationMs = Date.now() - startTime;
      });

      this.addEventListener('timeout', function onTimeout() {
        event.error = 'XHR request timed out';
        event.durationMs = Date.now() - startTime;
      });

      self.requests.push(event);
      return originalSend.call(this, body);
    };
  }

  private captureStream(
    event: NetworkRequestEvent,
    response: Response,
    startTime: number,
  ): void {
    const body = response.body;
    if (!body) {
      return;
    }

    const chunks: StreamingChunk[] = [];
    const reader = body.getReader();
    const decoder = new TextDecoder();

    const readChunks = (): void => {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            event.streamingChunks = chunks;
            event.durationMs = Date.now() - startTime;
            return;
          }

          chunks.push({
            data: decoder.decode(value, { stream: true }),
            timestamp: new Date(),
          });

          readChunks();
        })
        .catch(() => {
          event.streamingChunks = chunks;
          event.durationMs = Date.now() - startTime;
        });
    };

    readChunks();
  }
}
