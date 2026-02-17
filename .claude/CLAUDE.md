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
