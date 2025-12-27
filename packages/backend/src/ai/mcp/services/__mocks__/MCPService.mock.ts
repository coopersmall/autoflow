import { mock } from 'bun:test';
import type { ExtractMockMethods } from '@autoflow/core';
import type { IMCPService } from '../../domain/MCPService';

export function getMockedMCPService(): ExtractMockMethods<IMCPService> {
  return {
    createClient: mock(),
  };
}
