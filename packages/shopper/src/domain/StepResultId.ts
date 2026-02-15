import { createIdSchema, newId } from '@core/domain/Id';
import type zod from 'zod';

export type StepResultId = zod.infer<typeof stepResultIdSchema>;
export const StepResultId = newId<StepResultId>;
export const stepResultIdSchema = createIdSchema('StepResultId');
