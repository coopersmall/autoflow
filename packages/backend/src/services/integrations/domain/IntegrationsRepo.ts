import type { IStandardRepo } from '@backend/repos/StandardRepo';
import type { IntegrationId } from '@core/domain/integrations/BaseIntegration';
import type { Integration } from '@core/domain/integrations/Integration';

export type IIntegrationsRepo = IStandardRepo<IntegrationId, Integration>;
