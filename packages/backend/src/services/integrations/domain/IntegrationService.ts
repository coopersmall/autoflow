import type { IStandardService } from '@backend/services/standard/StandardService';
import type { IntegrationId } from '@core/domain/integrations/BaseIntegration';
import type { Integration } from '@core/domain/integrations/Integration';

export type IIntegrationsService = IStandardService<IntegrationId, Integration>;
