import { describe, expect, it } from 'bun:test';
import { AgentId } from '@autoflow/core';
import * as fc from 'fast-check';
import { convertResultToToolPart } from '../convertResultToToolPart';
import {
  agentIdArb,
  createCompleteResult,
  createErrorResult,
  toolCallIdArb,
} from './fixtures';

describe('convertResultToToolPart', () => {
  describe('Unit Tests', () => {
    it('should convert complete result to success tool result', () => {
      const toolCallId = 'tool-call-123';
      const manifestId = AgentId('test-agent');
      const result = createCompleteResult();

      const toolResult = convertResultToToolPart(
        toolCallId,
        manifestId,
        result,
      );

      expect(toolResult.type).toBe('tool-result');
      expect(toolResult.toolCallId).toBe(toolCallId);
      expect(toolResult.toolName).toBe('sub_agent_test-agent');
      expect(toolResult.isError).toBe(false);
      expect(toolResult.output.type).toBe('json');

      if (toolResult.output.type !== 'json') {
        throw new Error('Output type should be json');
      }

      const parsed = JSON.parse(toolResult.output.value);
      expect(parsed.text).toBe('Task completed successfully');
      expect(parsed.output).toEqual({ success: true });
    });

    it('should convert error result to error tool result', () => {
      const toolCallId = 'tool-call-456';
      const manifestId = AgentId('test-agent');
      const result = createErrorResult('Something went wrong');

      const toolResult = convertResultToToolPart(
        toolCallId,
        manifestId,
        result,
      );

      expect(toolResult.type).toBe('tool-result');
      expect(toolResult.toolCallId).toBe(toolCallId);
      expect(toolResult.toolName).toBe('sub_agent_test-agent');
      expect(toolResult.isError).toBe(true);
      expect(toolResult.output.type).toBe('error-json');

      if (toolResult.output.type !== 'error-json') {
        throw new Error('Output type should be error-json');
      }

      const parsed = JSON.parse(toolResult.output.value);
      expect(parsed.error).toBe('Something went wrong');
      expect(parsed.code).toBe('InternalServer');
    });

    it('should use provided toolCallId in output', () => {
      const toolCallId = 'my-unique-tool-call-id';
      const result = createCompleteResult();
      const manifestId = AgentId('agent-xyz');

      const toolResult = convertResultToToolPart(
        toolCallId,
        manifestId,
        result,
      );

      expect(toolResult.toolCallId).toBe(toolCallId);
    });

    it('should use manifestId in toolName with sub_agent prefix', () => {
      const manifestId = AgentId('my-custom-agent');
      const result = createCompleteResult();

      const toolResult = convertResultToToolPart(
        'tool-call',
        manifestId,
        result,
      );

      expect(toolResult.toolName).toBe('sub_agent_my-custom-agent');
    });

    it('should serialize result text and output as JSON', () => {
      const result = createCompleteResult();
      result.result.text = 'Custom result text';
      result.result.output = { key: 'value', nested: { data: 123 } };
      const manifestId = AgentId('agent');

      const toolResult = convertResultToToolPart(
        'tool-call',
        manifestId,
        result,
      );

      if (toolResult.output.type !== 'json') {
        throw new Error('Output type should be json');
      }

      const parsed = JSON.parse(toolResult.output.value);
      expect(parsed.text).toBe('Custom result text');
      expect(parsed.output).toEqual({ key: 'value', nested: { data: 123 } });
    });

    it('should serialize error message and code as JSON', () => {
      const result = createErrorResult('Custom error message');
      const manifestId = AgentId('agent');

      const toolResult = convertResultToToolPart(
        'tool-call',
        manifestId,
        result,
      );

      if (toolResult.output.type !== 'error-json') {
        throw new Error('Output type should be error-json');
      }

      const parsed = JSON.parse(toolResult.output.value);
      expect(parsed.error).toBe('Custom error message');
      expect(parsed.code).toBe('InternalServer');
    });
  });

  describe('Property Tests', () => {
    it('should produce valid JSON that can be parsed for complete results', async () => {
      await fc.assert(
        fc.asyncProperty(
          toolCallIdArb,
          agentIdArb,
          fc.record({
            text: fc.string({ maxLength: 1000 }),
            output: fc.jsonValue(),
          }),
          async (toolCallId, manifestId, resultData) => {
            const result = createCompleteResult();
            result.result.text = resultData.text;
            result.result.output = resultData.output;

            const toolResult = convertResultToToolPart(
              toolCallId,
              manifestId,
              result,
            );

            if (toolResult.output.type !== 'json') {
              throw new Error('Output type should be json');
            }

            const parsed = JSON.parse(toolResult.output.value);
            expect(parsed.text).toBe(resultData.text);
            expect(parsed.output).toEqual(resultData.output);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should preserve toolCallId exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          toolCallIdArb,
          agentIdArb,
          async (toolCallId, manifestId) => {
            const result = createCompleteResult();

            const toolResult = convertResultToToolPart(
              toolCallId,
              manifestId,
              result,
            );

            expect(toolResult.toolCallId).toBe(toolCallId);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should always include manifestId in toolName', async () => {
      await fc.assert(
        fc.asyncProperty(agentIdArb, async (manifestId) => {
          const result = createCompleteResult();

          const toolResult = convertResultToToolPart(
            'tool-call',
            manifestId,
            result,
          );

          expect(toolResult.toolName).toBe(`sub_agent_${manifestId}`);
        }),
        { numRuns: 30 },
      );
    });
  });
});
