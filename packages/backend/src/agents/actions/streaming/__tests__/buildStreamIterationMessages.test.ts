import { describe, expect, it } from 'bun:test';
import type { RequestToolResultPart, ToolCallPart } from '@core/domain/ai';
import { buildStreamIterationMessages } from '../../messages/buildStreamIterationMessages';

describe('buildStreamIterationMessages', () => {
  describe('text only', () => {
    it('creates assistant message with simple string content', () => {
      const result = buildStreamIterationMessages({
        text: 'Hello, world!',
        toolCalls: [],
        toolResultParts: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      if (result[0].role === 'assistant') {
        expect(result[0].content).toBe('Hello, world!');
      }
    });

    it('returns empty array when no content', () => {
      const result = buildStreamIterationMessages({
        text: '',
        toolCalls: [],
        toolResultParts: [],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('tool calls only', () => {
    it('creates assistant message with tool call parts', () => {
      const toolCalls: ToolCallPart[] = [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'search',
          input: { query: 'test' },
        },
      ];

      const result = buildStreamIterationMessages({
        text: '',
        toolCalls,
        toolResultParts: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      if (result[0].role === 'assistant') {
        expect(Array.isArray(result[0].content)).toBe(true);
        if (Array.isArray(result[0].content)) {
          expect(result[0].content).toHaveLength(1);
          expect(result[0].content[0].type).toBe('tool-call');
        }
      }
    });

    it('serializes tool input as JSON string', () => {
      const toolCalls: ToolCallPart[] = [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'search',
          input: { query: 'test', limit: 10 },
        },
      ];

      const result = buildStreamIterationMessages({
        text: '',
        toolCalls,
        toolResultParts: [],
      });

      if (
        result[0].role === 'assistant' &&
        Array.isArray(result[0].content) &&
        result[0].content[0].type === 'tool-call'
      ) {
        expect(result[0].content[0].input).toBe('{"query":"test","limit":10}');
      }
    });
  });

  describe('text and tool calls', () => {
    it('creates assistant message with array content', () => {
      const toolCalls: ToolCallPart[] = [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'search',
          input: { query: 'test' },
        },
      ];

      const result = buildStreamIterationMessages({
        text: 'Let me search for that.',
        toolCalls,
        toolResultParts: [],
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      if (result[0].role === 'assistant') {
        expect(Array.isArray(result[0].content)).toBe(true);
        if (Array.isArray(result[0].content)) {
          expect(result[0].content).toHaveLength(2);
          expect(result[0].content[0].type).toBe('text');
          expect(result[0].content[1].type).toBe('tool-call');
        }
      }
    });
  });

  describe('with tool results', () => {
    it('creates tool message with results', () => {
      const toolCalls: ToolCallPart[] = [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'search',
          input: { query: 'test' },
        },
      ];

      const toolResultParts: RequestToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'search',
          output: { type: 'text', value: 'Found 5 results' },
          isError: false,
        },
      ];

      const result = buildStreamIterationMessages({
        text: 'Searching...',
        toolCalls,
        toolResultParts,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('assistant');
      expect(result[1].role).toBe('tool');
      if (result[1].role === 'tool') {
        expect(result[1].content).toHaveLength(1);
        const firstPart = result[1].content[0];
        if (firstPart.type === 'tool-result') {
          expect(firstPart.toolCallId).toBe('call-1');
        }
      }
    });

    it('handles multiple tool results', () => {
      const toolCalls: ToolCallPart[] = [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'search',
          input: { query: 'test' },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'fetch',
          input: { url: 'http://example.com' },
        },
      ];

      const toolResultParts: RequestToolResultPart[] = [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'search',
          output: { type: 'text', value: 'Search results' },
          isError: false,
        },
        {
          type: 'tool-result',
          toolCallId: 'call-2',
          toolName: 'fetch',
          output: { type: 'text', value: 'Fetched content' },
          isError: false,
        },
      ];

      const result = buildStreamIterationMessages({
        text: '',
        toolCalls,
        toolResultParts,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('assistant');
      expect(result[1].role).toBe('tool');
      if (result[1].role === 'tool') {
        expect(result[1].content).toHaveLength(2);
      }
    });
  });
});
