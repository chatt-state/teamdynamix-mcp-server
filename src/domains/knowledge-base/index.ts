/**
 * Knowledge Base domain module.
 *
 * Registers all KB-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "knowledge_base" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerKbTools } from "./tools.js";

/** Registers knowledge base domain tools with the MCP server. */
export function register(
  server: McpServer,
  _identity: PortalIdentity | null = null,
): void {
  registerKbTools(server);
}
