import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { createNetworkInterceptor } from '@capture/services/network/NetworkInterceptor';

describe('createNetworkInterceptor', () => {
  it('should expose the expected interface', () => {
    const interceptor = createNetworkInterceptor();
    expect(typeof interceptor.intercept).toBe('function');
    expect(typeof interceptor.getRequests).toBe('function');
    expect(typeof interceptor.stopIntercepting).toBe('function');
  });

  it('should return empty requests before interception', () => {
    const interceptor = createNetworkInterceptor();
    expect(interceptor.getRequests()).toEqual([]);
  });

  it('should return error when intercepting twice', () => {
    const interceptor = createNetworkInterceptor();

    // Create a minimal window-like object
    const fakeWindow = createFakeWindow();

    const result1 = interceptor.intercept(fakeWindow);
    expect(result1.isOk()).toBe(true);

    const result2 = interceptor.intercept(fakeWindow);
    expect(result2.isErr()).toBe(true);
    if (result2.isErr()) {
      expect(result2.error.message).toBe(
        'Network interception already active',
      );
    }

    interceptor.stopIntercepting();
  });

  it('should restore fetch after stopping', () => {
    const interceptor = createNetworkInterceptor();
    const fakeWindow = createFakeWindow();

    interceptor.intercept(fakeWindow);
    const interceptedFetch = fakeWindow.fetch;

    interceptor.stopIntercepting();
    // After stopping, fetch should no longer be the intercepted version
    expect(fakeWindow.fetch).not.toBe(interceptedFetch);
  });

  it('should capture fetch requests', async () => {
    const interceptor = createNetworkInterceptor();
    const fakeWindow = createFakeWindow({
      fetchResponse: new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    interceptor.intercept(fakeWindow);

    await fakeWindow.fetch('https://api.example.com/data', {
      method: 'GET',
    });

    // Wait for async response body capture
    await new Promise((resolve) => setTimeout(resolve, 10));

    const requests = interceptor.getRequests();
    expect(requests.length).toBe(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('https://api.example.com/data');
    expect(requests[0].status).toBe(200);
    expect(requests[0].type).toBe('network-request');

    interceptor.stopIntercepting();
  });

  it('should capture POST request with body', async () => {
    const interceptor = createNetworkInterceptor();
    const fakeWindow = createFakeWindow({
      fetchResponse: new Response('ok', { status: 201 }),
    });

    interceptor.intercept(fakeWindow);

    await fakeWindow.fetch('https://api.example.com/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"test"}',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const requests = interceptor.getRequests();
    expect(requests.length).toBe(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].requestBody).toBe('{"name":"test"}');
    expect(requests[0].status).toBe(201);

    interceptor.stopIntercepting();
  });

  it('should capture fetch errors', async () => {
    const interceptor = createNetworkInterceptor();
    const fakeWindow = createFakeWindow({
      fetchError: new Error('Network failure'),
    });

    interceptor.intercept(fakeWindow);

    try {
      await fakeWindow.fetch('https://api.example.com/fail');
    } catch {
      // Expected
    }

    const requests = interceptor.getRequests();
    expect(requests.length).toBe(1);
    expect(requests[0].error).toBe('Network failure');

    interceptor.stopIntercepting();
  });

  it('should detect streaming responses', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"token":"hi"}\n\n'),
        );
        controller.close();
      },
    });

    const interceptor = createNetworkInterceptor();
    const fakeWindow = createFakeWindow({
      fetchResponse: new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    });

    interceptor.intercept(fakeWindow);

    await fakeWindow.fetch('https://api.example.com/stream');

    // Wait for stream reading
    await new Promise((resolve) => setTimeout(resolve, 50));

    const requests = interceptor.getRequests();
    expect(requests.length).toBe(1);
    expect(requests[0].streamingChunks).toBeDefined();
    expect(requests[0].streamingChunks!.length).toBeGreaterThan(0);

    interceptor.stopIntercepting();
  });

  it('should handle stopIntercepting when not intercepting', () => {
    const interceptor = createNetworkInterceptor();
    // Should not throw
    interceptor.stopIntercepting();
  });
});

// Helper to create a fake window-like object for testing
function createFakeWindow(options?: {
  fetchResponse?: Response;
  fetchError?: Error;
}): Window & typeof globalThis {
  const originalFetch = mock(async () => {
    if (options?.fetchError) {
      // biome-ignore lint: Re-throwing for test simulation
      throw options.fetchError;
    }
    return (
      options?.fetchResponse?.clone() ??
      new Response('', { status: 200 })
    );
  });

  const fakeXhrProto = {
    open: mock(),
    send: mock(),
  };

  const fakeWindow = {
    fetch: originalFetch,
    XMLHttpRequest: {
      prototype: fakeXhrProto,
    },
  };

  return fakeWindow as unknown as Window & typeof globalThis;
}
