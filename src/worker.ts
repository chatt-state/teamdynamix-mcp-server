/**
 * Cloudflare Workers entry point for the TeamDynamix MCP Server.
 *
 * Credentials are injected as Workers secrets and mapped into process.env
 * so the existing config.ts and domain code works without modification.
 *
 * Usage:
 *   wrangler secret put TDX_BASE_URL
 *   wrangler secret put TDX_BEID
 *   wrangler secret put TDX_WEB_SERVICES_KEY
 *   wrangler secret put TDX_TICKETING_APP_ID   (optional)
 *   wrangler deploy
 */

import { getConfig, resetConfig } from "./config.js";
import { mcpServer } from "./server.js";
import { domainRegistry, DOMAIN_NAMES, type DomainName } from "./domains/registry.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { handleMcpRequest } from "./transport/worker.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface Env {
  TDX_BASE_URL: string;
  TDX_BEID: string;
  TDX_WEB_SERVICES_KEY: string;
  TDX_TICKETING_APP_ID?: string;
  TDX_ASSETS_APP_ID?: string;
  TDX_KB_APP_ID?: string;
  TDX_LOG_LEVEL?: string;
}

let transport: StreamableHTTPServerTransport | null = null;
let initialized = false;

async function init(env: Env): Promise<void> {
  if (initialized) return;

  // Map Workers secrets → process.env for config.ts compatibility.
  process.env.TDX_BASE_URL = env.TDX_BASE_URL;
  process.env.TDX_BEID = env.TDX_BEID;
  process.env.TDX_WEB_SERVICES_KEY = env.TDX_WEB_SERVICES_KEY;
  if (env.TDX_TICKETING_APP_ID) process.env.TDX_TICKETING_APP_ID = env.TDX_TICKETING_APP_ID;
  if (env.TDX_ASSETS_APP_ID) process.env.TDX_ASSETS_APP_ID = env.TDX_ASSETS_APP_ID;
  if (env.TDX_KB_APP_ID) process.env.TDX_KB_APP_ID = env.TDX_KB_APP_ID;
  if (env.TDX_LOG_LEVEL) process.env.TDX_LOG_LEVEL = env.TDX_LOG_LEVEL;
  process.env.TDX_MCP_TRANSPORT = "http";
  process.env.TDX_PRELOAD_DOMAINS = "tickets";

  resetConfig();
  const config = getConfig();

  domainRegistry.setServer(mcpServer);
  for (const domain of config.preloadDomains) {
    if ((DOMAIN_NAMES as readonly string[]).includes(domain)) {
      await domainRegistry.loadDomain(domain as DomainName);
    }
  }

  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await mcpServer.connect(transport);
  initialized = true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "tdx-mcp" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname !== "/mcp") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await init(env);

      return handleMcpRequest(
        request,
        (req: IncomingMessage, res: ServerResponse) =>
          transport!.handleRequest(req, res),
      );
    } catch (err) {
      console.error("MCP request error:", err);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
