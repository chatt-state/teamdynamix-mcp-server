import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerKbTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real HTTP client or config.
 */
vi.mock("../../http/client.js", () => ({
  tdxClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../config.js", () => ({
  getConfig: vi.fn(() => ({
    kbAppId: 50,
  })),
}));

/** Helper to access the private _registeredTools record on McpServer. */
function getRegisteredTools(
  server: McpServer,
): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

describe("knowledge base tools registration", () => {
  it("should register both KB tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerKbTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_kb_search" in registeredTools).toBe(true);
    expect("tdx_kb_get_article" in registeredTools).toBe(true);
  });

  it("should register exactly 2 KB tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerKbTools(server);

    const registeredTools = getRegisteredTools(server);

    const kbTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_kb_"),
    );
    expect(kbTools).toHaveLength(2);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerKbTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = ["tdx_kb_search", "tdx_kb_get_article"];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
