import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAccountTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    accounts: {
      search: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  })),
}));

/** Helper to access the private _registeredTools record on McpServer. */
function getRegisteredTools(server: McpServer): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

describe("accounts tools registration", () => {
  it("should register all account tools", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerAccountTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_accounts_search" in registeredTools).toBe(true);
    expect("tdx_accounts_get" in registeredTools).toBe(true);
    expect("tdx_accounts_create" in registeredTools).toBe(true);
    expect("tdx_accounts_update" in registeredTools).toBe(true);
  });

  it("should register exactly 4 account tools", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerAccountTools(server);

    const registeredTools = getRegisteredTools(server);

    const accountTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_accounts_"),
    );
    expect(accountTools).toHaveLength(4);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });

    registerAccountTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = [
      "tdx_accounts_search",
      "tdx_accounts_get",
      "tdx_accounts_create",
      "tdx_accounts_update",
    ];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
