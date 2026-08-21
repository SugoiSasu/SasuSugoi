import { createFileRoute } from "@tanstack/react-router";
import { JSONRPCMessageSchema, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { createPozeramyMcpServer } from "@/lib/mcp/server";
import { OneShotHttpTransport } from "@/lib/mcp/http-transport";
import { createRateLimiter } from "@/lib/rate-limit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version",
};

// Best-effort in-memory rate limit (per warm serverless instance - not a
// hard guarantee under multi-instance scaling, but a real deterrent against
// casual scraping/amplification since this endpoint has no other throttle).
const isRateLimited = createRateLimiter(10_000, 30);

function jsonRpcError(status: number, code: number, message: string) {
  return Response.json(
    { jsonrpc: "2.0" as const, id: null, error: { code, message } },
    { status, headers: CORS_HEADERS },
  );
}

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      // No standalone SSE stream is offered - this server is stateless request/response only.
      GET: async () => jsonRpcError(405, -32000, "Method not allowed."),
      DELETE: async () => jsonRpcError(405, -32000, "Method not allowed."),

      POST: async ({ request }) => {
        const clientKey =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown";
        if (isRateLimited(clientKey)) {
          return jsonRpcError(429, -32000, "Too many requests - slow down.");
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonRpcError(400, -32700, "Parse error: invalid JSON body.");
        }

        const rawMessages = Array.isArray(body) ? body : [body];
        const messages: JSONRPCMessage[] = [];
        for (const raw of rawMessages) {
          const parsed = JSONRPCMessageSchema.safeParse(raw);
          if (!parsed.success)
            return jsonRpcError(400, -32600, "Invalid Request: not a valid JSON-RPC message.");
          messages.push(parsed.data);
        }
        if (messages.length === 0)
          return jsonRpcError(400, -32600, "Invalid Request: empty batch.");

        const server = createPozeramyMcpServer();
        const transport = new OneShotHttpTransport();

        try {
          await server.connect(transport);
          const responses = await transport.dispatch(messages);

          if (responses.length === 0) {
            // All-notifications request (e.g. `notifications/initialized`) - nothing to return.
            return new Response(null, { status: 202, headers: CORS_HEADERS });
          }
          const payload = Array.isArray(body) ? responses : responses[0];
          return Response.json(payload, {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("MCP request failed", e);
          return jsonRpcError(500, -32603, "Internal server error");
        } finally {
          await transport.close();
          await server.close();
        }
      },
    },
  },
});
