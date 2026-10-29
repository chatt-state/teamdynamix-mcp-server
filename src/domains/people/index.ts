/**
 * People domain module.
 *
 * Registers all people-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "people" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import { registerPeopleTools } from "./tools.js";

/**
 * Registers people domain tools with the MCP server.
 *
 * `identity` is the verified portal user (or null). It is threaded into the
 * destructive person writes (set_active, create, update, group membership) so
 * those mutations are attributable to a real human — a FERPA accountability
 * requirement, since all calls run through the shared TDX service account.
 */
export function register(
  server: McpServer,
  identity: PortalIdentity | null = null,
): void {
  registerPeopleTools(server, identity);
}
