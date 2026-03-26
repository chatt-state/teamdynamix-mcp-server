/**
 * Reports domain module.
 *
 * Registers all report-related MCP tools with the server.
 * This module is lazy-loaded by the domain registry when
 * the "reports" domain is requested.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReportTools } from "./tools.js";

/** Registers report domain tools with the MCP server. */
export function register(server: McpServer): void {
  registerReportTools(server);
}
