import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { StandardService } from '@backend/infrastructure/services/StandardService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import { validUserId } from '@core/domain/user/validation/validUser';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse.ts';

export type HandleGetDeps<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: StandardService<ID, T>;
  readonly validators: {
    readonly id: Validator<ID>;
  };
};

export type HandleGetRequest = Record<string, never>;

export async function handleGet<ID extends Id<string>, T extends Item<ID>>(
  deps: HandleGetDeps<ID, T>,
  _request: HandleGetRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const { ctx } = requestContext;

  const id = requestContext.getParam('id', deps.validators.id);
  if (id.isErr()) {
    return buildHttpErrorResponse(id.error);
  }

  const userId = requestContext.getParam('userId', validUserId);
  if (userId.isErr()) {
    return buildHttpErrorResponse(userId.error);
  }

  const result = await deps.service.get(ctx, id.value, userId.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 200 });
}
