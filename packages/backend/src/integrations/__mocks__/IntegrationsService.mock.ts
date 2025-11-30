import { mock } from 'bun:test';
import type { IIntegrationsService } from '@backend/integrations/domain/IntegrationsService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedIntegrationsService(): ExtractMockMethods<IIntegrationsService> {
  return {
    serviceName: 'integrations',
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  };
}
