import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { StandardService } from '@backend/infrastructure/services/StandardService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import { validUserId } from '@core/domain/user/validation/validUser';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse';

export type HandleUpdateDeps<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: StandardService<ID, T>;
  readonly validators: {
    readonly id: Validator<ID>;
    readonly update: Validator<Partial<T>>;
  };
};

export type HandleUpdateRequest = Record<string, never>;

export async function handleUpdate<ID extends Id<string>, T extends Item<ID>>(
  deps: HandleUpdateDeps<ID, T>,
  _request: HandleUpdateRequest,
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

  const body = await requestContext.getBody(deps.validators.update);
  if (body.isErr()) {
    return buildHttpErrorResponse(body.error);
  }

  const result = await deps.service.update(
    ctx,
    id.value,
    userId.value,
    body.value,
  );
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 200 });
}
