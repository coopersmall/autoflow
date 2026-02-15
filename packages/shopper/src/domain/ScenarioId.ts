import { createIdSchema, newId } from '@core/domain/Id';
import type zod from 'zod';

export type ScenarioId = zod.infer<typeof scenarioIdSchema>;
export const ScenarioId = newId<ScenarioId>;
export const scenarioIdSchema = createIdSchema('ScenarioId');
