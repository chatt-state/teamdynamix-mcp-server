/**
 * Handler implementations for ticket MCP tools.
 *
 * Contains the business logic that executes when ticket-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via tdxClient and returns typed results.
 */

import { tdxClient } from "../../http/client.js";
import { getConfig } from "../../config.js";
import type { TdxTicket, TdxFeedEntry, TicketSearchParams } from "./types.js";

/**
 * Resolves the ticketing app ID from an explicit value or the global config.
 * Throws if neither is available.
 */
function getAppId(providedAppId?: number): number {
  const appId = providedAppId ?? getConfig().ticketingAppId;
  if (appId === undefined) {
    throw new Error(
      "No ticketing app ID provided and TDX_TICKETING_APP_ID is not configured",
    );
  }
  return appId;
}

/**
 * Searches for tickets matching the given parameters.
 * The `appId` field on params is used for routing; the rest
 * is forwarded to the TDX search endpoint as the POST body.
 */
export async function searchTickets(
  params: TicketSearchParams & { appId?: number },
): Promise<TdxTicket[]> {
  const appId = getAppId(params.appId);
  const { appId: _, ...searchParams } = params;
  return tdxClient.post<TdxTicket[]>(`/${appId}/tickets/search`, searchParams);
}

/** Retrieves a single ticket by its ID. */
export async function getTicket(
  ticketId: number,
  appId?: number,
): Promise<TdxTicket> {
  return tdxClient.get<TdxTicket>(`/${getAppId(appId)}/tickets/${ticketId}`);
}

/** Creates a new ticket with the given data. */
export async function createTicket(
  ticket: Record<string, unknown>,
  appId?: number,
): Promise<TdxTicket> {
  return tdxClient.post<TdxTicket>(`/${getAppId(appId)}/tickets`, ticket);
}

/** Updates an existing ticket by posting updated fields. */
export async function updateTicket(
  ticketId: number,
  ticket: Record<string, unknown>,
  appId?: number,
): Promise<TdxTicket> {
  return tdxClient.post<TdxTicket>(
    `/${getAppId(appId)}/tickets/${ticketId}`,
    ticket,
  );
}

/** Retrieves the activity feed for a ticket. */
export async function getTicketFeed(
  ticketId: number,
  appId?: number,
): Promise<TdxFeedEntry[]> {
  return tdxClient.get<TdxFeedEntry[]>(
    `/${getAppId(appId)}/tickets/${ticketId}/feed`,
  );
}

/** Adds a new feed entry (comment) to a ticket. */
export async function addTicketFeedEntry(
  ticketId: number,
  entry: { Body: string; IsPrivate?: boolean },
  appId?: number,
): Promise<TdxFeedEntry> {
  return tdxClient.post<TdxFeedEntry>(
    `/${getAppId(appId)}/tickets/${ticketId}/feed`,
    entry,
  );
}
