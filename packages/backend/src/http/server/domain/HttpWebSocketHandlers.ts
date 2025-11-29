import type { ServerWebSocket } from 'bun';

/**
 * WebSocket event handlers for server-side WebSocket connections.
 *
 * Defines handlers for WebSocket lifecycle events (open, message, close).
 * Used to configure WebSocket behavior when starting an HTTP server.
 *
 * @example
 * ```ts
 * const handlers: WebSocketHandlers = {
 *   open: (ws) => console.log('Client connected'),
 *   message: (ws, message) => ws.send(`Echo: ${message}`),
 *   close: (ws, code, reason) => console.log('Client disconnected')
 * };
 * ```
 */
export interface WebSocketHandlers {
  /**
   * Called when a WebSocket connection is established.
   * @param ws - The WebSocket connection
   */
  open: (ws: ServerWebSocket) => void;

  /**
   * Called when a message is received from the client.
   * @param ws - The WebSocket connection
   * @param message - The message string received
   */
  message: (ws: ServerWebSocket, message: string) => void;

  /**
   * Called when a WebSocket connection is closed.
   * @param ws - The WebSocket connection
   * @param code - The close status code
   * @param reason - The close reason string
   */
  close: (ws: ServerWebSocket, code: number, reason: string) => void;
}

/**
 * Default WebSocket handlers that perform no operations.
 * Used when no custom WebSocket handlers are provided to the server.
 */
export const defaultWebSocketHandlers: WebSocketHandlers = {
  open: (_ws: ServerWebSocket) => {
    // Default no-op
  },
  message: (_ws: ServerWebSocket, _message: string) => {
    // Default no-op
  },
  close: (_ws: ServerWebSocket, _code: number, _reason: string) => {
    // Default no-op
  },
} as const;
