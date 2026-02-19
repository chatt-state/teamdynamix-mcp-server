/**
 * MCP tool definitions for asset operations.
 *
 * Defines the schemas and metadata for asset-related MCP tools
 * such as searching and retrieving assets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AssetCreateParams } from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import { elicitChoice } from "../../middleware/elicitation.js";
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

  server.registerTool(
    "tdx_assets_create",
    {
      title: "Create Asset",
      description:
        "Create a new TeamDynamix asset. StatusID and FormID are required — omit them to select interactively.",
      inputSchema: {
        name: z.string().describe("Asset name"),
        statusId: z
          .number()
          .int()
          .optional()
          .describe("Asset status ID — omit to select interactively"),
        formId: z
          .number()
          .int()
          .optional()
          .describe("Asset form ID — omit to select interactively"),
        serialNumber: z.string().optional().describe("Serial number"),
        tag: z.string().optional().describe("Asset tag"),
        locationId: z.number().int().optional().describe("Location ID"),
        owningCustomerId: z
          .string()
          .optional()
          .describe("Owning customer UID"),
        owningDepartmentId: z
          .number()
          .int()
          .optional()
          .describe("Owning department ID"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        let resolvedStatusId: number;
        if (args.statusId !== undefined) {
          resolvedStatusId = args.statusId;
        } else {
          const statuses = await handlers.getAssetStatuses();
          const selected = await elicitChoice(
            "Select a status for the new asset:",
            "statusId",
            "Asset Status",
            statuses.map((s) => ({ id: s.ID, name: s.Name })),
          );
          if (selected === null) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Asset status selection is required. Provide statusId or try again.",
                },
              ],
              isError: true as const,
            };
          }
          resolvedStatusId = selected;
        }

        let resolvedFormId: number;
        if (args.formId !== undefined) {
          resolvedFormId = args.formId;
        } else {
          const forms = await handlers.getAssetForms();
          const selected = await elicitChoice(
            "Select a form for the new asset:",
            "formId",
            "Asset Form",
            forms.map((f) => ({ id: f.ID, name: f.Name })),
          );
          if (selected === null) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Asset form selection is required. Provide formId or try again.",
                },
              ],
              isError: true as const,
            };
          }
          resolvedFormId = selected;
        }

        const assetData: AssetCreateParams = {
          Name: args.name,
          StatusID: resolvedStatusId,
          FormID: resolvedFormId,
          SerialNumber: args.serialNumber,
          Tag: args.tag,
          LocationID: args.locationId,
          OwningCustomerID: args.owningCustomerId,
          OwningDepartmentID: args.owningDepartmentId,
        };
        const asset = await handlers.createAsset(assetData);
        return {
          content: [
            {
              type: "text" as const,
              text: `Asset #${asset.ID} created: ${asset.Name}`,
            },
          ],
        };
      });
    },
  );
}
