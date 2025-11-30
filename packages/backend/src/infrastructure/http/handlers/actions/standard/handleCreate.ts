import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { StandardService } from '@backend/infrastructure/services/StandardService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import { validUserId } from '@core/domain/user/validation/validUser';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse.ts';

export type HandleCreateContext<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: StandardService<ID, T>;
  readonly validators: {
    readonly partial: Validator<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
  };
};

export type HandleCreateRequest = Record<string, never>;

export async function handleCreate<ID extends Id<string>, T extends Item<ID>>(
  ctx: HandleCreateContext<ID, T>,
  _request: HandleCreateRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const userId = requestContext.getParam('userId', validUserId);
  if (userId.isErr()) {
    return buildHttpErrorResponse(userId.error);
  }

  const body = await requestContext.getBody(ctx.validators.partial);
  if (body.isErr()) {
    return buildHttpErrorResponse(body.error);
  }

  const result = await ctx.service.create(userId.value, body.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 201 });
}
