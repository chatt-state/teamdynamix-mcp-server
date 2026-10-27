/**
 * Accounts domain module.
 *
 * Registers all account/department-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "accounts" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerAccountTools } from "./tools.js";

/** Registers accounts domain tools with the MCP server. */
export function register(
  server: McpServer,
  _identity: PortalIdentity | null = null,
): void {
  registerAccountTools(server);
}
