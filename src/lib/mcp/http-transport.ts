import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * Minimal stateless MCP transport for one HTTP request/response cycle.
 *
 * The official `StreamableHTTPServerTransport` is built around Node's
 * `http.IncomingMessage`/`ServerResponse`, which TanStack Start's fetch-based
 * route handlers don't expose. Rather than shim Node's HTTP types, this
 * implements the SDK's transport-agnostic `Transport` interface directly:
 * feed in the incoming JSON-RPC message(s) via `dispatch()`, get back
 * whatever the server sent in response. No SSE, no sessions — matches the
 * SDK's own documented "stateless" pattern (fresh server+transport per
 * request, `sessionIdGenerator: undefined` equivalent).
 */
export class OneShotHttpTransport implements Transport {
  private pending = new Map<string, (message: JSONRPCMessage) => void>();

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  async start(): Promise<void> {}

  async close(): Promise<void> {
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if ("id" in message && message.id !== null && message.id !== undefined) {
      this.pending.get(String(message.id))?.(message);
    }
  }

  /**
   * Feed every message from one HTTP request body (single or JSON-RPC batch)
   * and resolve once all correlated responses have arrived. Notifications
   * (no `id`) produce no response and aren't waited on.
   */
  async dispatch(messages: JSONRPCMessage[], timeoutMs = 25_000): Promise<JSONRPCMessage[]> {
    const waits = messages
      .filter(
        (m): m is JSONRPCMessage & { id: string | number } =>
          "id" in m && m.id !== null && m.id !== undefined,
      )
      .map(
        (m) =>
          new Promise<JSONRPCMessage>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("MCP request timed out")), timeoutMs);
            this.pending.set(String(m.id), (message) => {
              clearTimeout(timer);
              resolve(message);
            });
          }),
      );

    for (const message of messages) this.onmessage?.(message);

    return Promise.all(waits);
  }
}
