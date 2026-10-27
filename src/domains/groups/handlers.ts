/**
 * Handler implementations for group MCP tools.
 *
 * Contains the business logic that executes when group-related
 * MCP tools are invoked by the client. Each handler is a thin
 * wrapper over a single SDK call.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Group,
  GroupSearch,
  GroupCreateParams,
  GroupUpdateParams,
  GroupMember,
} from "@chatt-state/node-teamdynamix";

/** Searches for groups matching the given parameters. */
export async function searchGroups(params: GroupSearch): Promise<Group[]> {
  return getTdxClient().groups.search(params);
}

/** Retrieves a single group by ID. */
export async function getGroup(id: number): Promise<Group> {
  return getTdxClient().groups.get(id);
}

/** Creates a new group. */
export async function createGroup(params: GroupCreateParams): Promise<Group> {
  return getTdxClient().groups.create(params);
}

/** Updates an existing group. */
export async function updateGroup(
  id: number,
  params: GroupUpdateParams,
): Promise<Group> {
  return getTdxClient().groups.update(id, params);
}

/** Gets all members of a group. */
export async function getGroupMembers(
  groupId: number,
): Promise<GroupMember[]> {
  return getTdxClient().groups.getMembers(groupId);
}

/** Adds a member to a group. */
export async function addGroupMember(
  groupId: number,
  uid: string,
  isPrimary?: boolean,
): Promise<void> {
  return getTdxClient().groups.addMember(groupId, uid, isPrimary);
}

/** Removes a member from a group. */
export async function removeGroupMember(
  groupId: number,
  uid: string,
): Promise<void> {
  return getTdxClient().groups.removeMember(groupId, uid);
}
