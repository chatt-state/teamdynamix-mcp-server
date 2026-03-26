/**
 * MCP tool definitions for time entry operations.
 *
 * Defines the schemas and metadata for time-related MCP tools.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  TimeEntryCreateParams,
  TimeEntryUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import { elicitChoice } from "../../middleware/elicitation.js";
import * as handlers from "./handlers.js";

/**
 * Registers all time-entry-related tools with the MCP server.
 * Tools follow the `tdx_time_*` naming convention.
 */
export function registerTimeTools(server: McpServer): void {
  server.registerTool(
    "tdx_time_search",
    {
      title: "Search Time Entries",
      description:
        "Search TeamDynamix time entries. Returns summary data — use tdx_time_get for full details.",
      inputSchema: {
        startDate: z
          .string()
          .optional()
          .describe("Start date filter (ISO 8601)"),
        endDate: z
          .string()
          .optional()
          .describe("End date filter (ISO 8601)"),
        resourceIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by resource (person) IDs"),
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
        const entries = await handlers.searchTimeEntries({
          StartDate: args.startDate,
          EndDate: args.endDate,
          ResourceIDs: args.resourceIds,
          MaxResults: args.maxResults,
        });
        const summary = entries
          .map(
            (e) =>
              `#${e.ID} ${e.Date} ${e.HoursWorked}h — ${e.ResourceName ?? "Unknown"} (${e.TimeTypeName ?? "Unknown type"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                entries.length === 0
                  ? "No time entries found matching the search criteria."
                  : `Found ${entries.length} time entry/entries:\n\n${summary}\n\nUse tdx_time_get for full details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_time_get",
    {
      title: "Get Time Entry",
      description: "Get full time entry details by ID.",
      inputSchema: {
        timeEntryId: z
          .number()
          .int()
          .positive()
          .describe("The time entry ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const entry = await handlers.getTimeEntry(args.timeEntryId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(entry, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_time_create",
    {
      title: "Create Time Entry",
      description: "Log a new time entry against a ticket, project, or task.",
      inputSchema: {
        timeTypeId: z
          .number()
          .int()
          .optional()
          .describe("Time type ID — omit to select interactively"),
        date: z.string().describe("Date of the work (ISO 8601)"),
        hoursWorked: z
          .number()
          .positive()
          .describe("Number of hours worked"),
        description: z
          .string()
          .optional()
          .describe("Description of work performed"),
        ticketId: z
          .number()
          .int()
          .optional()
          .describe("Ticket ID to log time against"),
        projectId: z
          .number()
          .int()
          .optional()
          .describe("Project ID to log time against"),
        taskId: z
          .number()
          .int()
          .optional()
          .describe("Task ID to log time against"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        let resolvedTypeId: number;
        if (args.timeTypeId !== undefined) {
          resolvedTypeId = args.timeTypeId;
        } else {
          const types = await handlers.getTimeTypes();
          const selected = await elicitChoice(
            "Select a time type:",
            "timeTypeId",
            "Time Type",
            types.map((t) => ({ id: t.ID, name: t.Name })),
          );
          if (selected === null) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Time type selection is required. Provide timeTypeId or try again.",
                },
              ],
              isError: true as const,
            };
          }
          resolvedTypeId = selected;
        }
        const data: TimeEntryCreateParams = {
          TimeTypeID: resolvedTypeId,
          Date: args.date,
          HoursWorked: args.hoursWorked,
          Description: args.description,
          TicketID: args.ticketId,
          ProjectID: args.projectId,
          TaskID: args.taskId,
        };
        const entry = await handlers.createTimeEntry(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Time entry #${entry.ID} created: ${entry.HoursWorked}h on ${entry.Date}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_time_update",
    {
      title: "Update Time Entry",
      description: "Update an existing time entry.",
      inputSchema: {
        timeEntryId: z
          .number()
          .int()
          .positive()
          .describe("Time entry ID to update"),
        date: z.string().optional().describe("Updated date"),
        hoursWorked: z.number().positive().optional().describe("Updated hours"),
        description: z
          .string()
          .optional()
          .describe("Updated description"),
        timeTypeId: z
          .number()
          .int()
          .optional()
          .describe("Updated time type ID"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { timeEntryId, ...fields } = args;
        const data: TimeEntryUpdateParams = {};
        if (fields.date !== undefined) data.Date = fields.date;
        if (fields.hoursWorked !== undefined)
          data.HoursWorked = fields.hoursWorked;
        if (fields.description !== undefined)
          data.Description = fields.description;
        if (fields.timeTypeId !== undefined)
          data.TimeTypeID = fields.timeTypeId;
        const entry = await handlers.updateTimeEntry(timeEntryId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Time entry #${entry.ID} updated: ${entry.HoursWorked}h on ${entry.Date}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_time_delete",
    {
      title: "Delete Time Entry",
      description: "Delete a time entry by ID.",
      inputSchema: {
        timeEntryId: z
          .number()
          .int()
          .positive()
          .describe("Time entry ID to delete"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        await handlers.deleteTimeEntry(args.timeEntryId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Time entry #${args.timeEntryId} deleted.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_time_get_types",
    {
      title: "Get Time Types",
      description: "List all available time types for time entry logging.",
    },
    async () => {
      return wrapToolHandler(async () => {
        const types = await handlers.getTimeTypes();
        const summary = types
          .map(
            (t) =>
              `#${t.ID} ${t.Name} (${t.IsActive ? "Active" : "Inactive"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                types.length === 0
                  ? "No time types found."
                  : `Found ${types.length} time type(s):\n\n${summary}`,
            },
          ],
        };
      });
    },
  );
}
