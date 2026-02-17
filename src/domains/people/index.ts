/**
 * People domain module.
 *
 * Registers all people-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "people" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPeopleTools } from "./tools.js";

/** Registers people domain tools with the MCP server. */
export function register(server: McpServer): void {
  registerPeopleTools(server);
}
