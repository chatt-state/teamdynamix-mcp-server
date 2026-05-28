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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getConfig, resetConfig } from "./config.js";
import { randomUUID } from "node:crypto";
// Static import so Wrangler's bundler can resolve it (dynamic import() fails in Workers)
import { register as registerTickets } from "./domains/tickets/index.js";

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

// ── Stateless auth codes (HMAC-signed, no Map needed across isolates) ────────

interface AuthCodePayload {
  clientId: string;
  redirectUri: string;
  expiresAt: number;
  codeChallenge?: string;
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - padded.length % 4) % 4));
}

// Encode auth data into a self-contained signed token so it works across CF isolates.
// Both parts are base64url (URL-safe characters only) to survive redirect round-trips.
async function createAuthCode(apiKey: string, data: AuthCodePayload): Promise<string> {
  const payload = JSON.stringify(data);
  const payloadPart = b64urlEncode(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigPart = b64urlEncode(String.fromCharCode(...new Uint8Array(sigBuf)));
  return payloadPart + "." + sigPart;
}

async function verifyAuthCode(apiKey: string, code: string): Promise<AuthCodePayload | null> {
  const dot = code.indexOf(".");
  if (dot < 0) return null;
  const payloadPart = code.slice(0, dot);
  const sigPart = code.slice(dot + 1);

  let payload: string;
  try { payload = b64urlDecode(payloadPart); } catch { return null; }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(b64urlDecode(sigPart), (c) => c.charCodeAt(0));
  } catch { return null; }

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, new TextEncoder().encode(payload));
  if (!valid) return null;

  const data = JSON.parse(payload) as AuthCodePayload;
  if (data.expiresAt < Date.now()) return null;
  return data;
}

async function sha256base64url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(Array.from(new Uint8Array(buf)).map((b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

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

async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge") ?? undefined;
  const responseType = url.searchParams.get("response_type");

  if (responseType !== "code") return oauthError("unsupported_response_type");
  if (!redirectUri) return oauthError("invalid_request");
  // Only allow the claude.ai MCP callback — reject all other origins.
  if (!redirectUri.startsWith("https://claude.ai/")) return oauthError("access_denied");

  // Build a self-contained signed auth code (no isolate-local Map needed).
  const code = await createAuthCode(env.MCP_API_KEY, {
    clientId,
    redirectUri,
    codeChallenge,
    expiresAt: Date.now() + 300_000, // 5 minutes
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
    const entry = await verifyAuthCode(env.MCP_API_KEY, code);
    if (!entry) return oauthError("invalid_grant");

    // Validate PKCE if the authorization request included a code_challenge.
    if (entry.codeChallenge) {
      const verifier = params.get("code_verifier");
      if (!verifier) return oauthError("invalid_grant");
      const computed = await sha256base64url(verifier);
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

// ── MCP request handler ───────────────────────────────────────────────────────

let envReady = false;

function initEnv(env: Env): void {
  if (envReady) return;
  process.env.TDX_BASE_URL = env.TDX_BASE_URL;
  process.env.TDX_BEID = env.TDX_BEID;
  process.env.TDX_WEB_SERVICES_KEY = env.TDX_WEB_SERVICES_KEY;
  if (env.TDX_TICKETING_APP_ID) process.env.TDX_TICKETING_APP_ID = env.TDX_TICKETING_APP_ID;
  if (env.TDX_ASSETS_APP_ID) process.env.TDX_ASSETS_APP_ID = env.TDX_ASSETS_APP_ID;
  if (env.TDX_KB_APP_ID) process.env.TDX_KB_APP_ID = env.TDX_KB_APP_ID;
  if (env.TDX_LOG_LEVEL) process.env.TDX_LOG_LEVEL = env.TDX_LOG_LEVEL;
  process.env.TDX_MCP_TRANSPORT = "http";
  resetConfig();
  getConfig(); // validate early — throws if credentials are missing
  envReady = true;
}

/**
 * Creates a fresh McpServer + transport per MCP request.
 *
 * Using stateless mode (sessionIdGenerator: undefined) means the SDK's
 * validateSession() short-circuits immediately — no session ID or
 * _initialized checks. Every request is self-contained, which works
 * correctly even when CF routes requests to different isolates.
 */
async function dispatchMcp(request: Request): Promise<Response> {
  const server = new McpServer(
    { name: "teamdynamix-mcp-server", version: "0.1.0" },
    { capabilities: { tools: { listChanged: true } } },
  );
  registerTickets(server);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: validateSession() is a no-op
  });
  await server.connect(transport);
  return transport.handleRequest(request);
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
    if (pathname === "/.well-known/oauth-protected-resource") {
      return jsonResponse({
        resource: url.origin,
        authorization_servers: [url.origin],
        bearer_methods_supported: ["header"],
      });
    }
    if (pathname === "/.well-known/oauth-authorization-server") {
      return oauthDiscovery(url.origin);
    }
    if (pathname === "/oauth/register" && request.method === "POST") {
      return handleRegister(request);
    }
    if (pathname === "/oauth/authorize") {
      return handleAuthorize(request, env);
    }
    if (pathname === "/oauth/token" && request.method === "POST") {
      return handleToken(request, env);
    }

    // MCP endpoint — handles both "/" (claude.ai connector) and "/mcp" (direct access)
    if (pathname === "/" || pathname === "/mcp") {
      const authHeader = request.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token || token !== env.MCP_API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer realm="${url.origin}", error="invalid_token"`,
          },
        });
      }

      try {
        initEnv(env);
        return await dispatchMcp(request);
      } catch (err) {
        console.error("MCP request error:", err);
        return jsonResponse({ error: "Internal server error" }, 500);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
