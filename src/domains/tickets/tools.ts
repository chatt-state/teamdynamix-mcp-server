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
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import * as handlers from "./handlers.js";
import type { TicketFeedEntryParams } from "./handlers.js";

/**
 * Builds the mandatory attribution header prepended to every MCP-originated
 * ticket reply. The service account in TDX is "Chatt State Service Desk
 * Assistant" — the CreatedBy field will always show that account, so we
 * surface the real human user in the comment body itself. This is the only
 * available path because TDX does not support per-user impersonation or
 * programmatic SSO auth.
 *
 * `verified` marks identities proven cryptographically (X-Portal-User) vs
 * supplied by the model, so ticket history records which trust level applied.
 */
function buildAttributionHeader(
  fullName: string,
  email: string,
  verified: boolean,
): string {
  const suffix = verified ? " — identity verified by AI Portal" : "";
  return `[Reply from ${fullName} <${email}> via Service Desk Assistant${suffix}]\n\n`;
}

/**
 * Registers all ticket-related tools with the MCP server.
 * Tools follow the `tdx_tickets_*` naming convention.
 *
 * `identity` is the verified portal user (X-Portal-User header) or null.
 * When present it is authoritative for attribution: tickets_reply ignores
 * the model-supplied actingUser* arguments, and tickets_create defaults the
 * requestor to the verified user and records them as the filer.
 */
export function registerTicketTools(
  server: McpServer,
  identity: PortalIdentity | null = null,
): void {
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
      description: identity
        ? `Create a new TeamDynamix ticket. The requestor defaults to the ` +
          `verified portal user (${identity.name}); pass requestorEmail/` +
          `requestorUid only when filing on behalf of someone else.`
        : "Create a new TeamDynamix ticket.",
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

        // Verified-identity attribution: TDX's CreatedBy is always the API
        // service account (no impersonation exists), so the requestor and a
        // filer note in the description are how the real human is recorded.
        // Default the requestor to the verified user when the model did not
        // name one explicitly (explicit values stay honored — staff filing
        // on someone's behalf is legitimate).
        const effectiveRequestorEmail =
          identity && !requestorEmail && !requestorUid
            ? identity.email
            : requestorEmail;
        const filedByNote = identity
          ? `\n\n[Filed by ${identity.name} <${identity.email}> via AI Portal — identity verified]`
          : "";

        // Resolve the four TDX-required numeric ids the model can't discover.
        // Each is used verbatim when supplied, else defaulted; sending 0 (the
        // old behavior) 400s with "AccountId: 0 ... invalid".
        const [resolvedTypeId, resolvedStatusId, resolvedPriorityId] = await Promise.all([
          args.typeId !== undefined ? Promise.resolve(args.typeId) : handlers.resolveDefaultTypeId(),
          statusId !== undefined ? Promise.resolve(statusId) : handlers.resolveDefaultStatusId(),
          priorityId !== undefined ? Promise.resolve(priorityId) : handlers.resolveDefaultPriorityId(),
        ]);
        // AccountID is the requestor's department — derive it from the
        // requestor's email when not supplied explicitly.
        const resolvedAccountId =
          accountId ??
          (effectiveRequestorEmail
            ? await handlers.resolveRequestorAccountId(effectiveRequestorEmail)
            : undefined);

        const missing: string[] = [];
        if (resolvedTypeId === undefined) missing.push("typeId (no active ticket types found)");
        if (resolvedStatusId === undefined) missing.push("statusId (no active statuses found)");
        if (resolvedPriorityId === undefined) missing.push("priorityId (no active priorities found)");
        if (resolvedAccountId === undefined) {
          missing.push(
            effectiveRequestorEmail
              ? `accountId (couldn't resolve a department for ${effectiveRequestorEmail} — pass accountId, or a requestorEmail that matches a TDX person)`
              : "accountId or requestorEmail (needed to determine the ticket's department)",
          );
        }
        if (missing.length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not create the ticket — unresolved required field(s): ${missing.join("; ")}.`,
              },
            ],
            isError: true as const,
          };
        }

        // Build with only real values — never send 0/"" for optional fields.
        const ticketData: TicketCreateParams = {
          Title: title,
          TypeID: resolvedTypeId!,
          AccountID: resolvedAccountId!,
          StatusID: resolvedStatusId!,
          PriorityID: resolvedPriorityId!,
          // Required by TDX; empty is fine — it then matches on RequestorEmail.
          RequestorUid: requestorUid ?? "",
          Description: description ? description + filedByNote : filedByNote || undefined,
        };
        if (effectiveRequestorEmail) ticketData.RequestorEmail = effectiveRequestorEmail;
        if (responsibleUid) ticketData.ResponsibleUid = responsibleUid;
        if (responsibleGroupId) ticketData.ResponsibleGroupID = responsibleGroupId;
        if (sourceId) ticketData.SourceID = sourceId;
        if (formId) ticketData.FormID = formId;

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
      description: identity
        ? "Add a reply (feed entry) to a TeamDynamix ticket, optionally changing " +
          "status and/or reassigning responsibility in the same operation. " +
          "\n\n" +
          `ATTRIBUTION: replies are attributed to the verified portal user ` +
          `(${identity.name}) automatically — do NOT pass actingUserFullName/` +
          `actingUserEmail, they are ignored. Replies post via the service ` +
          `account because TDX does not support per-user API impersonation.` +
          "\n\n" +
          "Reassignment (responsibleUid / responsibleGroupId) requires a comment " +
          "so there is always a human-attributable audit trail for the change."
        : "Add a reply (feed entry) to a TeamDynamix ticket, optionally changing " +
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
        // Optional at the schema level; the handler enforces presence when no
        // verified portal identity exists (a conditional zod shape would give
        // this tool two different arg types, which the SDK's inference hates).
        actingUserFullName: z
          .string()
          .optional()
          .describe(
            identity
              ? "IGNORED — attribution comes from the verified portal identity."
              : "REQUIRED. Full name of the real user making this reply " +
                  "(e.g., 'Aaron Sachs'). Never fabricate or guess.",
          ),
        actingUserEmail: z
          .string()
          .optional()
          .describe(
            identity
              ? "IGNORED — attribution comes from the verified portal identity."
              : "REQUIRED. Email address of the real user making this reply. " +
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

        // Resolve attribution: verified portal identity is authoritative and
        // model-supplied values are ignored when it exists (spoof-proof).
        // Without it, the model MUST have supplied both fields.
        const attributedName = identity?.name ?? actingUserFullName;
        const attributedEmail = identity?.email ?? actingUserEmail;
        if (!attributedName || !attributedEmail) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  "actingUserFullName and actingUserEmail are required: provide the " +
                  "real name and email of the user making this reply (never guess).",
              },
            ],
            isError: true as const,
          };
        }

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
          attributedName,
          attributedEmail,
          identity !== null,
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

        const actions: string[] = [`replied on behalf of ${attributedName}`];
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
