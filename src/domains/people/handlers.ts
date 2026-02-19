/**
 * Handler implementations for people MCP tools.
 *
 * Contains the business logic that executes when people-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via the shared TdxClient and returns typed results.
 *
 * Note: People endpoints are global and do NOT use an appId prefix.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Person,
  PersonSearch,
} from "@chatt-state/node-teamdynamix";

/**
 * Searches for people matching the given parameters.
 */
export async function searchPeople(
  params: PersonSearch,
): Promise<Person[]> {
  return getTdxClient().people.search(params);
}

/**
 * Retrieves a single person by UID.
 */
export async function getPerson(uid: string): Promise<Person> {
  return getTdxClient().people.get(uid);
}
