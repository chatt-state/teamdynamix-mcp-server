# TDX MCP Server - Project Context

## Architecture
- TypeScript ESM, Node.js 20+, strict mode, NodeNext module resolution
- .js extensions required in all relative imports
- Decision-tree lazy loading: only `tdx_navigate` and `tdx_status` load at startup
- Domains loaded on demand via `domainRegistry.loadDomain()`
- 2 runtime dependencies: `@modelcontextprotocol/sdk`, `zod`

## Learnings - 2026-02-17

### MCP SDK registerTool accepts raw Zod shapes (not z.object wrapper)
`registerTool` inputSchema takes `{ name: z.string() }` directly. The SDK's `ZodRawShapeCompat` type wraps it internally. Do NOT use `z.object({...})` — verified from actual `@modelcontextprotocol/sdk` .d.ts files.

### MCPB manifest needs tools_generated for lazy-loaded servers
When MCP tools are loaded dynamically (decision-tree pattern), set `"tools_generated": true` in manifest.json. Only always-available tools (tdx_navigate, tdx_status) go in the static `tools` array.

### sendToolListChanged() required after dynamic registerTool
After calling `registerTool()` post-handshake, must call `server.sendToolListChanged()` to notify connected clients. Without this, Claude won't discover newly loaded domain tools.

### TDX API auth returns raw JWT string
POST `/api/auth/loginadmin` with `{"BEID": "...", "WebServicesKey": "..."}` returns a raw JWT string (not JSON object). Token valid 24hrs, payload `exp` in seconds. People endpoints are global (no appId), while tickets/assets/KB require appId in URL path.

### McpErrorResponse needs index signature for SDK compatibility
The error handler's return type needs `[key: string]: unknown` index signature to satisfy the MCP SDK's `CallToolResult` type constraint.

## Learnings - 2026-02-19

### GitHub Packages cross-repo access for GITHUB_TOKEN
When repo A's CI needs to `npm ci` a private package published from repo B (same org), the default `GITHUB_TOKEN` gets 403. Fix: go to the package settings → "Manage Actions access" → add repo A with Read role. No REST API exists for this — UI only.

### package-lock.json retains file: resolutions after switching to registry
After changing `package.json` from `"file:../foo"` to `"^0.1.0"`, the lockfile still has `"resolved": "../foo"`. Must delete `package-lock.json` and `node_modules`, then `npm install` fresh to get registry resolution.

### Starlight CSS theme: dark-first with semantic white/black
Starlight uses `:root` for **dark mode** (default) and `:root[data-theme="light"]` for light mode. The `--sl-color-white`/`--sl-color-black` variables are **semantic**, not literal: "black" = background extreme, "white" = foreground extreme. In light mode, `--sl-color-black` must be a light color (background) and `--sl-color-white` must be dark (text). All Starlight base styles are in `@layer starlight.base`, so unlayered custom CSS has higher specificity.

### GitHub Actions permissions override is total, not additive
Setting `permissions:` at workflow level replaces ALL defaults. If you only set `packages: read`, `contents: read` is lost and `actions/checkout` fails with "repository not found" on private repos. Always include `contents: read` explicitly.
