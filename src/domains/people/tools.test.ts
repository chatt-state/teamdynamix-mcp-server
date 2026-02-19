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

describe("people tools registration", () => {
  it("should register both people tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_people_search" in registeredTools).toBe(true);
    expect("tdx_people_get" in registeredTools).toBe(true);
  });

  it("should register exactly 2 people tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    const peopleTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_people_"),
    );
    expect(peopleTools).toHaveLength(2);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = [
      "tdx_people_search",
      "tdx_people_get",
    ];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
