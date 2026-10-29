import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLocationTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    locations: {
      search: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      getRooms: vi.fn(),
      getRoom: vi.fn(),
      createRoom: vi.fn(),
      updateRoom: vi.fn(),
      deleteRoom: vi.fn(),
    },
  })),
}));

vi.mock("../../middleware/elicitation.js", () => ({
  elicitChoice: vi.fn(),
}));

/** Helper to access the private _registeredTools record on McpServer. */
function getRegisteredTools(server: McpServer): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

const EXPECTED_TOOLS = [
  "tdx_locations_search",
  "tdx_locations_get",
  "tdx_locations_create",
  "tdx_locations_update",
  "tdx_locations_get_rooms",
  "tdx_locations_get_room",
  "tdx_locations_create_room",
  "tdx_locations_update_room",
  "tdx_locations_delete_room",
];

describe("location tools registration", () => {
  it("should register all location tools", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerLocationTools(server);

    const registeredTools = getRegisteredTools(server);
    for (const name of EXPECTED_TOOLS) {
      expect(name in registeredTools).toBe(true);
    }
  });

  it("should register exactly 9 location tools", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerLocationTools(server);

    const registeredTools = getRegisteredTools(server);
    const locationTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_locations_"),
    );
    expect(locationTools).toHaveLength(9);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerLocationTools(server);

    const registeredTools = getRegisteredTools(server);
    for (const name of EXPECTED_TOOLS) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
