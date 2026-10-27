/**
 * MCP tool definitions for asset operations.
 *
 * Defines the schemas and metadata for asset-related MCP tools
 * such as searching and retrieving assets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AssetCreateParams,
  AssetUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import {
  actingUserSchema,
  resolveActor,
  missingAttributionResult,
  attributionNote,
} from "../../middleware/attribution.js";
import { elicitChoice } from "../../middleware/elicitation.js";
import * as handlers from "./handlers.js";

/**
 * Registers all asset-related tools with the MCP server.
 * Tools follow the `tdx_assets_*` naming convention.
 */
export function registerAssetTools(
  server: McpServer,
  identity: PortalIdentity | null = null,
): void {
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

  server.registerTool(
    "tdx_assets_update",
    {
      title: "Update Asset",
      description:
        "Update an existing TeamDynamix asset. Only the fields you supply are changed.",
      inputSchema: {
        assetId: z
          .number()
          .int()
          .positive()
          .describe("The asset ID to update"),
        name: z.string().optional().describe("Asset name"),
        statusId: z
          .number()
          .int()
          .optional()
          .describe("Asset status ID — omit to select interactively"),
        formId: z
          .number()
          .int()
          .optional()
          .describe("Asset form ID"),
        serialNumber: z.string().optional().describe("Serial number"),
        tag: z.string().optional().describe("Asset tag"),
        locationId: z.number().int().optional().describe("Location ID"),
        locationRoomId: z
          .number()
          .int()
          .optional()
          .describe("Location room ID"),
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
        const { assetId, ...fields } = args;

        // Partial update: only forward the fields the caller supplied so an
        // omitted field leaves the asset's current value untouched. StatusID
        // and FormID are passed through verbatim when given (no elicitation —
        // an omitted status simply means "don't change it").
        const updateData: AssetUpdateParams = {};
        if (fields.name !== undefined) updateData.Name = fields.name;
        if (fields.statusId !== undefined)
          updateData.StatusID = fields.statusId;
        if (fields.formId !== undefined) updateData.FormID = fields.formId;
        if (fields.serialNumber !== undefined)
          updateData.SerialNumber = fields.serialNumber;
        if (fields.tag !== undefined) updateData.Tag = fields.tag;
        if (fields.locationId !== undefined)
          updateData.LocationID = fields.locationId;
        if (fields.locationRoomId !== undefined)
          updateData.LocationRoomID = fields.locationRoomId;
        if (fields.owningCustomerId !== undefined)
          updateData.OwningCustomerID = fields.owningCustomerId;
        if (fields.owningDepartmentId !== undefined)
          updateData.OwningDepartmentID = fields.owningDepartmentId;

        const asset = await handlers.updateAsset(assetId, updateData);
        return {
          content: [
            {
              type: "text" as const,
              text: `Asset #${asset.ID} updated: ${asset.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_assets_delete",
    {
      title: "Delete Asset",
      description:
        "Delete a TeamDynamix asset by ID.\n\n" +
        "ATTRIBUTION REQUIRED: deleting an asset is destructive and runs " +
        "through the shared TDX service account, so supply the real name and " +
        "email of the user making the change (never guess) — it is recorded in " +
        "the confirmation so the deletion is human-attributable.",
      inputSchema: {
        assetId: z
          .number()
          .int()
          .positive()
          .describe("The asset ID to delete"),
        ...actingUserSchema(identity),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const actor = resolveActor(
          identity,
          args.actingUserFullName,
          args.actingUserEmail,
        );
        if (!actor) return missingAttributionResult();
        await handlers.deleteAsset(args.assetId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Asset #${args.assetId} deleted.${attributionNote(actor)}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_assets_get_attachments",
    {
      title: "Get Asset Attachments",
      description:
        "List the file attachments on a TeamDynamix asset. Returns summary data.",
      inputSchema: {
        assetId: z
          .number()
          .int()
          .positive()
          .describe("The asset ID whose attachments to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const attachments = await handlers.getAssetAttachments(args.assetId);
        const summary = attachments
          .map(
            (a) =>
              `#${a.ID} ${a.Name} (${a.ContentType}, ${a.Size} bytes, uploaded ${a.CreatedDate})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                attachments.length === 0
                  ? `No attachments found on asset #${args.assetId}.`
                  : `Found ${attachments.length} attachment(s) on asset #${args.assetId}:\n\n${summary}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_assets_get_feed",
    {
      title: "Get Asset Feed",
      description:
        "Get the activity feed (comments and updates) for a TeamDynamix asset. Returns summary data.",
      inputSchema: {
        assetId: z
          .number()
          .int()
          .positive()
          .describe("The asset ID whose feed to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const entries = await handlers.getAssetFeed(args.assetId);
        const summary = entries
          .map(
            (e) =>
              `#${e.ID} [${e.CreatedDate}] ${e.CreatedFullName}${e.IsPrivate ? " (private)" : ""}: ${e.Comments}`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                entries.length === 0
                  ? `No feed entries found on asset #${args.assetId}.`
                  : `Found ${entries.length} feed entr(y/ies) on asset #${args.assetId}:\n\n${summary}`,
            },
          ],
        };
      });
    },
  );
}
