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
} from "@chatt-state/node-teamdynamix";

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

/**
 * Parameters accepted by the TDX ticket feed POST endpoint.
 *
 * The underlying `@chatt-state/node-teamdynamix` library currently types
 * `addFeedEntry`'s input as `{Comments, IsPrivate}` only, but the TDX API
 * actually accepts the full `TicketFeedEntry` shape. This local type widens
 * the contract so the reply tool can pass status changes, notifications,
 * rich HTML, and communication flags. The library's runtime POSTs the entire
 * object unchanged, so extra fields are forwarded to TDX correctly.
 *
 * TODO: Submit upstream PR to widen the library's `addFeedEntry` signature,
 * then remove the cast in `addTicketFeedEntry` below.
 */
export interface TicketFeedEntryParams {
  Comments: string;
  IsPrivate?: boolean;
  IsRichHtml?: boolean;
  IsCommunication?: boolean;
  NewStatusID?: number;
  CascadeStatus?: boolean;
  Notify?: string[];
}

/** Adds a new feed entry (comment) to a ticket. */
export async function addTicketFeedEntry(
  ticketId: number,
  entry: TicketFeedEntryParams,
): Promise<FeedEntry> {
  // Library's declared type is narrower than what TDX accepts. The runtime
  // POSTs the entry object unchanged, so widening via cast is safe until the
  // upstream type is fixed.
  return getTdxClient().tickets.addFeedEntry(
    ticketId,
    entry as unknown as { Comments: string; IsPrivate?: boolean },
  );
}
