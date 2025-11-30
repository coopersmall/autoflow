import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { IntegrationId } from '@core/domain/integrations/BaseIntegration';
import type { Integration } from '@core/domain/integrations/Integration';

export type IIntegrationsCache = IStandardCache<IntegrationId, Integration>;
