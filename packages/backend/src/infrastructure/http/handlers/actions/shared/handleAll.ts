import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import { buildHttpErrorResponse } from '../../errors/buildHttpErrorResponse';

export type HandleAllDeps<ID extends Id<string>, T extends Item<ID>> = {
  readonly service: ISharedService<ID, T>;
};

export type HandleAllRequest = Record<string, never>;

export async function handleAll<ID extends Id<string>, T extends Item<ID>>(
  deps: HandleAllDeps<ID, T>,
  _request: HandleAllRequest,
  requestContext: RequestContext,
): Promise<Response> {
  const { ctx } = requestContext;

  const result = await deps.service.all(ctx);
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 200 });
}
