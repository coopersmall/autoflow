import { createIdSchema, newId } from '@core/domain/Id';
import type zod from 'zod';

export type ScoreId = zod.infer<typeof scoreIdSchema>;
export const ScoreId = newId<ScoreId>;
export const scoreIdSchema = createIdSchema('ScoreId');

export type ReportId = zod.infer<typeof reportIdSchema>;
export const ReportId = newId<ReportId>;
export const reportIdSchema = createIdSchema('ReportId');
