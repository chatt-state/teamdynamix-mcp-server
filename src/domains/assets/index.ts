/**
 * Assets domain module.
 *
 * Registers all asset-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "assets" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAssetTools } from "./tools.js";

/** Registers asset domain tools with the MCP server. */
export function register(server: McpServer): void {
  registerAssetTools(server);
}
