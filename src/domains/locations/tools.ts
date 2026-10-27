/**
 * MCP tool definitions for location and room operations.
 *
 * Defines the schemas and metadata for location-related MCP tools.
 * Tools follow the `tdx_locations_*` naming convention.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  LocationCreateParams,
  LocationUpdateParams,
  LocationRoomCreateParams,
  LocationRoomUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import {
  actingUserSchema,
  resolveActor,
  missingAttributionResult,
  attributionNote,
} from "../../middleware/attribution.js";
import { elicitChoice } from "../../middleware/elicitation.js";
import * as handlers from "./handlers.js";

/**
 * Resolves a location ID, prompting the user to pick one interactively
 * when it is omitted. Returns the resolved ID, or null if no selection
 * could be made (client lacks elicitation, user declined, or none exist).
 */
async function resolveLocationId(
  provided: number | undefined,
): Promise<number | null> {
  if (provided !== undefined) return provided;
  const locations = await handlers.searchLocations({});
  return elicitChoice(
    "Select a location:",
    "locationId",
    "Location",
    locations.map((l) => ({ id: l.ID, name: l.Name })),
  );
}

/** Standard error response when a location ID cannot be resolved. */
const locationRequiredError = {
  content: [
    {
      type: "text" as const,
      text: "Location selection is required. Provide locationId or try again.",
    },
  ],
  isError: true as const,
};

/**
 * Registers all location-related tools with the MCP server.
 * Tools follow the `tdx_locations_*` naming convention.
 */
export function registerLocationTools(
  server: McpServer,
  identity: PortalIdentity | null = null,
): void {
  server.registerTool(
    "tdx_locations_search",
    {
      title: "Search Locations",
      description:
        "Search TeamDynamix locations. Returns summary data — use tdx_locations_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Text to match against location names"),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active status"),
        maxResults: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum results to return"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const locations = await handlers.searchLocations({
          SearchText: args.searchText,
          IsActive: args.isActive,
          MaxResults: args.maxResults,
        });
        const summary = locations
          .map(
            (l) =>
              `#${l.ID} ${l.Name}${
                [l.City, l.State].filter(Boolean).length > 0
                  ? ` — ${[l.City, l.State].filter(Boolean).join(", ")}`
                  : ""
              } (${l.IsActive ? "Active" : "Inactive"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                locations.length === 0
                  ? "No locations found matching the search criteria."
                  : `Found ${locations.length} location(s):\n\n${summary}\n\nUse tdx_locations_get for details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_get",
    {
      title: "Get Location",
      description: "Get full location details by ID.",
      inputSchema: {
        locationId: z
          .number()
          .int()
          .positive()
          .describe("The location ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const location = await handlers.getLocation(args.locationId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(location, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_create",
    {
      title: "Create Location",
      description: "Create a new location (building/site).",
      inputSchema: {
        name: z.string().describe("Location name"),
        description: z
          .string()
          .optional()
          .describe("Location description"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the location is active"),
        address: z.string().optional().describe("Street address"),
        city: z.string().optional().describe("City"),
        state: z.string().optional().describe("State/province"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const data: LocationCreateParams = {
          Name: args.name,
          Description: args.description,
          IsActive: args.isActive,
          Address: args.address,
          City: args.city,
          State: args.state,
        };
        const location = await handlers.createLocation(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Location #${location.ID} "${location.Name}" created.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_update",
    {
      title: "Update Location",
      description: "Update an existing location.",
      inputSchema: {
        locationId: z
          .number()
          .int()
          .positive()
          .describe("Location ID to update"),
        name: z.string().optional().describe("Updated name"),
        description: z.string().optional().describe("Updated description"),
        isActive: z.boolean().optional().describe("Updated active status"),
        address: z.string().optional().describe("Updated street address"),
        city: z.string().optional().describe("Updated city"),
        state: z.string().optional().describe("Updated state/province"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { locationId, ...fields } = args;
        const data: LocationUpdateParams = {};
        if (fields.name !== undefined) data.Name = fields.name;
        if (fields.description !== undefined)
          data.Description = fields.description;
        if (fields.isActive !== undefined) data.IsActive = fields.isActive;
        if (fields.address !== undefined) data.Address = fields.address;
        if (fields.city !== undefined) data.City = fields.city;
        if (fields.state !== undefined) data.State = fields.state;
        const location = await handlers.updateLocation(locationId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Location #${location.ID} "${location.Name}" updated.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_get_rooms",
    {
      title: "Get Location Rooms",
      description:
        "List all rooms for a location. Returns summary data — use tdx_locations_get_room for full details.",
      inputSchema: {
        locationId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Location ID — omit to select interactively"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const locationId = await resolveLocationId(args.locationId);
        if (locationId === null) return locationRequiredError;
        const rooms = await handlers.getRooms(locationId);
        const summary = rooms
          .map(
            (r) =>
              `#${r.ID} ${r.Name}${r.Floor ? ` (Floor ${r.Floor})` : ""}`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                rooms.length === 0
                  ? `No rooms found for location #${locationId}.`
                  : `Found ${rooms.length} room(s) for location #${locationId}:\n\n${summary}\n\nUse tdx_locations_get_room for details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_get_room",
    {
      title: "Get Location Room",
      description: "Get full details for a room within a location.",
      inputSchema: {
        locationId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Location ID — omit to select interactively"),
        roomId: z
          .number()
          .int()
          .positive()
          .describe("The room ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const locationId = await resolveLocationId(args.locationId);
        if (locationId === null) return locationRequiredError;
        const room = await handlers.getRoom(locationId, args.roomId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(room, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_create_room",
    {
      title: "Create Location Room",
      description: "Create a new room within a location.",
      inputSchema: {
        locationId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Location ID — omit to select interactively"),
        name: z.string().describe("Room name"),
        description: z
          .string()
          .optional()
          .describe("Room description"),
        floor: z.string().optional().describe("Floor the room is on"),
        externalId: z
          .string()
          .optional()
          .describe("External identifier for the room"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const locationId = await resolveLocationId(args.locationId);
        if (locationId === null) return locationRequiredError;
        const data: LocationRoomCreateParams = {
          Name: args.name,
          Description: args.description,
          Floor: args.floor,
          ExternalID: args.externalId,
        };
        const room = await handlers.createRoom(locationId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Room #${room.ID} "${room.Name}" created in location #${locationId}.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_update_room",
    {
      title: "Update Location Room",
      description: "Update an existing room within a location.",
      inputSchema: {
        locationId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Location ID — omit to select interactively"),
        roomId: z
          .number()
          .int()
          .positive()
          .describe("Room ID to update"),
        name: z.string().optional().describe("Updated room name"),
        description: z
          .string()
          .optional()
          .describe("Updated room description"),
        floor: z.string().optional().describe("Updated floor"),
        externalId: z
          .string()
          .optional()
          .describe("Updated external identifier"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const locationId = await resolveLocationId(args.locationId);
        if (locationId === null) return locationRequiredError;
        const data: LocationRoomUpdateParams = {};
        if (args.name !== undefined) data.Name = args.name;
        if (args.description !== undefined) data.Description = args.description;
        if (args.floor !== undefined) data.Floor = args.floor;
        if (args.externalId !== undefined) data.ExternalID = args.externalId;
        const room = await handlers.updateRoom(locationId, args.roomId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Room #${room.ID} "${room.Name}" updated in location #${locationId}.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_locations_delete_room",
    {
      title: "Delete Location Room",
      description:
        "Delete a room from a location.\n\n" +
        "ATTRIBUTION REQUIRED: deleting a room is destructive and runs through " +
        "the shared TDX service account, so supply the real name and email of " +
        "the user making the change (never guess) — it is recorded in the " +
        "confirmation so the deletion is human-attributable.",
      inputSchema: {
        locationId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Location ID — omit to select interactively"),
        roomId: z
          .number()
          .int()
          .positive()
          .describe("Room ID to delete"),
        ...actingUserSchema(identity),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const actor = resolveActor(
          identity,
          args.actingUserFullName,
          args.actingUserEmail,
        );
        if (!actor) return missingAttributionResult();
        const locationId = await resolveLocationId(args.locationId);
        if (locationId === null) return locationRequiredError;
        await handlers.deleteRoom(locationId, args.roomId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Room #${args.roomId} deleted from location #${locationId}.${attributionNote(actor)}`,
            },
          ],
        };
      });
    },
  );
}
