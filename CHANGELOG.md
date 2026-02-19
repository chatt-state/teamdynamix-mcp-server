# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
