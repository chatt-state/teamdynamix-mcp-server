import { describe, it, expect, vi, beforeEach } from "vitest";
import { domainRegistry } from "./registry.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DomainModule } from "./registry.js";

/** Creates a minimal mock McpServer for testing. */
function createMockServer(): McpServer {
  return {
    sendToolListChanged: vi.fn(),
  } as unknown as McpServer;
}

/** Creates a mock domain module that records its register() calls. */
function createMockDomainModule(): DomainModule {
  return {
    register: vi.fn(),
  };
}

describe("DomainRegistry", () => {
  let mockServer: McpServer;

  beforeEach(() => {
    domainRegistry.reset();
    mockServer = createMockServer();
    domainRegistry.setServer(mockServer);
  });

  describe("loadDomain", () => {
    it("should mark a domain as loaded after loading", async () => {
      const mockModule = createMockDomainModule();

      // Mock the dynamic import
      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("tickets");

      expect(domainRegistry.isDomainLoaded("tickets")).toBe(true);
    });

    it("should call register on the domain module with the server", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("tickets");

      expect(mockModule.register).toHaveBeenCalledWith(mockServer);
    });

    it("should notify clients of tool list change after loading", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("tickets");

      expect(mockServer.sendToolListChanged).toHaveBeenCalled();
    });

    it("should return tool names for the loaded domain", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      const tools = await domainRegistry.loadDomain("tickets");

      expect(tools).toEqual([
        "tdx_tickets_search",
        "tdx_tickets_get",
        "tdx_tickets_create",
        "tdx_tickets_update",
      ]);
    });

    it("should return empty array for already-loaded domains", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("tickets");
      const result = await domainRegistry.loadDomain("tickets");

      expect(result).toEqual([]);
    });

    it("should not call register twice for the same domain", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("tickets");
      await domainRegistry.loadDomain("tickets");

      expect(mockModule.register).toHaveBeenCalledTimes(1);
    });

    it("should throw if server is not set", async () => {
      domainRegistry.reset();
      // Do NOT call setServer

      await expect(domainRegistry.loadDomain("tickets")).rejects.toThrow(
        /server not set/,
      );
    });
  });

  describe("isDomainLoaded", () => {
    it("should return false for domains that have not been loaded", () => {
      expect(domainRegistry.isDomainLoaded("tickets")).toBe(false);
      expect(domainRegistry.isDomainLoaded("assets")).toBe(false);
    });

    it("should return true after a domain is loaded", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("people");

      expect(domainRegistry.isDomainLoaded("people")).toBe(true);
      expect(domainRegistry.isDomainLoaded("tickets")).toBe(false);
    });
  });

  describe("getLoadedDomains", () => {
    it("should return empty array when no domains are loaded", () => {
      expect(domainRegistry.getLoadedDomains()).toEqual([]);
    });

    it("should return all loaded domains", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("tickets");
      await domainRegistry.loadDomain("people");

      const loaded = domainRegistry.getLoadedDomains();
      expect(loaded).toContain("tickets");
      expect(loaded).toContain("people");
      expect(loaded).toHaveLength(2);
    });
  });

  describe("getToolNamesForDomain", () => {
    it("should return known tool names for tickets domain", () => {
      const tools = domainRegistry.getToolNamesForDomain("tickets");
      expect(tools).toContain("tdx_tickets_search");
      expect(tools.length).toBeGreaterThan(0);
    });

    it("should return empty array for phase 2 domains", () => {
      expect(domainRegistry.getToolNamesForDomain("projects")).toEqual([]);
      expect(domainRegistry.getToolNamesForDomain("reports")).toEqual([]);
      expect(domainRegistry.getToolNamesForDomain("time")).toEqual([]);
      expect(domainRegistry.getToolNamesForDomain("admin")).toEqual([]);
    });
  });

  describe("reset", () => {
    it("should clear all loaded domains", async () => {
      const mockModule = createMockDomainModule();

      vi.spyOn(
        domainRegistry as unknown as { importDomain: () => Promise<DomainModule> },
        "importDomain" as never,
      ).mockResolvedValue(mockModule);

      await domainRegistry.loadDomain("tickets");
      expect(domainRegistry.isDomainLoaded("tickets")).toBe(true);

      domainRegistry.reset();
      expect(domainRegistry.isDomainLoaded("tickets")).toBe(false);
      expect(domainRegistry.getLoadedDomains()).toEqual([]);
    });
  });
});
