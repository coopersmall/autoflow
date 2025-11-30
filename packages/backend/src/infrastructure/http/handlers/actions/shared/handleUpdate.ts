import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse.ts';

export type HandleUpdateContext<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: ISharedService<ID, T>;
  readonly validators: {
    readonly id: Validator<ID>;
    readonly update: Validator<Partial<T>>;
  };
};

export type HandleUpdateRequest = Record<string, never>;

export async function handleUpdate<ID extends Id<string>, T extends Item<ID>>(
  ctx: HandleUpdateContext<ID, T>,
  _request: HandleUpdateRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const id = requestContext.getParam('id', ctx.validators.id);
  if (id.isErr()) {
    return buildHttpErrorResponse(id.error);
  }

  const body = await requestContext.getBody(ctx.validators.update);
  if (body.isErr()) {
    return buildHttpErrorResponse(body.error);
  }

  const result = await ctx.service.update(id.value, body.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 200 });
}
