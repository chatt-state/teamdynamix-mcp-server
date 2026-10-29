/**
 * Time domain module.
 *
 * Registers all time-entry-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "time" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerTimeTools } from "./tools.js";

/** Registers time domain tools with the MCP server. */
export function register(
  server: McpServer,
  _identity: PortalIdentity | null = null,
): void {
  registerTimeTools(server);
}
