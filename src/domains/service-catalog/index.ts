/**
 * Service catalog domain module.
 *
 * Registers all service-catalog-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "service_catalog" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerServiceCatalogTools } from "./tools.js";

/** Registers service catalog domain tools with the MCP server. */
export function register(
  server: McpServer,
  _identity: PortalIdentity | null = null,
): void {
  registerServiceCatalogTools(server);
}
