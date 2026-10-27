/**
 * MCP tool definitions for CMDB configuration item operations.
 *
 * Defines the schemas and metadata for CMDB-related MCP tools: searching,
 * retrieving, creating, updating and deleting configuration items, managing
 * their relationships, reading their activity feed, and attaching files.
 * Tools follow the `tdx_cmdb_*` naming convention.
 *
 * Note on required ids: TDX requires TypeID and FormID on CI create, and a
 * relationship TypeID on addRelationship. The CMDB resource exposes no lookup
 * endpoints for these (unlike assets, which has getStatuses/getForms), so there
 * is nothing to populate an interactive elicitation list from. These ids are
 * therefore required inputs rather than interactively selected — the caller
 * supplies them, which also keeps create usable over a stateless HTTP client.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CICreateParams,
  CIUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all CMDB-related tools with the MCP server.
 * Tools follow the `tdx_cmdb_*` naming convention.
 */
export function registerCmdbTools(server: McpServer): void {
  server.registerTool(
    "tdx_cmdb_search",
    {
      title: "Search Configuration Items",
      description:
        "Search TeamDynamix CMDB configuration items. Returns summary data — use tdx_cmdb_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across configuration item fields"),
        typeIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by configuration item type IDs"),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active state"),
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
        const items = await handlers.searchConfigurationItems({
          SearchText: args.searchText,
          TypeIDs: args.typeIds,
          IsActive: args.isActive,
          MaxResults: args.maxResults,
        });
        const summary = items
          .map(
            (ci) =>
              `#${ci.ID} [${ci.TypeName ?? "Unknown type"}] ${ci.Name}${ci.IsActive ? "" : " (inactive)"}`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                items.length === 0
                  ? "No configuration items found matching the search criteria."
                  : `Found ${items.length} configuration item(s):\n\n${summary}\n\nUse tdx_cmdb_get for full details on any item.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_get",
    {
      title: "Get Configuration Item",
      description:
        "Get full configuration item details by ID including type, form, owner, and custom attributes.",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("The configuration item ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const ci = await handlers.getConfigurationItem(args.ciId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(ci, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_get_relationships",
    {
      title: "Get Configuration Item Relationships",
      description:
        "List the relationships (dependencies, connections) for a configuration item.",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("The configuration item ID whose relationships to list"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const relationships = await handlers.getCIRelationships(args.ciId);
        const summary = relationships
          .map(
            (r) =>
              `#${r.ID} ${r.IsReverse ? "<-" : "->"} ${r.TypeName ?? `type ${r.TypeID}`}: ${r.RelatedItemName ?? `item ${r.RelatedItemID}`} (#${r.RelatedItemID})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                relationships.length === 0
                  ? `No relationships found for configuration item #${args.ciId}.`
                  : `Found ${relationships.length} relationship(s) for #${args.ciId}:\n\n${summary}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_get_feed",
    {
      title: "Get Configuration Item Feed",
      description: "Get the activity feed (comments and updates) for a configuration item.",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("The configuration item ID whose feed to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const feed = await handlers.getCIFeed(args.ciId);
        const summary = feed
          .map(
            (f) =>
              `#${f.ID} ${f.CreatedDate} — ${f.CreatedFullName}: ${f.Comments}`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                feed.length === 0
                  ? `No feed entries found for configuration item #${args.ciId}.`
                  : `Found ${feed.length} feed entry/entries for #${args.ciId}:\n\n${summary}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_create",
    {
      title: "Create Configuration Item",
      description:
        "Create a new TeamDynamix CMDB configuration item. TypeID and FormID are required — the CMDB app exposes no lookup endpoints for them, so supply the numeric ids directly.",
      inputSchema: {
        name: z.string().describe("Configuration item name"),
        typeId: z
          .number()
          .int()
          .positive()
          .describe("Configuration item type ID (required)"),
        formId: z
          .number()
          .int()
          .positive()
          .describe("Configuration item form ID (required)"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the item is active (default: true)"),
        ownerUid: z
          .string()
          .optional()
          .describe("Owning person UID (Guid)"),
        externalId: z
          .string()
          .optional()
          .describe("External identifier for integration sources"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const ciData: CICreateParams = {
          Name: args.name,
          TypeID: args.typeId,
          FormID: args.formId,
        };
        if (args.isActive !== undefined) ciData.IsActive = args.isActive;
        if (args.ownerUid !== undefined) ciData.OwnerUID = args.ownerUid;
        if (args.externalId !== undefined) ciData.ExternalID = args.externalId;

        const ci = await handlers.createConfigurationItem(ciData);
        return {
          content: [
            {
              type: "text" as const,
              text: `Configuration item #${ci.ID} created: ${ci.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_update",
    {
      title: "Update Configuration Item",
      description: "Update an existing TeamDynamix CMDB configuration item.",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("Configuration item ID to update"),
        name: z.string().optional().describe("Updated name"),
        typeId: z.number().int().positive().optional().describe("Updated type ID"),
        formId: z.number().int().positive().optional().describe("Updated form ID"),
        isActive: z.boolean().optional().describe("Updated active state"),
        ownerUid: z.string().optional().describe("Updated owning person UID"),
        externalId: z.string().optional().describe("Updated external identifier"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { ciId, ...fields } = args;
        const updateData: CIUpdateParams = {};
        if (fields.name !== undefined) updateData.Name = fields.name;
        if (fields.typeId !== undefined) updateData.TypeID = fields.typeId;
        if (fields.formId !== undefined) updateData.FormID = fields.formId;
        if (fields.isActive !== undefined) updateData.IsActive = fields.isActive;
        if (fields.ownerUid !== undefined) updateData.OwnerUID = fields.ownerUid;
        if (fields.externalId !== undefined)
          updateData.ExternalID = fields.externalId;

        const ci = await handlers.updateConfigurationItem(ciId, updateData);
        return {
          content: [
            {
              type: "text" as const,
              text: `Configuration item #${ci.ID} updated: ${ci.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_delete",
    {
      title: "Delete Configuration Item",
      description: "Delete a configuration item by ID.",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("Configuration item ID to delete"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        await handlers.deleteConfigurationItem(args.ciId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Configuration item #${args.ciId} deleted.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_add_relationship",
    {
      title: "Add Configuration Item Relationship",
      description:
        "Relate one configuration item to another. Provide the relationship TypeID (required) — the CMDB app exposes no lookup endpoint for relationship types, so supply the numeric id directly.",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("The source configuration item ID"),
        relatedItemId: z
          .number()
          .int()
          .positive()
          .describe("The configuration item ID to relate to"),
        typeId: z
          .number()
          .int()
          .positive()
          .describe("Relationship type ID (required)"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        await handlers.addCIRelationship(
          args.ciId,
          args.relatedItemId,
          args.typeId,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Relationship added: configuration item #${args.ciId} related to #${args.relatedItemId} (type ${args.typeId}).`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_remove_relationship",
    {
      title: "Remove Configuration Item Relationship",
      description:
        "Remove a relationship from a configuration item by relationship ID (from tdx_cmdb_get_relationships).",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("The configuration item ID the relationship belongs to"),
        relationshipId: z
          .number()
          .int()
          .positive()
          .describe("The relationship ID to remove"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        await handlers.removeCIRelationship(args.ciId, args.relationshipId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Relationship #${args.relationshipId} removed from configuration item #${args.ciId}.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_cmdb_add_attachment",
    {
      title: "Add Configuration Item Attachment",
      description:
        "Upload a file attachment to a configuration item. Provide the file content as a base64-encoded string.",
      inputSchema: {
        ciId: z
          .number()
          .int()
          .positive()
          .describe("The configuration item ID to attach the file to"),
        fileName: z.string().describe("The name of the file (including extension)"),
        contentBase64: z
          .string()
          .describe("The file content, base64-encoded"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const file = Buffer.from(args.contentBase64, "base64");
        const attachment = await handlers.addCIAttachment(
          args.ciId,
          file,
          args.fileName,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Attachment #${attachment.ID} (${attachment.Name}) added to configuration item #${args.ciId}.`,
            },
          ],
        };
      });
    },
  );
}
