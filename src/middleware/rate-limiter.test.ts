import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { RateLimiter } from "./rate-limiter.js";

/** Valid GUID values for testing (not real credentials). */
const VALID_GUID_1 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_GUID_2 = "12345678-abcd-ef01-2345-6789abcdef01";

function setRequiredEnv(): void {
  process.env.TDX_BASE_URL = "https://example.teamdynamix.com";
  process.env.TDX_BEID = VALID_GUID_1;
  process.env.TDX_WEB_SERVICES_KEY = VALID_GUID_2;
}

function clearTdxEnv(): void {
  delete process.env.TDX_BASE_URL;
  delete process.env.TDX_BEID;
  delete process.env.TDX_WEB_SERVICES_KEY;
  delete process.env.TDX_RATE_LIMIT_BUFFER;
}

/** Creates a Headers object with rate limit headers. */
function makeRateLimitHeaders(
  limit: number,
  remaining: number,
  resetAt: Date,
): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(limit));
  headers.set("X-RateLimit-Remaining", String(remaining));
  headers.set("X-RateLimit-Reset", resetAt.toUTCString());
  return headers;
}

describe("RateLimiter", () => {
  let limiter: RateLimiter;
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(async () => {
    vi.useFakeTimers();

    envSnapshot = {
      TDX_BASE_URL: process.env.TDX_BASE_URL,
      TDX_BEID: process.env.TDX_BEID,
      TDX_WEB_SERVICES_KEY: process.env.TDX_WEB_SERVICES_KEY,
      TDX_RATE_LIMIT_BUFFER: process.env.TDX_RATE_LIMIT_BUFFER,
    };
    setRequiredEnv();

    const { resetConfig } = await import("../config.js");
    resetConfig();

    limiter = new RateLimiter();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();

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

  describe("updateFromResponse", () => {
    it("should parse rate limit headers correctly", () => {
      const resetAt = new Date(Date.now() + 60_000);
      const headers = makeRateLimitHeaders(100, 42, resetAt);

      limiter.updateFromResponse("tickets", headers);

      const status = limiter.getStatus();
      expect(status.tickets).toBeDefined();
      expect(status.tickets.limit).toBe(100);
      expect(status.tickets.remaining).toBe(42);
      // toUTCString() loses millisecond precision, so compare at second level
      expect(Math.floor(status.tickets.resetAt.getTime() / 1000)).toBe(
        Math.floor(resetAt.getTime() / 1000),
      );
    });

    it("should ignore headers when any rate limit header is missing", () => {
      const headers = new Headers();
      headers.set("X-RateLimit-Limit", "100");
      // Missing Remaining and Reset

      limiter.updateFromResponse("tickets", headers);

      expect(limiter.getRemainingForEndpoint("tickets")).toBeNull();
    });

    it("should ignore headers with non-numeric values", () => {
      const headers = new Headers();
      headers.set("X-RateLimit-Limit", "abc");
      headers.set("X-RateLimit-Remaining", "10");
      headers.set("X-RateLimit-Reset", "Wed, 28 Mar 2018 16:08:14 GMT");

      limiter.updateFromResponse("tickets", headers);

      expect(limiter.getRemainingForEndpoint("tickets")).toBeNull();
    });

    it("should ignore headers with invalid date", () => {
      const headers = new Headers();
      headers.set("X-RateLimit-Limit", "100");
      headers.set("X-RateLimit-Remaining", "10");
      headers.set("X-RateLimit-Reset", "not-a-date");

      limiter.updateFromResponse("tickets", headers);

      expect(limiter.getRemainingForEndpoint("tickets")).toBeNull();
    });
  });

  describe("checkLimit", () => {
    it("should resolve immediately for unknown endpoints", async () => {
      await limiter.checkLimit("unknown");
      // No error, resolves immediately
    });

    it("should resolve immediately when remaining is above buffer", async () => {
      const resetAt = new Date(Date.now() + 60_000);
      const headers = makeRateLimitHeaders(100, 50, resetAt);
      limiter.updateFromResponse("tickets", headers);

      await limiter.checkLimit("tickets");
      // No waiting, resolves immediately
    });

    it("should wait when remaining is 0", async () => {
      const resetAt = new Date(Date.now() + 10_000);
      const headers = makeRateLimitHeaders(100, 0, resetAt);
      limiter.updateFromResponse("tickets", headers);

      let resolved = false;
      const promise = limiter.checkLimit("tickets").then(() => {
        resolved = true;
      });

      // Should not resolve immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(false);

      // Advance past reset + 5s floor = 15s total
      await vi.advanceTimersByTimeAsync(15_000);
      await promise;
      expect(resolved).toBe(true);
    });

    it("should wait when remaining is at the buffer threshold", async () => {
      // Default buffer is 5
      const resetAt = new Date(Date.now() + 10_000);
      const headers = makeRateLimitHeaders(100, 5, resetAt);
      limiter.updateFromResponse("tickets", headers);

      let resolved = false;
      const promise = limiter.checkLimit("tickets").then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(15_000);
      await promise;
      expect(resolved).toBe(true);
    });

    it("should apply minimum 5s wait even if reset is in the past", async () => {
      const resetAt = new Date(Date.now() - 1000); // Already past
      const headers = makeRateLimitHeaders(100, 0, resetAt);
      limiter.updateFromResponse("tickets", headers);

      let resolved = false;
      const promise = limiter.checkLimit("tickets").then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(false);

      // 5s floor applies
      await vi.advanceTimersByTimeAsync(5_000);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return empty object when no endpoints are tracked", () => {
      expect(limiter.getStatus()).toEqual({});
    });

    it("should return status for all tracked endpoints", () => {
      const resetAt = new Date(Date.now() + 60_000);
      limiter.updateFromResponse(
        "tickets",
        makeRateLimitHeaders(100, 50, resetAt),
      );
      limiter.updateFromResponse(
        "people",
        makeRateLimitHeaders(200, 150, resetAt),
      );

      const status = limiter.getStatus();
      expect(Object.keys(status)).toHaveLength(2);
      expect(status.tickets.remaining).toBe(50);
      expect(status.people.remaining).toBe(150);
    });

    it("should return copies, not references", () => {
      const resetAt = new Date(Date.now() + 60_000);
      limiter.updateFromResponse(
        "tickets",
        makeRateLimitHeaders(100, 50, resetAt),
      );

      const status1 = limiter.getStatus();
      status1.tickets.remaining = 999;

      const status2 = limiter.getStatus();
      expect(status2.tickets.remaining).toBe(50);
    });
  });

  describe("getRemainingForEndpoint", () => {
    it("should return null for unknown endpoints", () => {
      expect(limiter.getRemainingForEndpoint("unknown")).toBeNull();
    });

    it("should return the remaining count for tracked endpoints", () => {
      const resetAt = new Date(Date.now() + 60_000);
      limiter.updateFromResponse(
        "tickets",
        makeRateLimitHeaders(100, 42, resetAt),
      );

      expect(limiter.getRemainingForEndpoint("tickets")).toBe(42);
    });
  });
});
