/**
 * MCP tool definitions for project operations.
 *
 * Defines the schemas and metadata for project-related MCP tools.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ProjectCreateParams,
  ProjectUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all project-related tools with the MCP server.
 * Tools follow the `tdx_projects_*` naming convention.
 */
export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    "tdx_projects_search",
    {
      title: "Search Projects",
      description:
        "Search TeamDynamix projects. Returns summary data — use tdx_projects_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across project fields"),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active/inactive status"),
        accountIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by account/department IDs"),
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
        const projects = await handlers.searchProjects({
          SearchText: args.searchText,
          IsActive: args.isActive,
          AccountIDs: args.accountIds,
          MaxResults: args.maxResults,
        });
        const summary = projects
          .map(
            (p) =>
              `#${p.ID} [${p.StatusName ?? "Unknown"}] ${p.Name} (${p.IsActive ? "Active" : "Inactive"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                projects.length === 0
                  ? "No projects found matching the search criteria."
                  : `Found ${projects.length} project(s):\n\n${summary}\n\nUse tdx_projects_get for full details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_projects_get",
    {
      title: "Get Project",
      description:
        "Get full project details by ID including dates, budget, and status.",
      inputSchema: {
        projectId: z
          .number()
          .int()
          .positive()
          .describe("The project ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const project = await handlers.getProject(args.projectId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(project, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_projects_create",
    {
      title: "Create Project",
      description: "Create a new TeamDynamix project.",
      inputSchema: {
        name: z.string().describe("Project name"),
        accountId: z
          .number()
          .int()
          .describe("Account/department ID that owns the project"),
        description: z.string().optional().describe("Project description"),
        startDate: z
          .string()
          .optional()
          .describe("Start date (ISO 8601 format)"),
        endDate: z
          .string()
          .optional()
          .describe("End date (ISO 8601 format)"),
        budget: z.number().optional().describe("Project budget"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const data: ProjectCreateParams = {
          Name: args.name,
          AccountID: args.accountId,
          Description: args.description,
          StartDate: args.startDate,
          EndDate: args.endDate,
          Budget: args.budget,
        };
        const project = await handlers.createProject(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Project #${project.ID} created: ${project.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_projects_update",
    {
      title: "Update Project",
      description: "Update an existing TeamDynamix project.",
      inputSchema: {
        projectId: z
          .number()
          .int()
          .positive()
          .describe("Project ID to update"),
        name: z.string().optional().describe("Updated name"),
        description: z.string().optional().describe("Updated description"),
        startDate: z.string().optional().describe("Updated start date"),
        endDate: z.string().optional().describe("Updated end date"),
        budget: z.number().optional().describe("Updated budget"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { projectId, ...fields } = args;
        const data: ProjectUpdateParams = {};
        if (fields.name !== undefined) data.Name = fields.name;
        if (fields.description !== undefined)
          data.Description = fields.description;
        if (fields.startDate !== undefined) data.StartDate = fields.startDate;
        if (fields.endDate !== undefined) data.EndDate = fields.endDate;
        if (fields.budget !== undefined) data.Budget = fields.budget;
        const project = await handlers.updateProject(projectId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Project #${project.ID} updated: ${project.Name}`,
            },
          ],
        };
      });
    },
  );
}
