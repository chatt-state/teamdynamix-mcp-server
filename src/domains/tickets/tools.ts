/**
 * MCP tool definitions for ticket operations.
 *
 * Defines the schemas and metadata for ticket-related MCP tools
 * such as searching, creating, and updating tickets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all ticket-related tools with the MCP server.
 * Tools follow the `tdx_tickets_*` naming convention.
 */
export function registerTicketTools(server: McpServer): void {
  server.registerTool(
    "tdx_tickets_search",
    {
      title: "Search Tickets",
      description:
        "Search TeamDynamix tickets. Returns summary data — use tdx_tickets_get for full details.",
      inputSchema: {
        appId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Ticketing app ID. Uses default if omitted."),
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across ticket fields"),
        statusIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by status IDs"),
        priorityIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by priority IDs"),
        typeIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by type IDs"),
        responsibilityUids: z
          .array(z.string())
          .optional()
          .describe("Filter by responsible person UIDs"),
        responsibilityGroupIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by responsible group IDs"),
        requestorUids: z
          .array(z.string())
          .optional()
          .describe("Filter by requestor UIDs"),
        createdDateFrom: z
          .string()
          .optional()
          .describe("ISO 8601 date — tickets created on or after"),
        createdDateTo: z
          .string()
          .optional()
          .describe("ISO 8601 date — tickets created on or before"),
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
          appId: args.appId,
          SearchText: args.searchText,
          StatusIDs: args.statusIds,
          PriorityIDs: args.priorityIds,
          TypeIDs: args.typeIds,
          ResponsibilityUids: args.responsibilityUids,
          ResponsibilityGroupIDs: args.responsibilityGroupIds,
          RequestorUids: args.requestorUids,
          CreatedDateFrom: args.createdDateFrom,
          CreatedDateTo: args.createdDateTo,
          MaxResults: args.maxResults,
        };
        const tickets = await handlers.searchTickets(searchParams);
        const summary = tickets
          .map(
            (t) =>
              `#${t.ID} [${t.StatusName}] ${t.Title} (${t.RequestorName ?? "Unknown"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                tickets.length === 0
                  ? "No tickets found matching the search criteria."
                  : `Found ${tickets.length} ticket(s):\n\n${summary}\n\nUse tdx_tickets_get for full details on any ticket.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_tickets_get",
    {
      title: "Get Ticket",
      description:
        "Get full ticket details by ID including description, custom attributes, and attachments.",
      inputSchema: {
        appId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Ticketing app ID. Uses default if omitted."),
        ticketId: z
          .number()
          .int()
          .positive()
          .describe("The ticket ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const ticket = await handlers.getTicket(args.ticketId, args.appId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(ticket, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_tickets_create",
    {
      title: "Create Ticket",
      description: "Create a new TeamDynamix ticket.",
      inputSchema: {
        appId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Ticketing app ID"),
        title: z.string().describe("Ticket title"),
        description: z
          .string()
          .optional()
          .describe("Ticket description (HTML supported)"),
        typeId: z.number().int().describe("Ticket type ID"),
        statusId: z.number().int().optional().describe("Status ID"),
        priorityId: z.number().int().optional().describe("Priority ID"),
        accountId: z
          .number()
          .int()
          .optional()
          .describe("Department/account ID"),
        requestorEmail: z
          .string()
          .optional()
          .describe("Requestor email address"),
        requestorUid: z.string().optional().describe("Requestor UID (Guid)"),
        responsibleUid: z
          .string()
          .optional()
          .describe("Responsible person UID"),
        responsibleGroupId: z
          .number()
          .int()
          .optional()
          .describe("Responsible group ID"),
        sourceId: z.number().int().optional().describe("Ticket source ID"),
        formId: z.number().int().optional().describe("Form ID"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const {
          appId,
          title,
          description,
          typeId,
          statusId,
          priorityId,
          accountId,
          requestorEmail,
          requestorUid,
          responsibleUid,
          responsibleGroupId,
          sourceId,
          formId,
        } = args;
        const ticketData: Record<string, unknown> = {
          Title: title,
          Description: description,
          TypeID: typeId,
          StatusID: statusId,
          PriorityID: priorityId,
          AccountID: accountId,
          RequestorEmail: requestorEmail,
          RequestorUid: requestorUid,
          ResponsibleUid: responsibleUid,
          ResponsibleGroupID: responsibleGroupId,
          SourceID: sourceId,
          FormID: formId,
        };
        // Remove undefined values so only provided fields are sent
        for (const key of Object.keys(ticketData)) {
          if (ticketData[key] === undefined) delete ticketData[key];
        }
        const ticket = await handlers.createTicket(ticketData, appId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Ticket #${ticket.ID} created: ${ticket.Title}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_tickets_update",
    {
      title: "Update Ticket",
      description: "Update an existing TeamDynamix ticket (full update).",
      inputSchema: {
        appId: z.number().int().positive().optional(),
        ticketId: z
          .number()
          .int()
          .positive()
          .describe("Ticket ID to update"),
        title: z.string().optional(),
        description: z.string().optional(),
        statusId: z.number().int().optional(),
        priorityId: z.number().int().optional(),
        typeId: z.number().int().optional(),
        responsibleUid: z.string().optional(),
        responsibleGroupId: z.number().int().optional(),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { appId, ticketId, ...fields } = args;
        const updateData: Record<string, unknown> = {};
        if (fields.title !== undefined) updateData.Title = fields.title;
        if (fields.description !== undefined)
          updateData.Description = fields.description;
        if (fields.statusId !== undefined)
          updateData.StatusID = fields.statusId;
        if (fields.priorityId !== undefined)
          updateData.PriorityID = fields.priorityId;
        if (fields.typeId !== undefined) updateData.TypeID = fields.typeId;
        if (fields.responsibleUid !== undefined)
          updateData.ResponsibleUid = fields.responsibleUid;
        if (fields.responsibleGroupId !== undefined)
          updateData.ResponsibleGroupID = fields.responsibleGroupId;
        const ticket = await handlers.updateTicket(ticketId, updateData, appId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Ticket #${ticket.ID} updated: ${ticket.Title}`,
            },
          ],
        };
      });
    },
  );
}
