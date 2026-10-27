/**
 * Handler implementations for ticket MCP tools.
 *
 * Contains the business logic that executes when ticket-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via the shared TdxClient and returns typed results.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Ticket,
  TicketSearch,
  TicketCreateParams,
  TicketUpdateParams,
  TicketType,
  TicketStatus,
  TicketPriority,
  FeedEntry,
  TicketFeedEntryParams,
  Attachment,
} from "@chatt-state/node-teamdynamix";

// Re-export for tool consumers that previously imported from this module.
export type { TicketFeedEntryParams };

/**
 * Searches for tickets matching the given parameters.
 */
export async function searchTickets(
  params: TicketSearch,
): Promise<Ticket[]> {
  return getTdxClient().tickets.search(params);
}

/** Retrieves a single ticket by its ID. */
export async function getTicket(ticketId: number): Promise<Ticket> {
  return getTdxClient().tickets.get(ticketId);
}

/** Creates a new ticket with the given data. */
export async function createTicket(
  ticket: TicketCreateParams,
): Promise<Ticket> {
  return getTdxClient().tickets.create(ticket);
}

/** Updates an existing ticket by posting updated fields. */
export async function updateTicket(
  ticketId: number,
  ticket: TicketUpdateParams,
): Promise<Ticket> {
  return getTdxClient().tickets.update(ticketId, ticket);
}

/** Retrieves the activity feed for a ticket. */
export async function getTicketFeed(ticketId: number): Promise<FeedEntry[]> {
  return getTdxClient().tickets.getFeed(ticketId);
}

/** Fetches all ticket types for the configured application. */
export async function getTicketTypes(): Promise<TicketType[]> {
  return getTdxClient().tickets.getTypes();
}

/** Fetches all ticket statuses for the configured application. */
export async function getTicketStatuses(): Promise<TicketStatus[]> {
  return getTdxClient().tickets.getStatuses();
}

/** Fetches all ticket priorities for the configured application. */
export async function getTicketPriorities(): Promise<TicketPriority[]> {
  return getTdxClient().tickets.getPriorities();
}

// ---------------------------------------------------------------------------
// Default resolvers for ticket creation.
//
// TDX requires TypeID, StatusID, PriorityID and a valid AccountID on create;
// sending 0 (the old fallback) yields "AccountId: 0 does not exist or is
// invalid" and the model can't discover the numeric ids (the lookups aren't
// tools and elicitation doesn't work through a stateless HTTP MCP client).
// These resolve sensible real defaults so create({title, description}) works.
// ---------------------------------------------------------------------------

/** Active default ticket type — prefers a name containing "default". */
export async function resolveDefaultTypeId(): Promise<number | undefined> {
  const types = (await getTicketTypes()).filter((t) => t.IsActive);
  if (types.length === 0) return undefined;
  return (types.find((t) => /default/i.test(t.Name)) ?? types[0]).ID;
}

/** Initial status — prefers "New"/"Open", else the lowest-Order active one. */
export async function resolveDefaultStatusId(): Promise<number | undefined> {
  const statuses = (await getTicketStatuses()).filter((s) => s.IsActive);
  if (statuses.length === 0) return undefined;
  const preferred =
    statuses.find((s) => /^(new|open)$/i.test(s.Name)) ??
    [...statuses].sort((a, b) => (a.Order ?? 9999) - (b.Order ?? 9999))[0];
  return preferred.ID;
}

/** Default priority — prefers "Medium"/"Normal", else the middle active one. */
export async function resolveDefaultPriorityId(): Promise<number | undefined> {
  const priorities = (await getTicketPriorities()).filter((p) => p.IsActive);
  if (priorities.length === 0) return undefined;
  const preferred =
    priorities.find((p) => /medium|normal/i.test(p.Name)) ??
    priorities[Math.floor(priorities.length / 2)];
  return preferred.ID;
}

/**
 * Resolve the requestor's TDX account (department) from their email — this is
 * the ticket's AccountID. Exact email match wins; otherwise the first active
 * result's default account.
 */
export async function resolveRequestorAccountId(email: string): Promise<number | undefined> {
  if (!email) return undefined;
  const people = await getTdxClient().people.search({
    SearchText: email,
    IsActive: true,
    MaxResults: 5,
  });
  const exact = people.find(
    (p) => (p.PrimaryEmail ?? "").toLowerCase() === email.toLowerCase(),
  );
  // TDX returns DefaultAccountID = 0 for people with no default account
  // (common for students, contacts, and newly-created users). Sending 0 as
  // the ticket AccountID 400s with "AccountId: 0 does not exist or is
  // invalid", so treat 0/falsy as unresolved rather than a usable value.
  const id = (exact ?? people[0])?.DefaultAccountID;
  return id && id > 0 ? id : undefined;
}

/**
 * Adds a new feed entry (comment) to a ticket.
 *
 * Accepts the full `TicketFeedEntryParams` shape from the library, which
 * mirrors the TDX `TicketFeedEntry` API type — supporting inline status
 * changes (`NewStatusID` / `CascadeStatus`), rich HTML bodies, communications
 * flags, and notification recipients in addition to the basic comment.
 */
export async function addTicketFeedEntry(
  ticketId: number,
  entry: TicketFeedEntryParams,
): Promise<FeedEntry> {
  return getTdxClient().tickets.addFeedEntry(ticketId, entry);
}

// ---------------------------------------------------------------------------
// Full-coverage reads/writes for related ticket resources.
// ---------------------------------------------------------------------------

/**
 * Retrieves the tasks (and activities) associated with a ticket. The TDX Web
 * API does not expose a typed shape here, so the result is left untyped and
 * the tool layer probes the common summary fields.
 */
export async function getTicketTasks(ticketId: number): Promise<unknown[]> {
  return getTdxClient().tickets.getTasks(ticketId);
}

/** Retrieves the additional contacts associated with a ticket (untyped by TDX). */
export async function getTicketContacts(ticketId: number): Promise<unknown[]> {
  return getTdxClient().tickets.getContacts(ticketId);
}

/** Adds an additional contact (by UID/Guid) to a ticket. */
export async function addTicketContact(
  ticketId: number,
  uid: string,
): Promise<void> {
  return getTdxClient().tickets.addContact(ticketId, uid);
}

/** Removes an additional contact (by UID/Guid) from a ticket. */
export async function removeTicketContact(
  ticketId: number,
  uid: string,
): Promise<void> {
  return getTdxClient().tickets.removeContact(ticketId, uid);
}

/** Retrieves attachment metadata for a ticket. */
export async function getTicketAttachments(
  ticketId: number,
): Promise<Attachment[]> {
  return getTdxClient().tickets.getAttachments(ticketId);
}

/** Uploads a file attachment (raw bytes) to a ticket. */
export async function addTicketAttachment(
  ticketId: number,
  file: Buffer,
  fileName: string,
): Promise<Attachment> {
  return getTdxClient().tickets.addAttachment(ticketId, file, fileName);
}

/** Adds a tag to a ticket. */
export async function addTicketTag(
  ticketId: number,
  tag: string,
): Promise<void> {
  return getTdxClient().tickets.addTag(ticketId, tag);
}
