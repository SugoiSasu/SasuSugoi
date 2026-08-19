import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchPlacesTool } from "@/lib/mcp/tools/search_places";
import { getPlaceTool } from "@/lib/mcp/tools/get_place";
import { listCuisinesTool } from "@/lib/mcp/tools/list_cuisines";

/**
 * Fresh McpServer per request — this app runs stateless (no session
 * persistence across HTTP calls), so there's nothing to gain from reusing
 * one instance, and a fresh one avoids any cross-request state leakage.
 */
export function createPozeramyMcpServer(): McpServer {
  const server = new McpServer(
    { name: "pozeramy-mcp", title: "poŻeramy", version: "0.1.0" },
    {
      instructions:
        "Tools for the poŻeramy restaurant guide (pozeramy.live). Use `list_cuisines` to discover cuisine tags, `search_places` to find restaurants by name, cuisine, district, or address, and `get_place` to fetch full details for a specific restaurant slug.",
    },
  );

  for (const tool of [searchPlacesTool, getPlaceTool, listCuisinesTool]) {
    server.registerTool(tool.name, tool.config, tool.handler as never);
  }

  return server;
}
