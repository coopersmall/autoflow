import { mock } from 'bun:test';
import { MCPClientId } from '@autoflow/core';
import type { ExtractMockMethods } from '@core/types';
import type { IMCPClient } from '../../domain/MCPClient';

export function getMockedMCPClient(): ExtractMockMethods<IMCPClient> {
  return {
    id: MCPClientId('mock-client-id'),
    name: 'mock-client',
    tools: mock(),
    listResources: mock(),
    readResource: mock(),
    close: mock(),
  };
}
