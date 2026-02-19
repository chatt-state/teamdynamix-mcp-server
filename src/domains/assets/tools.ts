/**
 * MCP tool definitions for asset operations.
 *
 * Defines the schemas and metadata for asset-related MCP tools
 * such as searching and retrieving assets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all asset-related tools with the MCP server.
 * Tools follow the `tdx_assets_*` naming convention.
 */
export function registerAssetTools(server: McpServer): void {
  server.registerTool(
    "tdx_assets_search",
    {
      title: "Search Assets",
      description:
        "Search TeamDynamix assets. Returns summary data — use tdx_assets_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across asset fields"),
        statusIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by status IDs"),
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
        const searchParams = {
          SearchText: args.searchText,
          StatusIDs: args.statusIds,
          MaxResults: args.maxResults,
        };
        const assets = await handlers.searchAssets(searchParams);
        const summary = assets
          .map(
            (a) =>
              `#${a.ID} [${a.StatusName ?? "Unknown"}] ${a.Name} (${a.SerialNumber ?? "No S/N"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                assets.length === 0
                  ? "No assets found matching the search criteria."
                  : `Found ${assets.length} asset(s):\n\n${summary}\n\nUse tdx_assets_get for full details on any asset.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_assets_get",
    {
      title: "Get Asset",
      description:
        "Get full asset details by ID including serial number, custom attributes, and attachments.",
      inputSchema: {
        assetId: z
          .number()
          .int()
          .positive()
          .describe("The asset ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const asset = await handlers.getAsset(args.assetId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(asset, null, 2) },
          ],
        };
      });
    },
  );
}
