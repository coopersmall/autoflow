import { mock } from 'bun:test';
import { MCPClientId } from '@autoflow/core';
import { ok } from 'neverthrow';
import type { IMCPClient, MCPTool } from '../../domain/MCPClient';
import type { IMCPService } from '../../domain/MCPService';

export function getMockedMCPService(): {
  service: IMCPService;
  mockClient: IMCPClient;
} {
  const mockTools: MCPTool[] = [
    {
      type: 'function',
      function: {
        name: 'browser_navigate',
        description: 'Navigate to a URL',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url'],
        },
      },
      execute: mock(async () => ({ success: true })),
    },
  ];

  const mockClient: IMCPClient = {
    id: MCPClientId(),
    name: 'mock-client',
    tools: mock(async () => ok(mockTools)),
    listResources: mock(async () => ok([])),
    readResource: mock(async () => ok({ uri: '', text: '' })),
    close: mock(async () => ok(undefined)),
  };

  const service: IMCPService = {
    createClient: mock(async () => ok(mockClient)),
  };

  return { service, mockClient };
}
