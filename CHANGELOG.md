# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`tdx_tickets_reply` tool** — unified reply tool for ticket feed entries. Supports comment replies, inline status changes (with optional cascade to children), reassignment to a responsible user or group, additional notification recipients, and rich HTML comment bodies. Requires mandatory `actingUserFullName` and `actingUserEmail` parameters which are prepended to the comment body as `[Reply from {Name} <{email}> via Service Desk Assistant]`. This is the documented workaround for TDX's lack of per-user API impersonation — the admin service account (renamed to "Chatt State Service Desk Assistant") is always the `CreatedBy`, but the real human author is preserved in the visible comment body for audit and accountability. Reassignment is implemented as a pre-reply `updateTicket` call since the TDX feed endpoint does not accept responsibility changes; a reassignment note is appended to the comment so both actions appear together in the visible audit trail.
- `TicketFeedEntryParams` type in `src/domains/tickets/handlers.ts` that widens the library's under-typed `addFeedEntry` signature to include all TDX-supported feed fields (`NewStatusID`, `CascadeStatus`, `Notify`, `IsRichHtml`, `IsCommunication`). Forwarded to the library via a narrow cast until the upstream type is widened (tracked as a follow-up in `@chatt-state/node-teamdynamix`).
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
