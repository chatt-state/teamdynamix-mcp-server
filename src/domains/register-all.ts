/**
 * Static registration of every domain's tool set.
 *
 * The stdio/HTTP entrypoint (src/index.ts) lazy-loads domains on demand via
 * `domainRegistry.loadDomain()`, which uses dynamic `import()`. That mechanism
 * is unavailable in the Cloudflare Worker bundle, so the Worker instead calls
 * `registerAllDomains()` to statically register the full surface per request.
 * This is what makes the hosted claude.ai connector full-featured end-to-end:
 * without it only tickets were reachable there.
 *
 * `identity` is the cryptographically verified portal user (or null). It is
 * threaded into every domain's `register()` so attribution-aware tools (ticket
 * replies, and the destructive people/CMDB/asset/location/group writes) can
 * enforce a human-attributable audit trail server-side.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortalIdentity } from "../middleware/portal-identity.js";

import { register as registerTickets } from "./tickets/index.js";
import { register as registerKnowledgeBase } from "./knowledge-base/index.js";
import { register as registerPeople } from "./people/index.js";
import { register as registerAssets } from "./assets/index.js";
import { register as registerProjects } from "./projects/index.js";
import { register as registerReports } from "./reports/index.js";
import { register as registerTime } from "./time/index.js";
import { register as registerServiceCatalog } from "./service-catalog/index.js";
import { register as registerAttributes } from "./attributes/index.js";
import { register as registerAccounts } from "./accounts/index.js";
import { register as registerGroups } from "./groups/index.js";
import { register as registerLocations } from "./locations/index.js";
import { register as registerCmdb } from "./cmdb/index.js";

/** Registers the tools for every TeamDynamix domain on the given server. */
export function registerAllDomains(
  server: McpServer,
  identity: PortalIdentity | null = null,
): void {
  registerTickets(server, identity);
  registerKnowledgeBase(server, identity);
  registerPeople(server, identity);
  registerAssets(server, identity);
  registerProjects(server, identity);
  registerReports(server, identity);
  registerTime(server, identity);
  registerServiceCatalog(server, identity);
  registerAttributes(server, identity);
  registerAccounts(server, identity);
  registerGroups(server, identity);
  registerLocations(server, identity);
  registerCmdb(server, identity);
}
