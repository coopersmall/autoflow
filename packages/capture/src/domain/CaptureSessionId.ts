import zod from 'zod';
import { createIdSchema, newId } from '@core/domain/Id';

export type CaptureSessionId = zod.infer<typeof captureSessionIdSchema>;
export const CaptureSessionId = newId<CaptureSessionId>;
export const captureSessionIdSchema = createIdSchema('CaptureSessionId');
