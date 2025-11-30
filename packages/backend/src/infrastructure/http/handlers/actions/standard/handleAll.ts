import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { StandardService } from '@backend/infrastructure/services/StandardService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import { validUserId } from '@core/domain/user/validation/validUser';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse.ts';

export type HandleAllContext<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: StandardService<ID, T>;
};

export type HandleAllRequest = Record<string, never>;

export async function handleAll<ID extends Id<string>, T extends Item<ID>>(
  ctx: HandleAllContext<ID, T>,
  _request: HandleAllRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const userId = requestContext.getParam('userId', validUserId);
  if (userId.isErr()) {
    return buildHttpErrorResponse(userId.error);
  }

  const result = await ctx.service.all(userId.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 200 });
}
