/**
 * Projects domain module.
 *
 * Registers all project-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "projects" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./tools.js";

/** Registers project domain tools with the MCP server. */
export function register(server: McpServer): void {
  registerProjectTools(server);
}
