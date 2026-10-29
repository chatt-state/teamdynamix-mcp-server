/**
 * Attributes domain module.
 *
 * Registers all custom-attribute-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "attributes" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerAttributeTools } from "./tools.js";

/** Registers attribute domain tools with the MCP server. */
export function register(
  server: McpServer,
  _identity: PortalIdentity | null = null,
): void {
  registerAttributeTools(server);
}
