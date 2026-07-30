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
  return (exact ?? people[0])?.DefaultAccountID;
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
