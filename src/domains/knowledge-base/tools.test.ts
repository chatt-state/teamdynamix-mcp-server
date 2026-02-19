import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerKbTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    knowledgeBase: {
      search: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      getCategories: vi.fn(),
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

describe("knowledge base tools registration", () => {
  it("should register all KB tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerKbTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_kb_search" in registeredTools).toBe(true);
    expect("tdx_kb_get_article" in registeredTools).toBe(true);
    expect("tdx_kb_create_article" in registeredTools).toBe(true);
    expect("tdx_kb_get_categories" in registeredTools).toBe(true);
  });

  it("should register exactly 4 KB tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerKbTools(server);

    const registeredTools = getRegisteredTools(server);

    const kbTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_kb_"),
    );
    expect(kbTools).toHaveLength(4);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerKbTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = [
      "tdx_kb_search",
      "tdx_kb_get_article",
      "tdx_kb_create_article",
      "tdx_kb_get_categories",
    ];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});
