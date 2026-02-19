/**
 * MCP tool definitions for ticket operations.
 *
 * Defines the schemas and metadata for ticket-related MCP tools
 * such as searching, creating, and updating tickets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TicketCreateParams, TicketUpdateParams } from "@chatt-state/node-teamdynamix";
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
        responsibilityGroupIds: z
          .array(z.number().int())
          .optional()
          .describe("Filter by responsible group IDs"),
        requestorUids: z
          .array(z.string())
          .optional()
          .describe("Filter by requestor UIDs"),
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
          PriorityIDs: args.priorityIds,
          TypeIDs: args.typeIds,
          ResponsibleGroupIDs: args.responsibilityGroupIds,
          RequestorUids: args.requestorUids,
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
        ticketId: z
          .number()
          .int()
          .positive()
          .describe("The ticket ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const ticket = await handlers.getTicket(args.ticketId);
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
        const ticketData: TicketCreateParams = {
          Title: title,
          TypeID: typeId,
          AccountID: accountId ?? 0,
          StatusID: statusId ?? 0,
          PriorityID: priorityId ?? 0,
          RequestorUid: requestorUid ?? "",
          Description: description,
          RequestorEmail: requestorEmail,
          ResponsibleUid: responsibleUid,
          ResponsibleGroupID: responsibleGroupId,
          SourceID: sourceId,
          FormID: formId,
        };
        const ticket = await handlers.createTicket(ticketData);
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
        const { ticketId, ...fields } = args;
        const updateData: TicketUpdateParams = {};
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
        const ticket = await handlers.updateTicket(ticketId, updateData);
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
