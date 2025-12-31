import { describe, expect, it } from 'bun:test';
import type { AgentId, StreamableEventType } from '@core/domain/agents';
import type { StreamPart } from '@core/domain/ai';
import {
  getAllowedEventTypes,
  type TransformContext,
  transformStreamPart,
} from '../transformStreamPart';

describe('transformStreamPart', () => {
  const manifestId = 'test-agent' as AgentId;
  const parentManifestId = 'parent-agent' as AgentId;

  const createContext = (
    allowedEvents: StreamableEventType[],
    stepNumber = 1,
  ): TransformContext => ({
    manifestId,
    parentManifestId,
    stepNumber,
    allowedEventTypes: new Set(allowedEvents),
  });

  describe('text-delta events', () => {
    it('transforms text-delta when allowed', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = {
        type: 'text-delta',
        id: 'text-1',
        text: 'Hello',
      };

      const result = transformStreamPart(part, context);

      expect(result).toBeDefined();
      expect(result?.type).toBe('text-delta');
      expect(result?.manifestId).toBe(manifestId);
      expect(result?.parentManifestId).toBe(parentManifestId);
      if (result?.type === 'text-delta') {
        expect(result.text).toBe('Hello');
        expect(result.id).toBe('text-1');
      }
    });

    it('returns undefined when text-delta is not allowed', () => {
      const context = createContext(['tool-call']);
      const part: StreamPart = {
        type: 'text-delta',
        id: 'text-1',
        text: 'Hello',
      };

      const result = transformStreamPart(part, context);

      expect(result).toBeUndefined();
    });
  });

  describe('tool-call events', () => {
    it('transforms tool-call when allowed', () => {
      const context = createContext(['tool-call'], 2);
      const part: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'search',
        input: { query: 'test' },
      };

      const result = transformStreamPart(part, context);

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-call');
      expect(result?.manifestId).toBe(manifestId);
      if (result?.type === 'tool-call') {
        expect(result.stepNumber).toBe(2);
        expect(result.toolCallId).toBe('call-1');
        expect(result.toolName).toBe('search');
        expect(result.input).toEqual({ query: 'test' });
      }
    });

    it('returns undefined when tool-call is not allowed', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'search',
        input: { query: 'test' },
      };

      const result = transformStreamPart(part, context);

      expect(result).toBeUndefined();
    });
  });

  describe('tool-result events', () => {
    it('transforms tool-result when allowed', () => {
      const context = createContext(['tool-result'], 3);
      const part: StreamPart = {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'search',
        input: { query: 'test' },
        output: { results: ['item1', 'item2'] },
      };

      const result = transformStreamPart(part, context);

      expect(result).toBeDefined();
      expect(result?.type).toBe('tool-result');
      if (result?.type === 'tool-result') {
        expect(result.stepNumber).toBe(3);
        expect(result.toolCallId).toBe('call-1');
        expect(result.output).toEqual({ results: ['item1', 'item2'] });
      }
    });
  });

  describe('step events', () => {
    it('transforms start-step when step-start is allowed', () => {
      const context = createContext(['step-start'], 5);
      const part: StreamPart = {
        type: 'start-step',
        request: { body: undefined },
        warnings: [],
      };

      const result = transformStreamPart(part, context);

      expect(result).toBeDefined();
      expect(result?.type).toBe('step-start');
      if (result?.type === 'step-start') {
        expect(result.stepIndex).toBe(5);
      }
    });

    it('transforms finish-step when step-finish is allowed', () => {
      const context = createContext(['step-finish'], 5);
      const part: StreamPart = {
        type: 'finish-step',
        finishReason: 'stop',
        response: {
          id: 'resp-1',
          timestamp: new Date(),
          modelId: 'gpt-4',
        },
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      };

      const result = transformStreamPart(part, context);

      expect(result).toBeDefined();
      expect(result?.type).toBe('step-finish');
      if (result?.type === 'step-finish') {
        expect(result.stepIndex).toBe(5);
        expect(result.finishReason).toBe('stop');
        expect(result.usage?.inputTokens).toBe(100);
        expect(result.usage?.outputTokens).toBe(50);
      }
    });
  });

  describe('non-event stream parts', () => {
    it('returns undefined for text-start', () => {
      const context = createContext([
        'text-delta',
        'tool-call',
        'tool-result',
        'step-start',
        'step-finish',
      ]);
      const part: StreamPart = { type: 'text-start', id: 'text-1' };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for text-end', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = { type: 'text-end', id: 'text-1' };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for reasoning-start', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = { type: 'reasoning-start', id: 'r-1' };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for reasoning-delta', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = {
        type: 'reasoning-delta',
        id: 'r-1',
        text: 'thinking',
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for reasoning-end', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = { type: 'reasoning-end', id: 'r-1' };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for source (url type)', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = {
        type: 'source',
        sourceType: 'url',
        id: 'src-1',
        url: 'http://example.com',
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for file', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = {
        type: 'file',
        file: {
          mediaType: 'image/png',
          uint8Array: new Uint8Array([]),
        },
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for tool-input-start', () => {
      const context = createContext(['tool-call']);
      const part: StreamPart = {
        type: 'tool-input-start',
        id: 'call-1',
        toolName: 'search',
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for tool-input-delta', () => {
      const context = createContext(['tool-call']);
      const part: StreamPart = {
        type: 'tool-input-delta',
        id: 'call-1',
        delta: '{}',
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for tool-input-end', () => {
      const context = createContext(['tool-call']);
      const part: StreamPart = {
        type: 'tool-input-end',
        id: 'call-1',
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for tool-error', () => {
      const context = createContext(['tool-call']);
      const part: StreamPart = {
        type: 'tool-error',
        toolCallId: 'call-1',
        toolName: 'search',
        error: 'failed',
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for tool-output-denied', () => {
      const context = createContext(['tool-call']);
      const part: StreamPart = {
        type: 'tool-output-denied',
        toolCallId: 'call-1',
        toolName: 'search',
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for tool-approval-request', () => {
      const context = createContext(['tool-call']);
      const part: StreamPart = {
        type: 'tool-approval-request',
        approvalId: 'approval-1',
        toolCall: { toolCallId: 'call-1', toolName: 'dangerous', input: {} },
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for start', () => {
      const context = createContext(['step-start']);
      const part: StreamPart = { type: 'start' };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for finish', () => {
      const context = createContext(['step-finish']);
      const part: StreamPart = {
        type: 'finish',
        finishReason: 'stop',
        totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for error', () => {
      const context = createContext(['step-finish']);
      const part: StreamPart = { type: 'error', error: new Error('test') };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for abort', () => {
      const context = createContext(['step-finish']);
      const part: StreamPart = { type: 'abort' };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });

    it('returns undefined for raw', () => {
      const context = createContext(['step-finish']);
      const part: StreamPart = { type: 'raw', rawValue: {} };
      expect(transformStreamPart(part, context)).toBeUndefined();
    });
  });

  describe('parentManifestId', () => {
    it('sets parentManifestId when provided', () => {
      const context = createContext(['text-delta']);
      const part: StreamPart = {
        type: 'text-delta',
        id: 'text-1',
        text: 'Hello',
      };

      const result = transformStreamPart(part, context);

      expect(result?.parentManifestId).toBe(parentManifestId);
    });

    it('sets parentManifestId to undefined when not provided', () => {
      const context: TransformContext = {
        manifestId,
        parentManifestId: undefined,
        stepNumber: 1,
        allowedEventTypes: new Set(['text-delta']),
      };
      const part: StreamPart = {
        type: 'text-delta',
        id: 'text-1',
        text: 'Hello',
      };

      const result = transformStreamPart(part, context);

      expect(result?.parentManifestId).toBeUndefined();
    });
  });
});

describe('getAllowedEventTypes', () => {
  it('returns default events when undefined', () => {
    const result = getAllowedEventTypes(undefined);

    expect(result.has('tool-call')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('returns provided events', () => {
    const events: StreamableEventType[] = [
      'text-delta',
      'tool-call',
      'step-finish',
    ];
    const result = getAllowedEventTypes(events);

    expect(result.has('text-delta')).toBe(true);
    expect(result.has('tool-call')).toBe(true);
    expect(result.has('step-finish')).toBe(true);
    expect(result.has('tool-result')).toBe(false);
    expect(result.size).toBe(3);
  });

  it('returns empty set when empty array provided', () => {
    const result = getAllowedEventTypes([]);

    expect(result.size).toBe(0);
  });
});
