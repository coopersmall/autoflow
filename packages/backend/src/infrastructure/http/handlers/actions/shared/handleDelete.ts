import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { Validator } from '@core/validation/validate';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse';

export type HandleDeleteDeps<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: ISharedService<ID, T>;
  readonly validators: {
    readonly id: Validator<ID>;
  };
};

export type HandleDeleteRequest = Record<string, never>;

export async function handleDelete<ID extends Id<string>, T extends Item<ID>>(
  deps: HandleDeleteDeps<ID, T>,
  _request: HandleDeleteRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const { ctx } = requestContext;

  const id = requestContext.getParam('id', deps.validators.id);
  if (id.isErr()) {
    return buildHttpErrorResponse(id.error);
  }

  const result = await deps.service.delete(ctx, id.value);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json({ success: true }, { status: 200 });
}
