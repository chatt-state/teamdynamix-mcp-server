# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **AccountId:0 regression** (`tickets`): `resolveRequestorAccountId` now treats a `DefaultAccountID` of `0` (returned by TDX for students/contacts/new users with no default department) as unresolved, and `tdx_tickets_create` flags a falsy resolved AccountID instead of sending `AccountID: 0` — which TDX 400s with "AccountId: 0 does not exist or is invalid". The `accountId`/`typeId`/`statusId`/`priorityId` input schemas are now `.positive()`.
- **Cloudflare Worker exposed only tickets**: `dispatchMcp` now registers the full domain surface via a new static `registerAllDomains()` (Workers cannot use the stdio registry's dynamic `import()`), so the hosted claude.ai connector is full-featured end-to-end rather than tickets-only.

### Added

- **Ticket enumeration tools** — `tdx_tickets_get_types`, `tdx_tickets_get_statuses`, `tdx_tickets_get_priorities` wrap the existing SDK lookups so the model can resolve names like "Resolved" / "In Process" to the numeric IDs that search/create/update/reply require. Added to `DOMAIN_TOOLS.tickets` (tickets domain now 16 tools).

### Changed

- **Attribution on destructive non-ticket writes** (FERPA accountability): the destructive `people` (set_active, create, update, add/remove group membership), `cmdb` (create, update, delete, add_attachment), `assets` (delete), `locations` (delete_room) and `groups` (add/remove member) tools now require a human actor — a verified `X-Portal-User` identity (authoritative, spoof-proof) or model-supplied `actingUserFullName`/`actingUserEmail`, else they refuse — and record the actor in the confirmation output, mirroring the tickets convention. `securityRoleId` and `isActive` on people writes are flagged as privileged. New shared helper `src/middleware/attribution.ts`.
- **Identity threading**: `DomainModule.register()` and every domain's `register()` now accept the verified `PortalIdentity`; `DomainRegistry.setIdentity()` threads it through `loadDomain()` so attribution can be enforced on every transport, not just tickets.
- `tdx_tickets_create`'s `typeId` description no longer claims interactive selection (there is no prompt over HTTP); it documents the server-side default and points to `tdx_tickets_get_types`.
- `tdx_navigate` description now annotates each domain with its TDX synonym (e.g. accounts = departments, cmdb = configuration items, groups = routing/assignment pools).

### Known issues (require an SDK release — out of scope for this repo)

The following are **API-conformance defects in `@chatt-state/node-teamdynamix`** (wrong HTTP verb/route/body). The MCP calls the SDK resource methods and the SDK's `HttpTransport` is `private`, so they cannot be corrected from this package; they need a patched SDK release and are tracked for the next `@chatt-state/node-teamdynamix` version:

- `groups.update` POSTs (should PUT `/groups/{id}`); `groups.addMember`/`removeMember` hit a non-existent per-UID route (should be `POST`/`DELETE /groups/{id}/members` with a UID array).
- `people.addToGroup` POSTs (should PUT `/people/{uid}/groups/{groupID}`); `people.getByUsername` uses the fuzzy `/people/lookup` (returns an array) instead of exact `/people/getuid/{username}`.
- `accounts.update`, `locations.update`, `locations.updateRoom`, `cmdb.update` POST (should PUT/PATCH); `cmdb.addRelationship` POSTs a body (should PUT with `typeId`/`otherItemId`/`isParent` query params).
- `locations.getRooms` / `assets.getAttachments` / `tickets.getAttachments` GET routes that do not exist (the data ships on the parent detail object); `tickets.addTag` sends a scalar body (should be a string array).
- Ticket tasks are read-only: no SDK method for `PATCH/POST /tickets/{id}/tasks/{taskId}`, so no `tdx_tickets_update_task` tool can be added yet.

## [0.4.0] - 2026-10-27

### Added

Full-coverage expansion of the TDX surface — four new domains and new tools across three existing
domains, bringing the server to **13 domains and 90 tools**:

- **Accounts domain** — `tdx_accounts_search`, `tdx_accounts_get`, `tdx_accounts_create`, `tdx_accounts_update` (4 tools). Resolves the AccountID/department used when creating tickets.
- **Groups domain** — `tdx_groups_search`, `tdx_groups_get`, `tdx_groups_get_members`, `tdx_groups_create`, `tdx_groups_update`, `tdx_groups_add_member`, `tdx_groups_remove_member` (7 tools).
- **Locations domain** — `tdx_locations_search`, `tdx_locations_get`, `tdx_locations_create`, `tdx_locations_update`, `tdx_locations_get_rooms`, `tdx_locations_get_room`, `tdx_locations_create_room`, `tdx_locations_update_room`, `tdx_locations_delete_room` (9 tools).
- **CMDB domain** — `tdx_cmdb_search`, `tdx_cmdb_get`, `tdx_cmdb_get_relationships`, `tdx_cmdb_get_feed`, `tdx_cmdb_create`, `tdx_cmdb_update`, `tdx_cmdb_delete`, `tdx_cmdb_add_relationship`, `tdx_cmdb_remove_relationship`, `tdx_cmdb_add_attachment` (10 tools).
- **Tickets domain expansion** — `tdx_tickets_get_feed`, `tdx_tickets_get_tasks`, `tdx_tickets_get_contacts`, `tdx_tickets_add_contact`, `tdx_tickets_remove_contact`, `tdx_tickets_get_attachments`, `tdx_tickets_add_attachment`, `tdx_tickets_add_tag` (8 new tools; `tdx_tickets_reply` now also tracked in registry reporting).
- **People domain expansion** — `tdx_people_get_by_username`, `tdx_people_get_groups`, `tdx_people_add_to_group`, `tdx_people_remove_from_group`, `tdx_people_set_active`, `tdx_people_create`, `tdx_people_update` (7 new tools).
- **Assets domain expansion** — `tdx_assets_update`, `tdx_assets_delete`, `tdx_assets_get_attachments`, `tdx_assets_get_feed` (4 new tools).

### Changed

- `src/domains/registry.ts`: `DOMAIN_NAMES`, `MODULE_MAP`, and `DOMAIN_TOOLS` extended with the four new domains and the expanded tool lists. `tdx_navigate`'s domain enum extends automatically from `z.enum(DOMAIN_NAMES)`.
- `src/server.ts`: `tdx_navigate` human-readable description now lists all 13 domains.
- `registry.test.ts`: tickets exact-list assertion updated and per-domain assertions added for the new domains.

### Notes

- The canonical dependency remains the GitHub Packages release `@chatt-state/node-teamdynamix@^0.3.0`; `package.json` and `package-lock.json` are unchanged. To build without a GitHub Packages token, install the local SDK source ad hoc first: `npm install @chatt-state/node-teamdynamix@file:../_tdx-sdk --no-save` (local-build convenience only — not committed). See the README "SDK dependency" section.

## [0.3.0] - 2026-04-06

### Added

- **`tdx_tickets_reply` tool** — unified reply tool for ticket feed entries. Supports comment replies, inline status changes (with optional cascade to children), reassignment to a responsible user or group, additional notification recipients, and rich HTML comment bodies. Requires mandatory `actingUserFullName` and `actingUserEmail` parameters which are prepended to the comment body as `[Reply from {Name} <{email}> via Service Desk Assistant]`. This is the documented workaround for TDX's lack of per-user API impersonation — the admin service account (renamed to "Chatt State Service Desk Assistant") is always the `CreatedBy`, but the real human author is preserved in the visible comment body for audit and accountability. Reassignment is implemented as a pre-reply `updateTicket` call since the TDX feed endpoint does not accept responsibility changes; a reassignment note is appended to the comment so both actions appear together in the visible audit trail.

### Changed

- Bumped `@chatt-state/node-teamdynamix` from `^0.2.0` to `^0.3.0` to pick up the widened `addFeedEntry` signature and the new `TicketFeedEntryParams` type export. This removes the local type-cast workaround previously used in `src/domains/tickets/handlers.ts` — the handler now imports `TicketFeedEntryParams` directly from the library.

## [0.2.0]

### Added

- **Projects domain** — `tdx_projects_search`, `tdx_projects_get`, `tdx_projects_create`, `tdx_projects_update` (4 tools)
- **Time domain** — `tdx_time_search`, `tdx_time_get`, `tdx_time_create`, `tdx_time_update`, `tdx_time_delete`, `tdx_time_get_types` (6 tools)
- **Reports domain** — `tdx_reports_search`, `tdx_reports_get`, `tdx_reports_execute` (3 tools)
- **Service Catalog domain** — `tdx_services_search`, `tdx_services_get`, `tdx_services_create`, `tdx_services_update`, `tdx_services_search_offerings`, `tdx_services_get_offering`, `tdx_services_create_offering`, `tdx_services_update_offering`, `tdx_services_get_categories` (9 tools)
- **Attributes domain** — `tdx_attributes_list`, `tdx_attributes_get_choices`, `tdx_attributes_create_choice`, `tdx_attributes_update_choice`, `tdx_attributes_delete_choice` (5 tools)
- `TDX_SERVICE_CATALOG_APP_ID` environment variable for service catalog app configuration
- Interactive elicitation for time type selection in `tdx_time_create`
- Interactive elicitation for service category selection in `tdx_services_create`

### Changed

- Server now exposes 9 domains and 38 tools (up from 4 domains and 15 tools)
- Domain registry updated: replaced placeholder `admin` domain with specific `service_catalog` and `attributes` domains
- `tdx_navigate` description updated to list all available domains
- `tdx_status` now reports `serviceCatalog` app ID in configured apps
- MCP elicitation support for interactive form-based ID selection
- `elicitChoice()` helper in `src/middleware/elicitation.ts` for dropdown selection forms
- `tdx_assets_create` tool with elicitation for status and form selection
- Ticket type elicitation in `tdx_tickets_create` (typeId now optional)
- KB category elicitation in `tdx_kb_create_article` (categoryId now optional)
- Ticket picklist handlers: `getTicketTypes()`, `getTicketStatuses()`, `getTicketPriorities()`
- Asset picklist handlers: `getAssetStatuses()`, `getAssetForms()`, `createAsset()`
- Claude plugin (`.claude-plugin/plugin.json`) with skills and commands for Claude Desktop/Code
- Skills for all 4 domains: navigation, tickets, assets, people, knowledge-base
- `/start` command for onboarding and server status verification
- `.mcp.json` for MCP server configuration
- Plugin marketplace catalog (`.claude-plugin/marketplace.json`) for `/plugin marketplace add` installation

### Changed

- Docs theme updated from ChattState brand colors to dark-first developer-focused style (mcp.wyretechnology.com)
- Domain registry: KB domain now includes `tdx_kb_create_article` and `tdx_kb_get_categories`; assets domain includes `tdx_assets_create`
- README.md with installation, configuration, and usage documentation
- Astro Starlight documentation site (`docs/`) with Chattanooga State brand theme
- Documentation pages: getting started, guides (Claude, Docker), reference (tools, environment)
- Repository made public with description and topic tags
- `.mcpbignore` file for slim MCPB bundles (excludes tests, source, dev config)
- `publish-mcpb` job in release workflow — attaches `.mcpb` bundle to GitHub releases
- Docker MCP Gateway support via `io.docker.server.metadata` label in Dockerfile
- Docker secret mount for GitHub Packages auth during `npm install` (no token in image layers)
- `pack-mcpb.mjs` script for slim production-only MCPB bundles (handles local `file:` deps)

### Changed

- Release workflow `build-and-test` job now uses `registry-url` + `NODE_AUTH_TOKEN` for scoped packages
- Docker build uses `--mount=type=secret` instead of `ARG` for NPM token security

## [0.1.0] - Unreleased

### Added

- Project scaffolding with TypeScript, ESM modules, and strict type checking
- Vitest test framework configuration
- ESLint flat config with TypeScript rules
- Prettier configuration for consistent code formatting
- Configuration management with Zod v4 schema validation and environment variable loading
- Shared `TdxClient` singleton (`src/tdx-client.ts`) wrapping `@chatt-state/node-teamdynamix` library
- MCP server setup with dual transport support (stdio and HTTP/SSE)
- Error handler middleware for consistent MCP error responses
### Changed

- Replaced custom HTTP client, token manager, and rate limiter with `@chatt-state/node-teamdynamix` library (-2,400 lines)
- Domain handlers now delegate to the shared TdxClient instead of raw HTTP calls
- Decision tree navigator tools (`tdx_navigate`, `tdx_status`) for guided tool discovery
- Domain registry with lazy loading for on-demand tool registration
- Tickets domain: `tdx_tickets_search`, `tdx_tickets_get`, `tdx_tickets_create`, `tdx_tickets_update`
- Knowledge Base domain: `tdx_kb_search`, `tdx_kb_get_article`
- People domain: `tdx_people_search`, `tdx_people_get`
- Assets domain: `tdx_assets_search`, `tdx_assets_get`
- Docker multi-stage build (`Dockerfile`) for minimal production images
- npm package configuration with CLI entry point (`teamdynamix-mcp-server`)
- Postbuild script to ensure shebang and executable permissions on `dist/index.js`
- Package publishing configuration for GitHub Packages registry
- MCPB manifest (`manifest.json`) for one-click Claude Desktop installation
