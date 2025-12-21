import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse';

export type HandleCreateDeps<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: ISharedService<ID, T>;
  readonly validators: {
    readonly partial: Validator<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
  };
};

export type HandleCreateRequest = Record<string, never>;

export async function handleCreate<ID extends Id<string>, T extends Item<ID>>(
  deps: HandleCreateDeps<ID, T>,
  _request: HandleCreateRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const { ctx } = requestContext;

  const body = await requestContext.getBody(deps.validators.partial);
  if (body.isErr()) {
    return buildHttpErrorResponse(body.error);
  }

  const result = await deps.service.create(ctx, body.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 201 });
}
