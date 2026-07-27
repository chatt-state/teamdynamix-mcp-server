/**
 * Tickets domain module.
 *
 * Registers all ticket-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "tickets" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerTicketTools } from "./tools.js";

/**
 * Registers ticket domain tools with the MCP server.
 *
 * `identity` is the cryptographically verified portal user (or null). When
 * present, create/reply attribution comes from it server-side and the
 * model-supplied attribution arguments are ignored.
 */
export function register(server: McpServer, identity: PortalIdentity | null = null): void {
  registerTicketTools(server, identity);
}
