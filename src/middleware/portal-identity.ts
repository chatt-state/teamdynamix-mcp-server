/**
 * Verified portal identity — the trusted alternative to model-supplied
 * attribution.
 *
 * The ChSCC AI Portal (or any first-party MCP client that shares the
 * PORTAL_IDENTITY_KEY secret) sends an `X-Portal-User` header on every MCP
 * request:
 *
 *   base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, key))
 *
 * with payload { email, name, oid, iat, exp } (exp = unix ms). The Worker
 * verifies the signature and expiry, then threads the identity into tool
 * registration so tickets_create / tickets_reply attribute the REAL user
 * server-side — the model's own attribution arguments are ignored, which
 * makes spoofing (or hallucinating) an identity impossible.
 *
 * This module is deliberately the single verification seam: swapping the
 * bespoke HMAC token for an Entra-issued JWT (OBO flow + JWKS validation)
 * later only changes this file — the enforcement plumbing stays identical.
 *
 * Design notes:
 *  - ABSENT header  -> null identity (backward compatible: claude.ai
 *    connector clients and local stdio use keep the model-supplied path).
 *  - INVALID header -> throws PortalIdentityError (the Worker answers 401).
 *    A forged/expired token must never silently downgrade to the weaker
 *    model-supplied attribution.
 */

/** Verified identity of the human on whose behalf tools are being called. */
export interface PortalIdentity {
  /** Verified email / UPN, e.g. jdoe42@example.edu. */
  email: string;
  /** Display name, e.g. "Jane Doe". */
  name: string;
  /** Upstream IdP object id (Entra oid) — recorded for audit, unused by TDX. */
  oid?: string;
}

interface IdentityPayload extends PortalIdentity {
  /** Issued-at, unix ms. */
  iat: number;
  /** Expiry, unix ms. */
  exp: number;
}

/** Thrown for present-but-invalid identity headers. Worker answers 401. */
export class PortalIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalIdentityError";
  }
}

/** Small clock-skew allowance between the portal and this Worker. */
const CLOCK_SKEW_MS = 60_000;

function b64urlDecodeToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Verify an X-Portal-User header value. Returns the identity, or null when
 * `header` is null/empty (no identity supplied). Throws PortalIdentityError
 * on any present-but-invalid token, including when no key is configured —
 * an identity assertion we cannot verify must not be trusted OR ignored.
 */
export async function verifyPortalIdentity(
  header: string | null,
  signingKey: string | undefined,
): Promise<PortalIdentity | null> {
  if (!header) return null;
  if (!signingKey) {
    throw new PortalIdentityError(
      "X-Portal-User received but PORTAL_IDENTITY_KEY is not configured",
    );
  }

  const dot = header.indexOf(".");
  if (dot <= 0 || dot >= header.length - 1) {
    throw new PortalIdentityError("malformed identity token");
  }
  const payloadPart = header.slice(0, dot);
  const sigPart = header.slice(dot + 1);

  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = b64urlDecodeToBytes(payloadPart);
    sigBytes = b64urlDecodeToBytes(sigPart);
  } catch {
    throw new PortalIdentityError("undecodable identity token");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes.buffer as ArrayBuffer,
    payloadBytes.buffer as ArrayBuffer,
  );
  if (!valid) throw new PortalIdentityError("identity token signature invalid");

  let payload: IdentityPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as IdentityPayload;
  } catch {
    throw new PortalIdentityError("identity token payload is not JSON");
  }

  if (
    typeof payload.email !== "string" ||
    payload.email.length === 0 ||
    typeof payload.name !== "string" ||
    payload.name.length === 0 ||
    typeof payload.exp !== "number"
  ) {
    throw new PortalIdentityError("identity token payload incomplete");
  }
  if (payload.exp + CLOCK_SKEW_MS < Date.now()) {
    throw new PortalIdentityError("identity token expired");
  }

  return { email: payload.email, name: payload.name, oid: payload.oid };
}
