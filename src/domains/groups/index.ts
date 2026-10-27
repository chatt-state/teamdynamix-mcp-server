/**
 * Groups domain module.
 *
 * Registers all group-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "groups" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGroupTools } from "./tools.js";

/** Registers groups domain tools with the MCP server. */
export function register(server: McpServer): void {
  registerGroupTools(server);
}
