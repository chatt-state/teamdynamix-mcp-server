import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllDomains } from "./register-all.js";
import { DOMAIN_NAMES } from "./registry.js";
import type { DomainName } from "./registry.js";
import { domainRegistry } from "./registry.js";

/** Access the private _registeredTools record on McpServer. */
function getRegisteredTools(server: McpServer): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

describe("registerAllDomains", () => {
  it("registers tools for every domain in a single call", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });

    registerAllDomains(server);

    const names = Object.keys(getRegisteredTools(server));

    // Every domain contributes at least its canonical search tool, so the
    // Cloudflare Worker exposes the full surface (not just tickets).
    expect(names).toContain("tdx_tickets_search");
    expect(names).toContain("tdx_people_search");
    expect(names).toContain("tdx_assets_search");
    expect(names).toContain("tdx_kb_search");
    expect(names).toContain("tdx_accounts_search");
    expect(names).toContain("tdx_groups_search");
    expect(names).toContain("tdx_locations_search");
    expect(names).toContain("tdx_cmdb_search");
    expect(names).toContain("tdx_time_search");
    expect(names).toContain("tdx_services_search");
    expect(names).toContain("tdx_reports_search");
    expect(names).toContain("tdx_projects_search");
    expect(names).toContain("tdx_attributes_list");
  });

  it("registers every tool enumerated in the domain registry", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerAllDomains(server);
    const names = new Set(Object.keys(getRegisteredTools(server)));

    for (const domain of DOMAIN_NAMES) {
      for (const tool of domainRegistry.getToolNamesForDomain(
        domain as DomainName,
      )) {
        expect(names.has(tool)).toBe(true);
      }
    }
  });

  it("passes the verified identity through to attribution-aware tools", () => {
    const identity = { email: "jdoe@example.edu", name: "Jane Doe" };
    const server = new McpServer({ name: "test", version: "0.0.1" });

    // Should not throw; identity-shaped descriptions are built at registration.
    expect(() => registerAllDomains(server, identity)).not.toThrow();
    const names = Object.keys(getRegisteredTools(server));
    expect(names).toContain("tdx_tickets_reply");
  });
});
