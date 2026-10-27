import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGroupTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    groups: {
      search: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      getMembers: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
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

describe("group tools registration", () => {
  it("should register all group tools", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerGroupTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_groups_search" in registeredTools).toBe(true);
    expect("tdx_groups_get" in registeredTools).toBe(true);
    expect("tdx_groups_get_members" in registeredTools).toBe(true);
    expect("tdx_groups_create" in registeredTools).toBe(true);
    expect("tdx_groups_update" in registeredTools).toBe(true);
    expect("tdx_groups_add_member" in registeredTools).toBe(true);
    expect("tdx_groups_remove_member" in registeredTools).toBe(true);
  });

  it("should register exactly 7 group tools", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerGroupTools(server);

    const registeredTools = getRegisteredTools(server);

    const groupTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_groups_"),
    );
    expect(groupTools).toHaveLength(7);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerGroupTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = [
      "tdx_groups_search",
      "tdx_groups_get",
      "tdx_groups_get_members",
      "tdx_groups_create",
      "tdx_groups_update",
      "tdx_groups_add_member",
      "tdx_groups_remove_member",
    ];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
