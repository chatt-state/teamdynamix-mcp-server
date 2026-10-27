/**
 * Handler implementations for location and room MCP tools.
 *
 * Contains the business logic that executes when location-related
 * MCP tools are invoked by the client. Each function is a thin
 * wrapper over a single SDK call on the `locations` resource.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Location,
  LocationSearch,
  LocationCreateParams,
  LocationUpdateParams,
  LocationRoom,
  LocationRoomCreateParams,
  LocationRoomUpdateParams,
} from "@chatt-state/node-teamdynamix";

/** Searches for locations matching the given parameters. */
export async function searchLocations(
  params: LocationSearch,
): Promise<Location[]> {
  return getTdxClient().locations.search(params);
}

/** Retrieves a single location by ID. */
export async function getLocation(id: number): Promise<Location> {
  return getTdxClient().locations.get(id);
}

/** Creates a new location. */
export async function createLocation(
  params: LocationCreateParams,
): Promise<Location> {
  return getTdxClient().locations.create(params);
}

/** Updates an existing location. */
export async function updateLocation(
  id: number,
  params: LocationUpdateParams,
): Promise<Location> {
  return getTdxClient().locations.update(id, params);
}

/** Gets all rooms for a location. */
export async function getRooms(locationId: number): Promise<LocationRoom[]> {
  return getTdxClient().locations.getRooms(locationId);
}

/** Gets a single room by ID within a location. */
export async function getRoom(
  locationId: number,
  roomId: number,
): Promise<LocationRoom> {
  return getTdxClient().locations.getRoom(locationId, roomId);
}

/** Creates a new room within a location. */
export async function createRoom(
  locationId: number,
  room: LocationRoomCreateParams,
): Promise<LocationRoom> {
  return getTdxClient().locations.createRoom(locationId, room);
}

/** Updates an existing room within a location. */
export async function updateRoom(
  locationId: number,
  roomId: number,
  room: LocationRoomUpdateParams,
): Promise<LocationRoom> {
  return getTdxClient().locations.updateRoom(locationId, roomId, room);
}

/** Deletes a room from a location. */
export async function deleteRoom(
  locationId: number,
  roomId: number,
): Promise<void> {
  return getTdxClient().locations.deleteRoom(locationId, roomId);
}
