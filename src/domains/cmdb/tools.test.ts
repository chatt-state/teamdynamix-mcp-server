import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCmdbTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    cmdb: {
      search: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getFeed: vi.fn(),
      getRelationships: vi.fn(),
      addRelationship: vi.fn(),
      removeRelationship: vi.fn(),
      addAttachment: vi.fn(),
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

const EXPECTED_TOOLS = [
  "tdx_cmdb_search",
  "tdx_cmdb_get",
  "tdx_cmdb_get_relationships",
  "tdx_cmdb_get_feed",
  "tdx_cmdb_create",
  "tdx_cmdb_update",
  "tdx_cmdb_delete",
  "tdx_cmdb_add_relationship",
  "tdx_cmdb_remove_relationship",
  "tdx_cmdb_add_attachment",
];

describe("cmdb tools registration", () => {
  it("should register all cmdb tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerCmdbTools(server);

    const registeredTools = getRegisteredTools(server);

    for (const name of EXPECTED_TOOLS) {
      expect(name in registeredTools).toBe(true);
    }
  });

  it("should register exactly 10 cmdb tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerCmdbTools(server);

    const registeredTools = getRegisteredTools(server);

    const cmdbTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_cmdb_"),
    );
    expect(cmdbTools).toHaveLength(10);
  });
});
