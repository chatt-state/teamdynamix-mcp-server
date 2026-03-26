/**
 * MCP tool definitions for custom attribute operations.
 *
 * Defines the schemas and metadata for attribute-related MCP tools
 * including listing attributes and managing picklist choices.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AttributeChoiceCreateParams,
  AttributeChoiceUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all attribute-related tools with the MCP server.
 * Tools follow the `tdx_attributes_*` naming convention.
 */
export function registerAttributeTools(server: McpServer): void {
  server.registerTool(
    "tdx_attributes_list",
    {
      title: "List Custom Attributes",
      description:
        "List custom attribute definitions for a component. Common component IDs: " +
        "Ticket=9, Asset=27, CI=63, Project=12, Opportunity=35, Person=40.",
      inputSchema: {
        componentId: z
          .number()
          .int()
          .positive()
          .describe(
            "Component ID (e.g., 9=Ticket, 27=Asset, 63=CI, 12=Project, 40=Person)",
          ),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const attrs = await handlers.listAttributes(args.componentId);
        const summary = attrs
          .map(
            (a) =>
              `#${a.ID} ${a.Name} [${a.FieldType}] (${a.IsActive ? "Active" : "Inactive"}${a.IsRequired ? ", Required" : ""})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                attrs.length === 0
                  ? "No custom attributes found for this component."
                  : `Found ${attrs.length} custom attribute(s):\n\n${summary}\n\nUse tdx_attributes_get_choices to see picklist options for any attribute.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_attributes_get_choices",
    {
      title: "Get Attribute Choices",
      description:
        "Get the picklist choices for a custom attribute. Only applicable to dropdown/choice-type attributes.",
      inputSchema: {
        attributeId: z
          .number()
          .int()
          .positive()
          .describe("The attribute ID to get choices for"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const choices = await handlers.getChoices(args.attributeId);
        const summary = choices
          .map(
            (c) =>
              `#${c.ID} ${c.Name} (order: ${c.Order}, ${c.IsActive ? "Active" : "Inactive"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                choices.length === 0
                  ? "No choices found for this attribute (may not be a choice-type attribute)."
                  : `Found ${choices.length} choice(s):\n\n${summary}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_attributes_create_choice",
    {
      title: "Create Attribute Choice",
      description: "Add a new picklist choice to a custom attribute.",
      inputSchema: {
        attributeId: z
          .number()
          .int()
          .positive()
          .describe("The attribute ID to add the choice to"),
        name: z.string().describe("Choice display name"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the choice is active (default: true)"),
        order: z
          .number()
          .int()
          .optional()
          .describe("Sort order for the choice"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const data: AttributeChoiceCreateParams = {
          Name: args.name,
          IsActive: args.isActive ?? true,
          Order: args.order,
        };
        const choice = await handlers.createChoice(args.attributeId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Choice #${choice.ID} created: ${choice.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_attributes_update_choice",
    {
      title: "Update Attribute Choice",
      description: "Update an existing picklist choice on a custom attribute.",
      inputSchema: {
        attributeId: z
          .number()
          .int()
          .positive()
          .describe("The attribute ID"),
        choiceId: z
          .number()
          .int()
          .positive()
          .describe("The choice ID to update"),
        name: z.string().optional().describe("Updated display name"),
        isActive: z.boolean().optional().describe("Updated active status"),
        order: z.number().int().optional().describe("Updated sort order"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { attributeId, choiceId, ...fields } = args;
        const data: AttributeChoiceUpdateParams = {};
        if (fields.name !== undefined) data.Name = fields.name;
        if (fields.isActive !== undefined) data.IsActive = fields.isActive;
        if (fields.order !== undefined) data.Order = fields.order;
        const choice = await handlers.updateChoice(
          attributeId,
          choiceId,
          data,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Choice #${choice.ID} updated: ${choice.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_attributes_delete_choice",
    {
      title: "Delete Attribute Choice",
      description: "Remove a picklist choice from a custom attribute.",
      inputSchema: {
        attributeId: z
          .number()
          .int()
          .positive()
          .describe("The attribute ID"),
        choiceId: z
          .number()
          .int()
          .positive()
          .describe("The choice ID to delete"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        await handlers.deleteChoice(args.attributeId, args.choiceId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Choice #${args.choiceId} deleted from attribute #${args.attributeId}.`,
            },
          ],
        };
      });
    },
  );
}
