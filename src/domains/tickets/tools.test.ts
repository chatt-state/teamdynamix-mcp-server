import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTicketTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    tickets: {
      search: vi.fn(),
      get: vi.fn(),
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

describe("ticket tools registration", () => {
  it("should register all four ticket tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerTicketTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_tickets_search" in registeredTools).toBe(true);
    expect("tdx_tickets_get" in registeredTools).toBe(true);
    expect("tdx_tickets_create" in registeredTools).toBe(true);
    expect("tdx_tickets_update" in registeredTools).toBe(true);
  });

  it("should register exactly 4 ticket tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerTicketTools(server);

    const registeredTools = getRegisteredTools(server);

    const ticketTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_tickets_"),
    );
    expect(ticketTools).toHaveLength(4);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerTicketTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = [
      "tdx_tickets_search",
      "tdx_tickets_get",
      "tdx_tickets_create",
      "tdx_tickets_update",
    ];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
