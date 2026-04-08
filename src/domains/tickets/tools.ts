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
import { elicitChoice } from "../../middleware/elicitation.js";
import * as handlers from "./handlers.js";
import type { TicketFeedEntryParams } from "./handlers.js";

/**
 * Builds the mandatory attribution header prepended to every MCP-originated
 * ticket reply. The service account in TDX is "Chatt State Service Desk
 * Assistant" — the CreatedBy field will always show that account, so we
 * surface the real human user in the comment body itself. This is the only
 * available path because TDX does not support per-user impersonation or
 * programmatic SSO auth.
 */
function buildAttributionHeader(
  fullName: string,
  email: string,
): string {
  return `[Reply from ${fullName} <${email}> via Service Desk Assistant]\n\n`;
}

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
        typeId: z
          .number()
          .int()
          .optional()
          .describe("Ticket type ID — omit to select interactively"),
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
        let resolvedTypeId: number;
        if (args.typeId !== undefined) {
          resolvedTypeId = args.typeId;
        } else {
          const types = await handlers.getTicketTypes();
          const selected = await elicitChoice(
            "Select a ticket type:",
            "typeId",
            "Ticket Type",
            types.map((t) => ({ id: t.ID, name: t.Name })),
          );
          if (selected === null) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Ticket type selection is required. Provide typeId or try again.",
                },
              ],
              isError: true as const,
            };
          }
          resolvedTypeId = selected;
        }
        const {
          title,
          description,
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
          TypeID: resolvedTypeId,
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

  server.registerTool(
    "tdx_tickets_reply",
    {
      title: "Reply to Ticket",
      description:
        "Add a reply (feed entry) to a TeamDynamix ticket, optionally changing " +
        "status and/or reassigning responsibility in the same operation. " +
        "\n\n" +
        "IMPORTANT — ATTRIBUTION: All replies are posted via the 'Chatt State " +
        "Service Desk Assistant' service account because TDX does not support " +
        "per-user API impersonation. You MUST provide the real name and email " +
        "of the user requesting this reply. NEVER invent, guess, or use " +
        "placeholder values for these fields. If you do not know who is making " +
        "the reply, stop and ask the user before calling this tool. The " +
        "attribution will be prepended to the comment body so the actual " +
        "author is recorded in the ticket history." +
        "\n\n" +
        "Reassignment (responsibleUid / responsibleGroupId) requires a comment " +
        "so there is always a human-attributable audit trail for the change.",
      inputSchema: {
        ticketId: z
          .number()
          .int()
          .positive()
          .describe("Ticket ID to reply to"),
        comment: z
          .string()
          .min(1, "comment must not be empty")
          .describe(
            "The reply text. Treated as plain text unless isRichHtml is true.",
          ),
        actingUserFullName: z
          .string()
          .min(1, "actingUserFullName must not be empty")
          .describe(
            "REQUIRED. Full name of the real user making this reply " +
              "(e.g., 'Aaron Sachs'). Never fabricate or guess.",
          ),
        actingUserEmail: z
          .string()
          .email("actingUserEmail must be a valid email address")
          .describe(
            "REQUIRED. Email address of the real user making this reply. " +
              "Never fabricate or guess.",
          ),
        isPrivate: z
          .boolean()
          .optional()
          .describe(
            "If true, the reply is visible only to support staff (default: false).",
          ),
        isRichHtml: z
          .boolean()
          .optional()
          .describe(
            "If true, the comment body is treated as rich HTML. Default: false (plain text).",
          ),
        notifyEmails: z
          .array(z.string().email())
          .optional()
          .describe(
            "Additional email addresses to notify about this reply.",
          ),
        newStatusId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "If provided, change the ticket's status as part of this reply.",
          ),
        cascadeStatus: z
          .boolean()
          .optional()
          .describe(
            "If changing status, cascade the change to child tickets. Default: false.",
          ),
        responsibleUid: z
          .string()
          .optional()
          .describe(
            "If provided, reassign the ticket to this user (UID/Guid). " +
              "Use tdx_people_search to look up UIDs.",
          ),
        responsibleGroupId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "If provided, reassign the ticket to this responsible group.",
          ),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const {
          ticketId,
          comment,
          actingUserFullName,
          actingUserEmail,
          isPrivate,
          isRichHtml,
          notifyEmails,
          newStatusId,
          cascadeStatus,
          responsibleUid,
          responsibleGroupId,
        } = args;

        const reassigning =
          responsibleUid !== undefined || responsibleGroupId !== undefined;

        // Step 1: Apply reassignment as a separate update call if requested.
        // The TDX feed endpoint does not accept responsibility changes, so
        // this must be a prior ticket update. On failure, we surface the
        // error before attempting the feed entry so callers can retry cleanly.
        if (reassigning) {
          const updateData: TicketUpdateParams = {};
          if (responsibleUid !== undefined)
            updateData.ResponsibleUid = responsibleUid;
          if (responsibleGroupId !== undefined)
            updateData.ResponsibleGroupID = responsibleGroupId;
          await handlers.updateTicket(ticketId, updateData);
        }

        // Step 2: Build the attributed comment body. The attribution header
        // is always plain-text; if the caller supplied HTML, we prepend the
        // header as-is (TDX's rich editor renders plain text inside HTML
        // blocks correctly).
        const header = buildAttributionHeader(
          actingUserFullName,
          actingUserEmail,
        );
        const reassignmentNote = reassigning
          ? `\n\n[Reassigned via Service Desk Assistant${
              responsibleUid !== undefined
                ? ` to user UID ${responsibleUid}`
                : ""
            }${
              responsibleGroupId !== undefined
                ? ` to group ID ${responsibleGroupId}`
                : ""
            }]`
          : "";
        const attributedBody = header + comment + reassignmentNote;

        // Step 3: Post the feed entry with optional status change.
        const feedParams: TicketFeedEntryParams = {
          Comments: attributedBody,
          IsPrivate: isPrivate ?? false,
          IsRichHtml: isRichHtml ?? false,
        };
        if (newStatusId !== undefined) feedParams.NewStatusID = newStatusId;
        if (cascadeStatus !== undefined)
          feedParams.CascadeStatus = cascadeStatus;
        if (notifyEmails !== undefined && notifyEmails.length > 0)
          feedParams.Notify = notifyEmails;

        const entry = await handlers.addTicketFeedEntry(ticketId, feedParams);

        const actions: string[] = [`replied on behalf of ${actingUserFullName}`];
        if (newStatusId !== undefined)
          actions.push(`status changed to ID ${newStatusId}`);
        if (reassigning) actions.push("reassigned");

        return {
          content: [
            {
              type: "text" as const,
              text: `Ticket #${ticketId}: ${actions.join(", ")}. Feed entry #${entry.ID} posted.`,
            },
          ],
        };
      });
    },
  );
}
