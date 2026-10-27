/**
 * Locations domain module.
 *
 * Registers all location- and room-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when the
 * "locations" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLocationTools } from "./tools.js";

/** Registers locations domain tools with the MCP server. */
export function register(server: McpServer): void {
  registerLocationTools(server);
}
