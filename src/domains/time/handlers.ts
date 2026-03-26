/**
 * Handler implementations for time entry MCP tools.
 *
 * Contains the business logic that executes when time-related
 * MCP tools are invoked by the client.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  TimeEntry,
  TimeEntrySearch,
  TimeEntryCreateParams,
  TimeEntryUpdateParams,
  TimeType,
} from "@chatt-state/node-teamdynamix";

/** Searches for time entries matching the given parameters. */
export async function searchTimeEntries(
  params: TimeEntrySearch,
): Promise<TimeEntry[]> {
  return getTdxClient().time.search(params);
}

/** Retrieves a single time entry by ID. */
export async function getTimeEntry(id: number): Promise<TimeEntry> {
  return getTdxClient().time.get(id);
}

/** Creates a new time entry. */
export async function createTimeEntry(
  params: TimeEntryCreateParams,
): Promise<TimeEntry> {
  return getTdxClient().time.create(params);
}

/** Updates an existing time entry. */
export async function updateTimeEntry(
  id: number,
  params: TimeEntryUpdateParams,
): Promise<TimeEntry> {
  return getTdxClient().time.update(id, params);
}

/** Deletes a time entry. */
export async function deleteTimeEntry(id: number): Promise<void> {
  return getTdxClient().time.delete(id);
}

/** Gets all available time types. */
export async function getTimeTypes(): Promise<TimeType[]> {
  return getTdxClient().time.getTypes();
}
