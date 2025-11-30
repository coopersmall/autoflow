import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { StandardService } from '@backend/infrastructure/services/StandardService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import { validUserId } from '@core/domain/user/validation/validUser';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse.ts';

export type HandleDeleteContext<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: StandardService<ID, T>;
  readonly validators: {
    readonly id: Validator<ID>;
  };
};

export type HandleDeleteRequest = Record<string, never>;

export async function handleDelete<ID extends Id<string>, T extends Item<ID>>(
  ctx: HandleDeleteContext<ID, T>,
  _request: HandleDeleteRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const id = requestContext.getParam('id', ctx.validators.id);
  if (id.isErr()) {
    return buildHttpErrorResponse(id.error);
  }

  const userId = requestContext.getParam('userId', validUserId);
  if (userId.isErr()) {
    return buildHttpErrorResponse(userId.error);
  }

  const result = await ctx.service.delete(id.value, userId.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json({ success: true }, { status: 200 });
}
