/**
 * Handler implementations for people MCP tools.
 *
 * Contains the business logic that executes when people-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via tdxClient and returns typed results.
 *
 * Note: People endpoints are global and do NOT use an appId prefix.
 */

import { tdxClient } from "../../http/client.js";
import type { TdxPerson, PeopleSearchParams } from "./types.js";

/**
 * Searches for people matching the given parameters.
 * Posts search criteria to the global `/people/search` endpoint.
 */
export async function searchPeople(
  params: PeopleSearchParams,
): Promise<TdxPerson[]> {
  return tdxClient.post<TdxPerson[]>("/people/search", params);
}

/**
 * Retrieves a single person by UID or username.
 * Uses the global `/people/{uidOrUsername}` endpoint.
 */
export async function getPerson(
  uidOrUsername: string,
): Promise<TdxPerson> {
  return tdxClient.get<TdxPerson>(`/people/${uidOrUsername}`);
}
