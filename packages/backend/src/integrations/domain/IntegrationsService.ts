import type { IStandardService } from '@backend/infrastructure/services/StandardService';
import type { IntegrationId } from '@core/domain/integrations/BaseIntegration';
import type { Integration } from '@core/domain/integrations/Integration';

export type IIntegrationsService = Readonly<
  IStandardService<IntegrationId, Integration>
>;
