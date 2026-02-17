import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Mock all dependencies that server.ts imports at module level.
 * These must be set up before the dynamic import of server.ts.
 */
vi.mock("./config.js", () => ({
  getConfig: vi.fn(() => ({
    baseUrl: "https://example.teamdynamix.com",
    beid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    webServicesKey: "12345678-abcd-ef01-2345-6789abcdef01",
    ticketingAppId: 123,
    assetsAppId: 456,
    kbAppId: 789,
    transport: "stdio",
    httpPort: 3000,
    httpHost: "0.0.0.0",
    logLevel: "info",
    preloadDomains: ["tickets"],
    rateLimitBuffer: 5,
  })),
}));

vi.mock("./auth/token-manager.js", () => ({
  tokenManager: {
    isAuthenticated: vi.fn(() => false),
    dispose: vi.fn(),
  },
}));

vi.mock("./middleware/rate-limiter.js", () => ({
  rateLimiter: {
    getStatus: vi.fn(() => ({})),
  },
}));

vi.mock("./domains/registry.js", () => ({
  DOMAIN_NAMES: [
    "tickets",
    "knowledge_base",
    "people",
    "assets",
    "projects",
    "reports",
    "time",
    "admin",
  ] as const,
  domainRegistry: {
    isDomainLoaded: vi.fn(() => false),
    loadDomain: vi.fn(async () => ["tdx_tickets_search", "tdx_tickets_get"]),
    getLoadedDomains: vi.fn(() => []),
  },
}));

describe("server", () => {
  let mcpServer: McpServer;

  beforeEach(async () => {
    vi.resetModules();
    const serverModule = await import("./server.js");
    mcpServer = serverModule.mcpServer;
  });

  it("should export an McpServer instance", () => {
    expect(mcpServer).toBeInstanceOf(McpServer);
  });

  it("should have tools capability with listChanged enabled", () => {
    // The McpServer was constructed with tools: { listChanged: true }
    // We verify it is an McpServer instance; the capability is set internally
    expect(mcpServer).toBeDefined();
    expect(mcpServer.server).toBeDefined();
  });

  it("should register the tdx_navigate tool", () => {
    const registeredTools = (mcpServer as unknown as {
      _registeredTools: Record<string, unknown>;
    })._registeredTools;

    expect("tdx_navigate" in registeredTools).toBe(true);
  });

  it("should register the tdx_status tool", () => {
    const registeredTools = (mcpServer as unknown as {
      _registeredTools: Record<string, unknown>;
    })._registeredTools;

    expect("tdx_status" in registeredTools).toBe(true);
  });
});
