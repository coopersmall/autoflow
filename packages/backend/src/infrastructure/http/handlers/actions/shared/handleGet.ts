import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse.ts';

export type HandleGetContext<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: ISharedService<ID, T>;
  readonly validators: {
    readonly id: Validator<ID>;
  };
};

export type HandleGetRequest = Record<string, never>;

export async function handleGet<ID extends Id<string>, T extends Item<ID>>(
  ctx: HandleGetContext<ID, T>,
  _request: HandleGetRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const id = requestContext.getParam('id', ctx.validators.id);
  if (id.isErr()) {
    return buildHttpErrorResponse(id.error);
  }

  const result = await ctx.service.get(id.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 200 });
}
