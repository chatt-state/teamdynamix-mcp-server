/**
 * Domain registry for MCP tool registration.
 *
 * Manages the registration and discovery of domain-specific
 * tool handlers (tickets, KB articles, people, assets, etc.).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** All supported domain names. */
export const DOMAIN_NAMES = [
  "tickets",
  "knowledge_base",
  "people",
  "assets",
  "projects",
  "reports",
  "time",
  "service_catalog",
  "attributes",
] as const;

export type DomainName = (typeof DOMAIN_NAMES)[number];

/** Interface that each domain module must implement. */
export interface DomainModule {
  register(server: McpServer): void;
}

/** Maps domain names to their module import paths. */
const MODULE_MAP: Record<DomainName, string> = {
  tickets: "./tickets/index.js",
  knowledge_base: "./knowledge-base/index.js",
  people: "./people/index.js",
  assets: "./assets/index.js",
  projects: "./projects/index.js",
  reports: "./reports/index.js",
  time: "./time/index.js",
  service_catalog: "./service-catalog/index.js",
  attributes: "./attributes/index.js",
};

/** Known tool names per domain for reporting after load. */
const DOMAIN_TOOLS: Record<DomainName, string[]> = {
  tickets: [
    "tdx_tickets_search",
    "tdx_tickets_get",
    "tdx_tickets_create",
    "tdx_tickets_update",
  ],
  knowledge_base: [
    "tdx_kb_search",
    "tdx_kb_get_article",
    "tdx_kb_create_article",
    "tdx_kb_get_categories",
  ],
  people: [
    "tdx_people_search",
    "tdx_people_get",
  ],
  assets: [
    "tdx_assets_search",
    "tdx_assets_get",
    "tdx_assets_create",
  ],
  projects: [
    "tdx_projects_search",
    "tdx_projects_get",
    "tdx_projects_create",
    "tdx_projects_update",
  ],
  reports: [
    "tdx_reports_search",
    "tdx_reports_get",
    "tdx_reports_execute",
  ],
  time: [
    "tdx_time_search",
    "tdx_time_get",
    "tdx_time_create",
    "tdx_time_update",
    "tdx_time_delete",
    "tdx_time_get_types",
  ],
  service_catalog: [
    "tdx_services_search",
    "tdx_services_get",
    "tdx_services_create",
    "tdx_services_update",
    "tdx_services_search_offerings",
    "tdx_services_get_offering",
    "tdx_services_create_offering",
    "tdx_services_update_offering",
    "tdx_services_get_categories",
  ],
  attributes: [
    "tdx_attributes_list",
    "tdx_attributes_get_choices",
    "tdx_attributes_create_choice",
    "tdx_attributes_update_choice",
    "tdx_attributes_delete_choice",
  ],
};

/**
 * Registry that manages lazy-loading of domain tool sets.
 *
 * Domains are loaded on demand via `loadDomain()`. Once loaded,
 * their tools are registered with the MCP server and clients
 * are notified of the tool list change.
 */
class DomainRegistry {
  private loadedDomains = new Set<DomainName>();
  private serverRef: McpServer | null = null;

  /**
   * Sets the MCP server reference used when registering domain tools.
   */
  setServer(server: McpServer): void {
    this.serverRef = server;
  }

  /**
   * Loads a domain module and registers its tools with the MCP server.
   *
   * If the domain is already loaded, returns an empty array immediately.
   * Otherwise, dynamically imports the module, calls its `register()`
   * function, and notifies connected clients of the tool list change.
   *
   * @returns The names of tools registered by the domain.
   */
  async loadDomain(domain: DomainName): Promise<string[]> {
    if (this.loadedDomains.has(domain)) {
      return [];
    }

    const server = this.serverRef;
    if (server === null) {
      throw new Error("DomainRegistry: server not set. Call setServer() first.");
    }

    const domainModule = await this.importDomain(domain);
    domainModule.register(server);
    this.loadedDomains.add(domain);

    server.sendToolListChanged();

    return this.getToolNamesForDomain(domain);
  }

  /**
   * Returns the known tool names for a given domain.
   */
  getToolNamesForDomain(domain: DomainName): string[] {
    return DOMAIN_TOOLS[domain] ?? [];
  }

  /** Returns all currently loaded domain names. */
  getLoadedDomains(): DomainName[] {
    return [...this.loadedDomains];
  }

  /** Checks whether a specific domain has been loaded. */
  isDomainLoaded(domain: DomainName): boolean {
    return this.loadedDomains.has(domain);
  }

  /**
   * Resets the registry state. Primarily useful for testing.
   */
  reset(): void {
    this.loadedDomains.clear();
    this.serverRef = null;
  }

  /**
   * Dynamically imports a domain module by name.
   */
  private async importDomain(domain: DomainName): Promise<DomainModule> {
    const modulePath = MODULE_MAP[domain];
    return import(modulePath) as Promise<DomainModule>;
  }
}

/** Singleton DomainRegistry instance. */
export const domainRegistry = new DomainRegistry();
