import { describe, expect, it } from "vitest";
import {
  PortalIdentityError,
  verifyPortalIdentity,
  type PortalIdentity,
} from "./portal-identity.js";

const KEY = "test-signing-key-please-rotate";

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** Mirror of the portal-side signer (csc-ai-portal src/mcp/identity.ts). */
async function sign(
  key: string,
  identity: PortalIdentity,
  expiresInMs = 300_000,
): Promise<string> {
  const payload = JSON.stringify({
    ...identity,
    iat: Date.now(),
    exp: Date.now() + expiresInMs,
  });
  const payloadBytes = new TextEncoder().encode(payload);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, payloadBytes);
  return `${b64url(payloadBytes)}.${b64url(new Uint8Array(sig))}`;
}

const USER: PortalIdentity = {
  email: "jdoe42@example.edu",
  name: "Jane Doe",
  oid: "00000000-0000-0000-0000-000000000001",
};

describe("verifyPortalIdentity", () => {
  it("round-trips a validly signed identity", async () => {
    const token = await sign(KEY, USER);
    const identity = await verifyPortalIdentity(token, KEY);
    expect(identity).toEqual(USER);
  });

  it("returns null when no header is supplied", async () => {
    expect(await verifyPortalIdentity(null, KEY)).toBeNull();
    expect(await verifyPortalIdentity("", KEY)).toBeNull();
  });

  it("rejects a token signed with a different key", async () => {
    const token = await sign("some-other-key", USER);
    await expect(verifyPortalIdentity(token, KEY)).rejects.toThrow(
      PortalIdentityError,
    );
  });

  it("rejects a tampered payload", async () => {
    const token = await sign(KEY, USER);
    const [, sig] = token.split(".");
    const forged = JSON.stringify({
      ...USER,
      email: "attacker@example.edu",
      iat: Date.now(),
      exp: Date.now() + 300_000,
    });
    const forgedToken = `${b64url(new TextEncoder().encode(forged))}.${sig}`;
    await expect(verifyPortalIdentity(forgedToken, KEY)).rejects.toThrow(
      PortalIdentityError,
    );
  });

  it("rejects an expired token (beyond clock skew)", async () => {
    const token = await sign(KEY, USER, -120_000); // expired 2 min ago
    await expect(verifyPortalIdentity(token, KEY)).rejects.toThrow(/expired/);
  });

  it("rejects a present header when no key is configured", async () => {
    const token = await sign(KEY, USER);
    await expect(verifyPortalIdentity(token, undefined)).rejects.toThrow(
      /not configured/,
    );
  });

  it("rejects garbage tokens", async () => {
    await expect(verifyPortalIdentity("not-a-token", KEY)).rejects.toThrow(
      PortalIdentityError,
    );
    await expect(verifyPortalIdentity("a.b", KEY)).rejects.toThrow(
      PortalIdentityError,
    );
  });
});
