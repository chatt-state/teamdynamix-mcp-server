/**
 * MCP tool definitions for report operations.
 *
 * Defines the schemas and metadata for report-related MCP tools.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all report-related tools with the MCP server.
 * Tools follow the `tdx_reports_*` naming convention.
 */
export function registerReportTools(server: McpServer): void {
  server.registerTool(
    "tdx_reports_search",
    {
      title: "Search Reports",
      description:
        "Search TeamDynamix reports. Returns summary data — use tdx_reports_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across report names"),
        maxResults: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum results to return"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const reports = await handlers.searchReports({
          SearchText: args.searchText,
          MaxResults: args.maxResults,
        });
        const summary = reports
          .map(
            (r) =>
              `#${r.ID} ${r.Name} (${r.CategoryName ?? "Uncategorized"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                reports.length === 0
                  ? "No reports found matching the search criteria."
                  : `Found ${reports.length} report(s):\n\n${summary}\n\nUse tdx_reports_get for details or tdx_reports_execute to run a report.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_reports_get",
    {
      title: "Get Report",
      description: "Get report details by ID (metadata only, not data).",
      inputSchema: {
        reportId: z
          .number()
          .int()
          .positive()
          .describe("The report ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const report = await handlers.getReport(args.reportId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(report, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_reports_execute",
    {
      title: "Execute Report",
      description:
        "Execute a report and return the resulting data rows and column headers.",
      inputSchema: {
        reportId: z
          .number()
          .int()
          .positive()
          .describe("The report ID to execute"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const data = await handlers.executeReport(args.reportId);
        const rowCount = data.DataRows.length;
        const preview =
          rowCount > 10
            ? `Showing first 10 of ${rowCount} rows`
            : `${rowCount} row(s)`;
        const rows = data.DataRows.slice(0, 10);
        return {
          content: [
            {
              type: "text" as const,
              text: `Report executed — ${preview}:\n\nColumns: ${data.ColumnHeaders.join(", ")}\n\n${JSON.stringify(rows, null, 2)}`,
            },
          ],
        };
      });
    },
  );
}
