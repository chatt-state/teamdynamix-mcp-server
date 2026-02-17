import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from "vitest";
import { TokenManager } from "./token-manager.js";

/**
 * Creates a fake JWT token with the given expiry (unix seconds).
 * The signature is bogus but that's fine — TokenManager doesn't verify it.
 */
function createFakeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp, sub: "test-user" }))
    .toString("base64url");
  const signature = "fake-signature";
  return `${header}.${payload}.${signature}`;
}

/** Valid GUID values for testing (not real credentials). */
const VALID_GUID_1 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_GUID_2 = "12345678-abcd-ef01-2345-6789abcdef01";

/** Set required env vars so getConfig() succeeds. */
function setRequiredEnv(): void {
  process.env.TDX_BASE_URL = "https://example.teamdynamix.com";
  process.env.TDX_BEID = VALID_GUID_1;
  process.env.TDX_WEB_SERVICES_KEY = VALID_GUID_2;
}

function clearTdxEnv(): void {
  delete process.env.TDX_BASE_URL;
  delete process.env.TDX_BEID;
  delete process.env.TDX_WEB_SERVICES_KEY;
}

describe("TokenManager", () => {
  let manager: TokenManager;
  let fetchMock: MockInstance;
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Snapshot and set env
    envSnapshot = {
      TDX_BASE_URL: process.env.TDX_BASE_URL,
      TDX_BEID: process.env.TDX_BEID,
      TDX_WEB_SERVICES_KEY: process.env.TDX_WEB_SERVICES_KEY,
    };
    setRequiredEnv();

    // Reset the config singleton so it picks up our env
    const { resetConfig } = await import("../config.js");
    resetConfig();

    // Mock global fetch
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    manager = new TokenManager();
  });

  afterEach(async () => {
    manager.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Restore env
    for (const [k, v] of Object.entries(envSnapshot)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }

    const { resetConfig } = await import("../config.js");
    resetConfig();
  });

  function mockSuccessfulAuth(token: string): void {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(token),
    });
  }

  function mockFailedAuth(status: number): void {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      text: () => Promise.resolve("error"),
    });
  }

  describe("getValidToken", () => {
    it("should authenticate and return a token on first call", async () => {
      const exp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
      const fakeToken = createFakeJwt(exp);
      mockSuccessfulAuth(fakeToken);

      const token = await manager.getValidToken();

      expect(token).toBe(fakeToken);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.teamdynamix.com/TDWebApi/api/auth/loginadmin",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            BEID: VALID_GUID_1,
            WebServicesKey: VALID_GUID_2,
          }),
        }),
      );
    });

    it("should return cached token on subsequent calls without re-authenticating", async () => {
      const exp = Math.floor(Date.now() / 1000) + 86400;
      const fakeToken = createFakeJwt(exp);
      mockSuccessfulAuth(fakeToken);

      const token1 = await manager.getValidToken();
      const token2 = await manager.getValidToken();

      expect(token1).toBe(fakeToken);
      expect(token2).toBe(fakeToken);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("should re-authenticate when token is expired", async () => {
      // First token expires in 1 second
      const exp1 = Math.floor(Date.now() / 1000) + 1;
      const token1 = createFakeJwt(exp1);
      mockSuccessfulAuth(token1);

      await manager.getValidToken();
      expect(fetchMock).toHaveBeenCalledOnce();

      // Advance time past expiry
      vi.advanceTimersByTime(2000);

      // Second token expires in 24 hours
      const exp2 = Math.floor(Date.now() / 1000) + 86400;
      const token2 = createFakeJwt(exp2);
      mockSuccessfulAuth(token2);

      const result = await manager.getValidToken();
      expect(result).toBe(token2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should deduplicate concurrent authentication requests", async () => {
      const exp = Math.floor(Date.now() / 1000) + 86400;
      const fakeToken = createFakeJwt(exp);
      mockSuccessfulAuth(fakeToken);

      // Fire off two concurrent requests
      const [token1, token2] = await Promise.all([
        manager.getValidToken(),
        manager.getValidToken(),
      ]);

      expect(token1).toBe(fakeToken);
      expect(token2).toBe(fakeToken);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe("forceRefresh", () => {
    it("should re-authenticate even when a valid token exists", async () => {
      const exp1 = Math.floor(Date.now() / 1000) + 86400;
      const token1 = createFakeJwt(exp1);
      mockSuccessfulAuth(token1);

      await manager.getValidToken();

      const exp2 = Math.floor(Date.now() / 1000) + 86400;
      const token2 = createFakeJwt(exp2);
      mockSuccessfulAuth(token2);

      const refreshed = await manager.forceRefresh();

      expect(refreshed).toBe(token2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("isAuthenticated", () => {
    it("should return false when no token has been acquired", () => {
      expect(manager.isAuthenticated()).toBe(false);
    });

    it("should return true after successful authentication", async () => {
      const exp = Math.floor(Date.now() / 1000) + 86400;
      mockSuccessfulAuth(createFakeJwt(exp));

      await manager.getValidToken();

      expect(manager.isAuthenticated()).toBe(true);
    });

    it("should return false after token expires", async () => {
      const exp = Math.floor(Date.now() / 1000) + 1;
      mockSuccessfulAuth(createFakeJwt(exp));

      await manager.getValidToken();
      expect(manager.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(manager.isAuthenticated()).toBe(false);
    });

    it("should return false after dispose", async () => {
      const exp = Math.floor(Date.now() / 1000) + 86400;
      mockSuccessfulAuth(createFakeJwt(exp));

      await manager.getValidToken();
      manager.dispose();

      expect(manager.isAuthenticated()).toBe(false);
    });
  });

  describe("getTokenExpiry", () => {
    it("should return null when no token exists", () => {
      expect(manager.getTokenExpiry()).toBeNull();
    });

    it("should return the expiry date from the JWT exp claim", async () => {
      const exp = Math.floor(Date.now() / 1000) + 86400;
      mockSuccessfulAuth(createFakeJwt(exp));

      await manager.getValidToken();

      const expiry = manager.getTokenExpiry();
      expect(expiry).toBeInstanceOf(Date);
      expect(expiry!.getTime()).toBe(exp * 1000);
    });
  });

  describe("handleUnauthorized", () => {
    it("should re-authenticate and return a new token", async () => {
      const exp1 = Math.floor(Date.now() / 1000) + 86400;
      mockSuccessfulAuth(createFakeJwt(exp1));
      await manager.getValidToken();

      const exp2 = Math.floor(Date.now() / 1000) + 86400;
      const newToken = createFakeJwt(exp2);
      mockSuccessfulAuth(newToken);

      const result = await manager.handleUnauthorized();

      expect(result).toBe(newToken);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("authentication failure", () => {
    it("should throw an error with HTTP status on non-200 response", async () => {
      mockFailedAuth(401);

      await expect(manager.getValidToken()).rejects.toThrow(
        /TDX authentication failed with HTTP status 401/,
      );
    });

    it("should throw on 500 server error", async () => {
      mockFailedAuth(500);

      await expect(manager.getValidToken()).rejects.toThrow(
        /TDX authentication failed with HTTP status 500/,
      );
    });

    it("should throw on empty token response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      });

      await expect(manager.getValidToken()).rejects.toThrow(
        /empty token/,
      );
    });
  });

  describe("JWT decoding", () => {
    it("should correctly extract the exp claim from a JWT", async () => {
      const exp = 1700000000;
      mockSuccessfulAuth(createFakeJwt(exp));

      await manager.getValidToken();

      const expiry = manager.getTokenExpiry();
      expect(expiry).toBeInstanceOf(Date);
      expect(expiry!.getTime()).toBe(exp * 1000);
    });

    it("should handle a JWT without an exp claim gracefully", async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({ sub: "test-user" }),
      ).toString("base64url");
      const tokenWithoutExp = `${header}.${payload}.fake-signature`;

      mockSuccessfulAuth(tokenWithoutExp);

      const token = await manager.getValidToken();
      expect(token).toBe(tokenWithoutExp);
      expect(manager.getTokenExpiry()).toBeNull();
    });
  });

  describe("automatic refresh timer", () => {
    it("should schedule a refresh 1 hour before expiry", async () => {
      // Token expires in 24 hours
      const exp = Math.floor(Date.now() / 1000) + 86400;
      mockSuccessfulAuth(createFakeJwt(exp));

      await manager.getValidToken();
      expect(fetchMock).toHaveBeenCalledOnce();

      // Prepare the refresh token
      const exp2 = Math.floor(Date.now() / 1000) + 86400 * 2;
      mockSuccessfulAuth(createFakeJwt(exp2));

      // Advance to just past the 23-hour mark and run only the next timer
      await vi.advanceTimersByTimeAsync(23 * 60 * 60 * 1000 + 100);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
