import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAssetTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    assets: {
      search: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      getStatuses: vi.fn(),
      getForms: vi.fn(),
    },
  })),
}));

vi.mock("../../middleware/elicitation.js", () => ({
  elicitChoice: vi.fn(),
}));

/** Helper to access the private _registeredTools record on McpServer. */
function getRegisteredTools(
  server: McpServer,
): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

describe("asset tools registration", () => {
  it("should register all asset tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerAssetTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_assets_search" in registeredTools).toBe(true);
    expect("tdx_assets_get" in registeredTools).toBe(true);
    expect("tdx_assets_create" in registeredTools).toBe(true);
  });

  it("should register exactly 3 asset tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerAssetTools(server);

    const registeredTools = getRegisteredTools(server);

    const assetTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_assets_"),
    );
    expect(assetTools).toHaveLength(3);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerAssetTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = [
      "tdx_assets_search",
      "tdx_assets_get",
      "tdx_assets_create",
    ];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
