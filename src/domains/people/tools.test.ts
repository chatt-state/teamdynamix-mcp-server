import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPeopleTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    people: {
      search: vi.fn(),
      get: vi.fn(),
      getByUsername: vi.fn(),
      getGroups: vi.fn(),
      addToGroup: vi.fn(),
      removeFromGroup: vi.fn(),
      setActive: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  })),
}));

/** Helper to access the private _registeredTools record on McpServer. */
function getRegisteredTools(
  server: McpServer,
): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

/** The full set of people tool names this domain is expected to register. */
const EXPECTED_PEOPLE_TOOLS = [
  "tdx_people_search",
  "tdx_people_get",
  "tdx_people_get_by_username",
  "tdx_people_get_groups",
  "tdx_people_add_to_group",
  "tdx_people_remove_from_group",
  "tdx_people_set_active",
  "tdx_people_create",
  "tdx_people_update",
];

describe("people tools registration", () => {
  it("should register all people tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    for (const name of EXPECTED_PEOPLE_TOOLS) {
      expect(name in registeredTools).toBe(true);
    }
  });

  it("should register exactly the expected number of people tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    const peopleTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_people_"),
    );
    expect(peopleTools).toHaveLength(EXPECTED_PEOPLE_TOOLS.length);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    for (const name of EXPECTED_PEOPLE_TOOLS) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
