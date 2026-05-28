/**
 * Cloudflare Workers entry point for the TeamDynamix MCP Server.
 *
 * Implements a minimal OAuth 2.0 Authorization Server (Authorization Code +
 * Client Credentials flows) so the Worker can be registered as a claude.ai
 * MCP connector. The actual TDX credentials are stored as Workers secrets and
 * never exposed via OAuth.
 *
 * Secrets required:
 *   wrangler secret put TDX_BASE_URL
 *   wrangler secret put TDX_BEID
 *   wrangler secret put TDX_WEB_SERVICES_KEY
 *   wrangler secret put MCP_API_KEY          # random secret, acts as bearer token
 *   wrangler secret put TDX_TICKETING_APP_ID  (optional)
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
  MCP_API_KEY: string;
}

// ── OAuth in-memory state (per isolate, short-lived) ──────────────────────────

interface AuthCodeEntry {
  clientId: string;
  redirectUri: string;
  expiresAt: number;
  codeChallenge?: string;
}

const authCodes = new Map<string, AuthCodeEntry>();
const registeredClients = new Map<string, { redirectUris: string[] }>();

// ── OAuth helpers ─────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function oauthError(error: string, status = 400): Response {
  return jsonResponse({ error }, status);
}

function oauthDiscovery(origin: string): Response {
  return jsonResponse({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    grant_types_supported: ["authorization_code", "client_credentials"],
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
  });
}

async function handleRegister(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = randomUUID();
  const redirectUris = (body.redirect_uris as string[] | undefined) ?? [];
  registeredClients.set(clientId, { redirectUris });
  return jsonResponse(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "client_credentials"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

function handleAuthorize(request: Request): Response {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge") ?? undefined;
  const responseType = url.searchParams.get("response_type");

  if (responseType !== "code") return oauthError("unsupported_response_type");
  if (!redirectUri) return oauthError("invalid_request");

  // Immediately issue an auth code — no user interaction needed for a service account.
  const code = randomUUID();
  authCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    expiresAt: Date.now() + 60_000,
  });

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  return Response.redirect(redirect.toString(), 302);
}

async function handleToken(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const grantType = params.get("grant_type");

  if (grantType === "authorization_code") {
    const code = params.get("code") ?? "";
    const entry = authCodes.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      authCodes.delete(code);
      return oauthError("invalid_grant");
    }
    authCodes.delete(code);

    // Validate PKCE if the authorization request included a code_challenge.
    if (entry.codeChallenge) {
      const verifier = params.get("code_verifier");
      if (!verifier) return oauthError("invalid_grant");
      const encoded = new TextEncoder().encode(verifier);
      const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
      const computed = btoa(String.fromCharCode(...new Uint8Array(hashBuf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      if (computed !== entry.codeChallenge) return oauthError("invalid_grant");
    }

    return jsonResponse({ access_token: env.MCP_API_KEY, token_type: "Bearer", expires_in: 86400 });
  }

  if (grantType === "client_credentials") {
    const secret =
      params.get("client_secret") ?? extractBasicPassword(request.headers.get("Authorization") ?? "");
    if (secret !== env.MCP_API_KEY) return oauthError("invalid_client", 401);
    return jsonResponse({ access_token: env.MCP_API_KEY, token_type: "Bearer", expires_in: 86400 });
  }

  return oauthError("unsupported_grant_type");
}

function extractBasicPassword(authHeader: string): string {
  if (!authHeader.startsWith("Basic ")) return "";
  const decoded = atob(authHeader.slice(6));
  const idx = decoded.indexOf(":");
  return idx >= 0 ? decoded.slice(idx + 1) : "";
}

// ── MCP server init ───────────────────────────────────────────────────────────

let transport: StreamableHTTPServerTransport | null = null;
let initialized = false;

async function init(env: Env): Promise<void> {
  if (initialized) return;

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

  transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await mcpServer.connect(transport);
  initialized = true;
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
        },
      });
    }

    // Health check (unauthenticated)
    if (pathname === "/health") {
      return jsonResponse({ status: "ok", service: "tdx-mcp" });
    }

    // OAuth endpoints (unauthenticated)
    if (pathname === "/.well-known/oauth-authorization-server") {
      return oauthDiscovery(url.origin);
    }
    if (pathname === "/oauth/register" && request.method === "POST") {
      return handleRegister(request);
    }
    if (pathname === "/oauth/authorize") {
      return handleAuthorize(request);
    }
    if (pathname === "/oauth/token" && request.method === "POST") {
      return handleToken(request, env);
    }

    // MCP endpoint — requires bearer token
    if (pathname === "/mcp") {
      const authHeader = request.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token || token !== env.MCP_API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer realm="${url.origin}/mcp", error="invalid_token"`,
          },
        });
      }

      try {
        await init(env);
        return handleMcpRequest(
          request,
          (req: IncomingMessage, res: ServerResponse) => transport!.handleRequest(req, res),
        );
      } catch (err) {
        console.error("MCP request error:", err);
        return jsonResponse({ error: "Internal server error" }, 500);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
