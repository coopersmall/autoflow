import { createIdSchema, newId } from '@core/domain/Id';
import type zod from 'zod';

export type ShopperSessionId = zod.infer<typeof shopperSessionIdSchema>;
export const ShopperSessionId = newId<ShopperSessionId>;
export const shopperSessionIdSchema = createIdSchema('ShopperSessionId');
