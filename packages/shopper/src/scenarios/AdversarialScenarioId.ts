import { createIdSchema, newId } from '@core/domain/Id';
import type zod from 'zod';

export type AdversarialScenarioId = zod.infer<
  typeof adversarialScenarioIdSchema
>;
export const AdversarialScenarioId = newId<AdversarialScenarioId>;
export const adversarialScenarioIdSchema = createIdSchema(
  'AdversarialScenarioId',
);
