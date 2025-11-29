# HTTP Handlers Guide

This guide covers creating HTTP endpoints for your services using Autoflow's handler patterns.

## Overview

HTTP handlers in Autoflow:
- Live in `packages/backend/src/http/handlers/`
- Use Result types for error handling
- Receive services via dependency injection
- Return standard HTTP responses

## Basic Handler

```typescript
// packages/backend/src/http/handlers/users/getUser.ts

import type { IUsersService } from '@backend/services/users/domain/UsersService';
import { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

export async function getUser(
  request: Request,
  context: { users: () => IUsersService },
): Promise<Response> {
  const id = UserId(request.params.id);
  
  const result = await context.users().get(id);
  
  if (result.isErr()) {
    return errorResponse(result.error);
  }
  
  return jsonResponse(result.value, 200);
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: ErrorWithMetadata): Response {
  return new Response(JSON.stringify({ error: error.message }), {
    status: getStatusCode(error),
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Request Validation

```typescript
import { validate } from '@core/validation/validate';
import zod from 'zod';

const createUserRequestSchema = zod.object({
  email: zod.string().email(),
  name: zod.string().min(1),
});

export async function createUser(
  request: Request,
  context: { users: () => IUsersService },
): Promise<Response> {
  // Parse and validate body
  const body = await request.json();
  const validationResult = validate(createUserRequestSchema, body);
  
  if (validationResult.isErr()) {
    return jsonResponse({ error: validationResult.error.message }, 400);
  }
  
  // Create user
  const result = await context.users().create({
    schemaVersion: 1,
    ...validationResult.value,
  });
  
  if (result.isErr()) {
    return errorResponse(result.error);
  }
  
  return jsonResponse(result.value, 201);
}
```

## Next Steps

- [Services Guide](./services.md) - Create services to use in handlers
- [Testing Guide](./testing.md) - Test your handlers
- [Architecture Guide](./architecture.md) - Understand Result types
