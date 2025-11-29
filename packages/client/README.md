# @autoflow/client

Browser-side HTTP client and React hooks for communicating with the backend API.

## Purpose

This package provides:

1. **HTTP Client** - Type-safe API requests with streaming support
2. **React Hooks** - Authentication and data fetching hooks
3. **Stream Utilities** - Parsing and handling streaming responses (for AI)

## HTTP Client

### Basic Requests

```typescript
import { HttpClient, sendRequest } from '@autoflow/client';

// Create a client instance
const client = new HttpClient({
  baseUrl: 'http://localhost:3000',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Make a request
const result = await sendRequest(client, {
  method: 'GET',
  path: '/api/users',
});

if (result.isErr()) {
  console.error('Request failed:', result.error);
} else {
  const users = result.value;
}
```

### Streaming Requests

For AI responses and other streaming data:

```typescript
import { sendStreamRequest } from '@autoflow/client';

const streamResult = await sendStreamRequest(client, {
  method: 'POST',
  path: '/api/ai/chat',
  body: { message: 'Hello' },
});

if (streamResult.isErr()) {
  console.error('Stream failed:', streamResult.error);
  return;
}

// Process the stream
for await (const chunk of streamResult.value) {
  console.log('Received:', chunk);
}
```

## React Hooks

### useLocalClient

Creates a configured HTTP client for the current environment:

```typescript
import { useLocalClient } from '@autoflow/client';

function MyComponent() {
  const client = useLocalClient();
  
  const fetchData = async () => {
    const result = await sendRequest(client, {
      method: 'GET',
      path: '/api/data',
    });
    // ...
  };
}
```

### useAuthCookie

Manages authentication cookies:

```typescript
import { useAuthCookie } from '@autoflow/client';

function AuthComponent() {
  const { token, setToken, clearToken } = useAuthCookie();
  
  const login = async (credentials) => {
    const result = await authenticate(credentials);
    if (result.isOk()) {
      setToken(result.value.token);
    }
  };
  
  const logout = () => {
    clearToken();
  };
}
```

## Stream Utilities

### parseStreamChunks

Parses streaming responses into typed chunks:

```typescript
import { parseStreamChunks } from '@autoflow/client';

const chunks = parseStreamChunks(response.body, {
  onChunk: (chunk) => {
    // Handle each parsed chunk
    console.log(chunk.type, chunk.data);
  },
  onError: (error) => {
    console.error('Parse error:', error);
  },
});
```

### stream

Higher-level streaming utility:

```typescript
import { stream } from '@autoflow/client';

await stream({
  client,
  path: '/api/ai/generate',
  body: { prompt: 'Write a poem' },
  onChunk: (chunk) => {
    // Append to UI
    appendText(chunk.content);
  },
  onComplete: (fullResponse) => {
    // Handle completion
  },
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Component                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
│  useLocalClient │ │useAuthCookie│ │     stream()    │
└────────┬────────┘ └───────────┘ └────────┬────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      HttpClient                             │
│           sendRequest() / sendStreamRequest()               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API                              │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── http-client/
│   ├── httpClient.ts        # HttpClient class
│   ├── sendRequest.ts       # Standard request function
│   └── sendStreamRequest.ts # Streaming request function
│
├── hooks/
│   ├── useLocalClient.ts    # Client hook
│   ├── useCookies.ts        # Auth cookie hook
│   └── client/
│       ├── parseStreamChunks.ts  # Stream parsing
│       └── stream.ts             # Stream utility
│
└── index.ts                 # Public exports
```

## Usage

```typescript
import {
  // HTTP Client
  HttpClient,
  sendRequest,
  sendStreamRequest,
  
  // Hooks
  useLocalClient,
  useAuthCookie,
  
  // Stream utilities
  parseStreamChunks,
  stream,
} from '@autoflow/client';
```

## Design Decisions

### Why Result Types?

Requests return `Result<T, Error>` instead of throwing to make error handling explicit:

```typescript
// Clear error handling path
const result = await sendRequest(client, config);
if (result.isErr()) {
  // Handle error
  return;
}
// Use result.value safely
```

### Why Separate Stream Utilities?

AI responses are streamed for better UX. The stream utilities handle:
- Parsing Server-Sent Events (SSE)
- Buffering partial chunks
- Type-safe chunk handling
- Error recovery
