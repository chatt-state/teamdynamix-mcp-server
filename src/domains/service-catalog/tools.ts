/**
 * MCP tool definitions for service catalog operations.
 *
 * Defines the schemas and metadata for service-catalog-related MCP tools
 * including services, service offerings, and service categories.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ServiceCreateParams,
  ServiceUpdateParams,
  ServiceOfferingCreateParams,
  ServiceOfferingUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import { elicitChoice } from "../../middleware/elicitation.js";
import * as handlers from "./handlers.js";

/**
 * Registers all service-catalog-related tools with the MCP server.
 * Tools follow the `tdx_services_*` naming convention.
 */
export function registerServiceCatalogTools(server: McpServer): void {
  server.registerTool(
    "tdx_services_search",
    {
      title: "Search Services",
      description:
        "Search the TeamDynamix service catalog. Returns summary data — use tdx_services_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across service fields"),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active/inactive status"),
        categoryIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by category IDs"),
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
        const services = await handlers.searchServices({
          SearchText: args.searchText,
          IsActive: args.isActive,
          CategoryIDs: args.categoryIds,
          MaxResults: args.maxResults,
        });
        const summary = services
          .map(
            (s) =>
              `#${s.ID} [${s.IsActive ? "Active" : "Inactive"}] ${s.Name} (${s.CategoryName ?? "Uncategorized"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                services.length === 0
                  ? "No services found matching the search criteria."
                  : `Found ${services.length} service(s):\n\n${summary}\n\nUse tdx_services_get for full details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_get",
    {
      title: "Get Service",
      description:
        "Get full service details by ID including description and category.",
      inputSchema: {
        serviceId: z
          .number()
          .int()
          .positive()
          .describe("The service ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const service = await handlers.getService(args.serviceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(service, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_create",
    {
      title: "Create Service",
      description: "Create a new service in the TeamDynamix service catalog.",
      inputSchema: {
        name: z.string().describe("Service name"),
        description: z.string().optional().describe("Service description"),
        categoryId: z
          .number()
          .int()
          .optional()
          .describe("Category ID — omit to select interactively"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the service is active (default: true)"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        let resolvedCategoryId = args.categoryId;
        if (resolvedCategoryId === undefined) {
          const categories = await handlers.getCategories();
          if (categories.length > 0) {
            const selected = await elicitChoice(
              "Select a category for the new service:",
              "categoryId",
              "Service Category",
              categories.map((c) => ({ id: c.ID, name: c.Name })),
            );
            if (selected !== null) {
              resolvedCategoryId = selected;
            }
          }
        }
        const data: ServiceCreateParams = {
          Name: args.name,
          Description: args.description,
          CategoryID: resolvedCategoryId,
          IsActive: args.isActive ?? true,
        };
        const service = await handlers.createService(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Service #${service.ID} created: ${service.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_update",
    {
      title: "Update Service",
      description: "Update an existing service in the service catalog.",
      inputSchema: {
        serviceId: z
          .number()
          .int()
          .positive()
          .describe("Service ID to update"),
        name: z.string().optional().describe("Updated name"),
        description: z.string().optional().describe("Updated description"),
        categoryId: z.number().int().optional().describe("Updated category ID"),
        isActive: z.boolean().optional().describe("Updated active status"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { serviceId, ...fields } = args;
        const data: ServiceUpdateParams = {};
        if (fields.name !== undefined) data.Name = fields.name;
        if (fields.description !== undefined)
          data.Description = fields.description;
        if (fields.categoryId !== undefined) data.CategoryID = fields.categoryId;
        if (fields.isActive !== undefined) data.IsActive = fields.isActive;
        const service = await handlers.updateService(serviceId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Service #${service.ID} updated: ${service.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_search_offerings",
    {
      title: "Search Service Offerings",
      description:
        "Search offerings within a service. Returns summary data — use tdx_services_get_offering for full details.",
      inputSchema: {
        serviceId: z
          .number()
          .int()
          .positive()
          .describe("The parent service ID"),
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across offering fields"),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active/inactive status"),
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
        const offerings = await handlers.searchOfferings(args.serviceId, {
          SearchText: args.searchText,
          IsActive: args.isActive,
          MaxResults: args.maxResults,
        });
        const summary = offerings
          .map(
            (o) =>
              `#${o.ID} [${o.IsActive ? "Active" : "Inactive"}] ${o.Name}`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                offerings.length === 0
                  ? "No offerings found matching the search criteria."
                  : `Found ${offerings.length} offering(s):\n\n${summary}\n\nUse tdx_services_get_offering for full details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_get_offering",
    {
      title: "Get Service Offering",
      description: "Get full offering details by ID.",
      inputSchema: {
        serviceId: z
          .number()
          .int()
          .positive()
          .describe("The parent service ID"),
        offeringId: z
          .number()
          .int()
          .positive()
          .describe("The offering ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const offering = await handlers.getOffering(
          args.serviceId,
          args.offeringId,
        );
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(offering, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_create_offering",
    {
      title: "Create Service Offering",
      description: "Create a new offering within a service.",
      inputSchema: {
        serviceId: z
          .number()
          .int()
          .positive()
          .describe("The parent service ID"),
        name: z.string().describe("Offering name"),
        description: z.string().optional().describe("Offering description"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the offering is active (default: true)"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const data: ServiceOfferingCreateParams = {
          Name: args.name,
          ServiceID: args.serviceId,
          Description: args.description,
          IsActive: args.isActive ?? true,
        };
        const offering = await handlers.createOffering(args.serviceId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Offering #${offering.ID} created: ${offering.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_update_offering",
    {
      title: "Update Service Offering",
      description: "Update an existing offering within a service.",
      inputSchema: {
        serviceId: z
          .number()
          .int()
          .positive()
          .describe("The parent service ID"),
        offeringId: z
          .number()
          .int()
          .positive()
          .describe("Offering ID to update"),
        name: z.string().optional().describe("Updated name"),
        description: z.string().optional().describe("Updated description"),
        isActive: z.boolean().optional().describe("Updated active status"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { serviceId, offeringId, ...fields } = args;
        const data: ServiceOfferingUpdateParams = {};
        if (fields.name !== undefined) data.Name = fields.name;
        if (fields.description !== undefined)
          data.Description = fields.description;
        if (fields.isActive !== undefined) data.IsActive = fields.isActive;
        const offering = await handlers.updateOffering(
          serviceId,
          offeringId,
          data,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Offering #${offering.ID} updated: ${offering.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_services_get_categories",
    {
      title: "Get Service Categories",
      description: "List all service categories in the service catalog.",
    },
    async () => {
      return wrapToolHandler(async () => {
        const categories = await handlers.getCategories();
        const summary = categories
          .map((c) => `#${c.ID} ${c.Name} (order: ${c.Order})`)
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                categories.length === 0
                  ? "No service categories found."
                  : `Found ${categories.length} category/categories:\n\n${summary}`,
            },
          ],
        };
      });
    },
  );
}
