/**
 * Tickets domain module.
 *
 * Registers all ticket-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "tickets" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTicketTools } from "./tools.js";

/** Registers ticket domain tools with the MCP server. */
export function register(server: McpServer): void {
  registerTicketTools(server);
}
