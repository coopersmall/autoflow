import { describe, expect, it } from 'bun:test';
import { validate } from '@core/validation/validate';
import { EventId } from '@capture/domain/EventId';
import { CaptureSessionId } from '@capture/domain/CaptureSessionId';
import { domChangeEventSchema } from '@capture/domain/events/DomChangeEvent';
import { networkRequestEventSchema } from '@capture/domain/events/NetworkRequestEvent';
import { userActionEventSchema } from '@capture/domain/events/UserActionEvent';
import { captureEventSchema } from '@capture/domain/events/CaptureEvent';
import { captureSessionSchema } from '@capture/domain/CaptureSession';

describe('CaptureSessionId', () => {
  it('should generate a unique id', () => {
    const id = CaptureSessionId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should accept a predefined value', () => {
    const id = CaptureSessionId('my-session-id');
    expect(id as string).toBe('my-session-id');
  });

  it('should generate unique ids each time', () => {
    const id1 = CaptureSessionId();
    const id2 = CaptureSessionId();
    expect(id1).not.toBe(id2);
  });
});

describe('EventId', () => {
  it('should generate a unique id', () => {
    const id = EventId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('DomChangeEvent schema', () => {
  it('should validate a valid dom change event', () => {
    const event = {
      id: EventId(),
      type: 'dom-change' as const,
      timestamp: new Date(),
      mutations: [
        {
          type: 'added' as const,
          selector: '#root > div',
          tagName: 'div',
        },
      ],
    };

    const result = validate(domChangeEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should reject event with empty mutations array', () => {
    const event = {
      id: EventId(),
      type: 'dom-change' as const,
      timestamp: new Date(),
      mutations: [] as never[],
    };

    const result = validate(domChangeEventSchema, event);
    expect(result.isErr()).toBe(true);
  });

  it('should validate mutation with shadow root', () => {
    const event = {
      id: EventId(),
      type: 'dom-change' as const,
      timestamp: new Date(),
      mutations: [
        {
          type: 'added' as const,
          selector: 'my-element',
          tagName: 'my-element',
          shadowRoot: 'open' as const,
        },
      ],
    };

    const result = validate(domChangeEventSchema, event);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.mutations[0].shadowRoot).toBe('open');
    }
  });

  it('should validate mutation with attributes', () => {
    const event = {
      id: EventId(),
      type: 'dom-change' as const,
      timestamp: new Date(),
      mutations: [
        {
          type: 'modified' as const,
          selector: '#btn',
          tagName: 'button',
          attributes: { class: 'active', disabled: '' },
        },
      ],
    };

    const result = validate(domChangeEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should reject invalid mutation type', () => {
    const event = {
      id: EventId(),
      type: 'dom-change' as const,
      timestamp: new Date(),
      mutations: [
        {
          type: 'destroyed',
          selector: '#btn',
          tagName: 'button',
        },
      ],
    };

    const result = validate(domChangeEventSchema, event as any);
    expect(result.isErr()).toBe(true);
  });
});

describe('NetworkRequestEvent schema', () => {
  it('should validate a basic network request', () => {
    const event = {
      id: EventId(),
      type: 'network-request' as const,
      timestamp: new Date(),
      method: 'GET',
      url: 'https://api.example.com/data',
    };

    const result = validate(networkRequestEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a request with full response data', () => {
    const event = {
      id: EventId(),
      type: 'network-request' as const,
      timestamp: new Date(),
      method: 'POST',
      url: 'https://api.example.com/chat',
      requestHeaders: { 'content-type': 'application/json' },
      requestBody: '{"message":"hello"}',
      status: 200,
      responseHeaders: { 'content-type': 'application/json' },
      responseBody: '{"reply":"world"}',
      durationMs: 150,
    };

    const result = validate(networkRequestEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a streaming response with chunks', () => {
    const event = {
      id: EventId(),
      type: 'network-request' as const,
      timestamp: new Date(),
      method: 'POST',
      url: 'https://api.example.com/stream',
      status: 200,
      streamingChunks: [
        { data: 'data: {"token":"Hello"}\n\n', timestamp: new Date() },
        { data: 'data: {"token":" world"}\n\n', timestamp: new Date() },
      ],
      durationMs: 500,
    };

    const result = validate(networkRequestEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a failed request', () => {
    const event = {
      id: EventId(),
      type: 'network-request' as const,
      timestamp: new Date(),
      method: 'GET',
      url: 'https://api.example.com/fail',
      error: 'Network error',
      durationMs: 30,
    };

    const result = validate(networkRequestEventSchema, event);
    expect(result.isOk()).toBe(true);
  });
});

describe('UserActionEvent schema', () => {
  it('should validate a click event', () => {
    const event = {
      id: EventId(),
      type: 'user-action' as const,
      timestamp: new Date(),
      actionType: 'click' as const,
      selector: '#submit-btn',
      tagName: 'button',
      coordinates: { x: 100, y: 200 },
    };

    const result = validate(userActionEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should validate an input event', () => {
    const event = {
      id: EventId(),
      type: 'user-action' as const,
      timestamp: new Date(),
      actionType: 'input' as const,
      selector: '#message-input',
      tagName: 'input',
      value: 'Hello, AI!',
    };

    const result = validate(userActionEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a submit event', () => {
    const event = {
      id: EventId(),
      type: 'user-action' as const,
      timestamp: new Date(),
      actionType: 'submit' as const,
      selector: 'form.chat-form',
      tagName: 'form',
    };

    const result = validate(userActionEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should reject invalid action type', () => {
    const event = {
      id: EventId(),
      type: 'user-action' as const,
      timestamp: new Date(),
      actionType: 'hover',
      selector: '#btn',
      tagName: 'button',
    };

    const result = validate(userActionEventSchema, event as any);
    expect(result.isErr()).toBe(true);
  });
});

describe('CaptureEvent discriminated union', () => {
  it('should validate a dom-change event', () => {
    const event = {
      id: EventId(),
      type: 'dom-change' as const,
      timestamp: new Date(),
      mutations: [
        { type: 'added' as const, selector: 'div', tagName: 'div' },
      ],
    };

    const result = validate(captureEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a network-request event', () => {
    const event = {
      id: EventId(),
      type: 'network-request' as const,
      timestamp: new Date(),
      method: 'GET',
      url: 'https://example.com',
    };

    const result = validate(captureEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a user-action event', () => {
    const event = {
      id: EventId(),
      type: 'user-action' as const,
      timestamp: new Date(),
      actionType: 'click' as const,
      selector: 'button',
      tagName: 'button',
    };

    const result = validate(captureEventSchema, event);
    expect(result.isOk()).toBe(true);
  });

  it('should reject an unknown event type', () => {
    const event = {
      id: EventId(),
      type: 'unknown-type',
      timestamp: new Date(),
    };

    const result = validate(captureEventSchema, event as any);
    expect(result.isErr()).toBe(true);
  });
});

describe('CaptureSession schema', () => {
  it('should validate a valid session', () => {
    const session = {
      schemaVersion: 1 as const,
      id: CaptureSessionId(),
      targetUrl: 'https://chat.example.com',
      startedAt: new Date(),
      events: [],
    };

    const result = validate(captureSessionSchema, session);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a session with endedAt', () => {
    const session = {
      schemaVersion: 1 as const,
      id: CaptureSessionId(),
      targetUrl: 'https://chat.example.com',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      endedAt: new Date('2025-01-01T01:00:00Z'),
      events: [],
    };

    const result = validate(captureSessionSchema, session);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a session with mixed events', () => {
    const session = {
      schemaVersion: 1 as const,
      id: CaptureSessionId(),
      targetUrl: 'https://chat.example.com',
      startedAt: new Date(),
      events: [
        {
          id: EventId(),
          type: 'user-action' as const,
          timestamp: new Date(),
          actionType: 'click' as const,
          selector: '#btn',
          tagName: 'button',
        },
        {
          id: EventId(),
          type: 'network-request' as const,
          timestamp: new Date(),
          method: 'POST',
          url: 'https://api.example.com',
        },
        {
          id: EventId(),
          type: 'dom-change' as const,
          timestamp: new Date(),
          mutations: [
            {
              type: 'added' as const,
              selector: 'div.response',
              tagName: 'div',
            },
          ],
        },
      ],
    };

    const result = validate(captureSessionSchema, session);
    expect(result.isOk()).toBe(true);
  });

  it('should reject invalid schema version', () => {
    const session = {
      schemaVersion: 2,
      id: CaptureSessionId(),
      targetUrl: 'https://chat.example.com',
      startedAt: new Date(),
      events: [],
    };

    const result = validate(captureSessionSchema, session as any);
    expect(result.isErr()).toBe(true);
  });

  it('should reject invalid target URL', () => {
    const session = {
      schemaVersion: 1 as const,
      id: CaptureSessionId(),
      targetUrl: 'not-a-url',
      startedAt: new Date(),
      events: [],
    };

    const result = validate(captureSessionSchema, session);
    expect(result.isErr()).toBe(true);
  });

  it('should reject missing id', () => {
    const session = {
      schemaVersion: 1 as const,
      targetUrl: 'https://chat.example.com',
      startedAt: new Date(),
      events: [],
    };

    const result = validate(captureSessionSchema, session as any);
    expect(result.isErr()).toBe(true);
  });
});
