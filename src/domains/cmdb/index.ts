/**
 * CMDB domain module.
 *
 * Registers all CMDB configuration-item MCP tools with the server.
 * This module is lazy-loaded by the domain registry when the "cmdb"
 * domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerCmdbTools } from "./tools.js";

/** Registers CMDB domain tools with the MCP server. */
export function register(
  server: McpServer,
  identity: PortalIdentity | null = null,
): void {
  registerCmdbTools(server, identity);
}
