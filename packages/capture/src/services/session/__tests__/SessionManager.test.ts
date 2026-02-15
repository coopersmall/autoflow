import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { ok, err } from 'neverthrow';
import { internalError } from '@core/errors/factories';
import { EventId } from '@capture/domain/EventId';
import type { IDomCaptureService } from '@capture/services/dom/DomCaptureService';
import type { INetworkInterceptor } from '@capture/services/network/NetworkInterceptor';
import { createSessionManager } from '@capture/services/session/SessionManager';

describe('createSessionManager', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'session-root';
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it('should expose the expected interface', () => {
    const manager = createSessionManager();
    expect(typeof manager.startSession).toBe('function');
    expect(typeof manager.endSession).toBe('function');
    expect(typeof manager.getCapturedSession).toBe('function');
  });

  it('should start a session and return a session id', () => {
    const manager = createSessionManager();

    const result = manager.startSession(
      'https://chat.example.com',
      root,
      window,
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(typeof result.value).toBe('string');
      expect(result.value.length).toBeGreaterThan(0);
    }

    manager.endSession();
  });

  it('should return error when starting session twice', () => {
    const manager = createSessionManager();

    manager.startSession('https://chat.example.com', root, window);
    const result = manager.startSession(
      'https://other.example.com',
      root,
      window,
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Session already in progress');
    }

    manager.endSession();
  });

  it('should end a session and return captured data', () => {
    const manager = createSessionManager();

    manager.startSession('https://chat.example.com', root, window);
    const result = manager.endSession();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const session = result.value;
      expect(session.schemaVersion).toBe(1);
      expect(session.targetUrl).toBe('https://chat.example.com');
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.endedAt).toBeInstanceOf(Date);
      expect(Array.isArray(session.events)).toBe(true);
    }
  });

  it('should return error when ending session that has not started', () => {
    const manager = createSessionManager();
    const result = manager.endSession();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('No active session');
    }
  });

  it('should get captured session without ending', () => {
    const manager = createSessionManager();

    manager.startSession('https://chat.example.com', root, window);
    const result = manager.getCapturedSession();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const session = result.value;
      expect(session.targetUrl).toBe('https://chat.example.com');
      expect(session.endedAt).toBeUndefined();
    }

    manager.endSession();
  });

  it('should return error from getCapturedSession when no session', () => {
    const manager = createSessionManager();
    const result = manager.getCapturedSession();

    expect(result.isErr()).toBe(true);
  });

  it('should allow starting a new session after ending one', () => {
    const manager = createSessionManager();

    manager.startSession('https://first.example.com', root, window);
    manager.endSession();

    const result = manager.startSession(
      'https://second.example.com',
      root,
      window,
    );
    expect(result.isOk()).toBe(true);

    manager.endSession();
  });

  it('should propagate DOM capture errors', () => {
    const mockDomService: IDomCaptureService = {
      startCapture: mock(() =>
        err(internalError('DOM capture failed')),
      ),
      stopCapture: mock(),
      getEvents: mock(() => []),
    };

    const manager = createSessionManager(undefined, {
      createDomCapture: () => mockDomService,
      createNetworkIntercept: () => ({
        intercept: mock(() => ok(undefined)),
        getRequests: mock(() => []),
        stopIntercepting: mock(),
      }),
    });

    const result = manager.startSession(
      'https://chat.example.com',
      root,
      window,
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('DOM capture failed');
    }
  });

  it('should propagate network interceptor errors', () => {
    const mockDomService: IDomCaptureService = {
      startCapture: mock(() => ok(undefined)),
      stopCapture: mock(),
      getEvents: mock(() => []),
    };

    const manager = createSessionManager(undefined, {
      createDomCapture: () => mockDomService,
      createNetworkIntercept: () => ({
        intercept: mock(() =>
          err(internalError('Network interception failed')),
        ),
        getRequests: mock(() => []),
        stopIntercepting: mock(),
      }),
    });

    const result = manager.startSession(
      'https://chat.example.com',
      root,
      window,
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe(
        'Network interception failed',
      );
    }
    // DOM capture should have been cleaned up
    expect(mockDomService.stopCapture).toHaveBeenCalled();
  });

  it('should sort events by timestamp in the captured session', () => {
    const t1 = new Date('2025-01-01T00:00:01Z');
    const t3 = new Date('2025-01-01T00:00:03Z');

    const mockDomService: IDomCaptureService = {
      startCapture: mock(() => ok(undefined)),
      stopCapture: mock(),
      getEvents: mock(() => [
        {
          id: EventId(),
          type: 'dom-change' as const,
          timestamp: t3,
          mutations: [
            {
              type: 'added' as const,
              selector: 'div',
              tagName: 'div',
            },
          ],
        },
      ]),
    };

    const mockNetInterceptor: INetworkInterceptor = {
      intercept: mock(() => ok(undefined)),
      getRequests: mock(() => [
        {
          id: EventId(),
          type: 'network-request' as const,
          timestamp: t1,
          method: 'GET',
          url: 'https://example.com',
        },
      ]),
      stopIntercepting: mock(),
    };

    const manager = createSessionManager(undefined, {
      createDomCapture: () => mockDomService,
      createNetworkIntercept: () => mockNetInterceptor,
    });

    manager.startSession('https://chat.example.com', root, window);

    const result = manager.getCapturedSession();
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const events = result.value.events;
      for (let i = 1; i < events.length; i++) {
        expect(
          events[i].timestamp.getTime(),
        ).toBeGreaterThanOrEqual(events[i - 1].timestamp.getTime());
      }
    }

    manager.endSession();
  });
});
