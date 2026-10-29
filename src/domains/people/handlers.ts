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
  PersonCreateParams,
  PersonUpdateParams,
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

/**
 * Looks up a single person by username.
 */
export async function getPersonByUsername(username: string): Promise<Person> {
  return getTdxClient().people.getByUsername(username);
}

/**
 * Retrieves the groups a person belongs to.
 *
 * The SDK returns these as untyped records; callers format them defensively.
 */
export async function getPersonGroups(uid: string): Promise<unknown[]> {
  return getTdxClient().people.getGroups(uid);
}

/**
 * Adds a person to a group.
 *
 * Note: the SDK's `addToGroup` takes `(groupId, uid)`; this handler keeps the
 * person UID first to match the rest of the domain's conventions.
 */
export async function addPersonToGroup(
  uid: string,
  groupId: number,
): Promise<void> {
  return getTdxClient().people.addToGroup(groupId, uid);
}

/**
 * Removes a person from a group.
 *
 * Note: the SDK's `removeFromGroup` takes `(groupId, uid)`; this handler keeps
 * the person UID first to match the rest of the domain's conventions.
 */
export async function removePersonFromGroup(
  uid: string,
  groupId: number,
): Promise<void> {
  return getTdxClient().people.removeFromGroup(groupId, uid);
}

/**
 * Sets a person's active status (deactivate / reactivate).
 */
export async function setPersonActive(
  uid: string,
  isActive: boolean,
): Promise<void> {
  return getTdxClient().people.setActive(uid, isActive);
}

/**
 * Creates a new person.
 */
export async function createPerson(
  params: PersonCreateParams,
): Promise<Person> {
  return getTdxClient().people.create(params);
}

/**
 * Updates an existing person by UID.
 */
export async function updatePerson(
  uid: string,
  params: PersonUpdateParams,
): Promise<Person> {
  return getTdxClient().people.update(uid, params);
}
