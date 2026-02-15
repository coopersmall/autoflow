import { createIdSchema, newId } from '@core/domain/Id';
import type zod from 'zod';

export type CaptureSessionId = zod.infer<typeof captureSessionIdSchema>;
export const CaptureSessionId = newId<CaptureSessionId>;
export const captureSessionIdSchema = createIdSchema('CaptureSessionId');
