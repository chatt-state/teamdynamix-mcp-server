/**
 * Rate limiter middleware for TeamDynamix API requests.
 *
 * Implements request throttling to respect TDX API rate limits
 * and prevent service disruption.
 */

import { getConfig } from "../config.js";

/** Minimum wait floor in milliseconds when rate limited. */
const WAIT_FLOOR_MS = 5000;

/** Tracked rate limit state for a single endpoint. */
export interface RateLimitInfo {
  /** Maximum calls allowed in the current window. */
  limit: number;
  /** Remaining calls in the current window. */
  remaining: number;
  /** When the current window resets (Date). */
  resetAt: Date;
}

/**
 * Tracks per-endpoint rate limits using TDX response headers
 * and delays requests when capacity is exhausted.
 */
export class RateLimiter {
  private endpoints: Map<string, RateLimitInfo> = new Map();

  /**
   * Waits if the given endpoint has exhausted its rate limit capacity.
   *
   * If remaining calls are at or below the configured buffer, this method
   * delays until the reset window passes (plus a floor of 5 seconds).
   */
  async checkLimit(endpoint: string): Promise<void> {
    const info = this.endpoints.get(endpoint);
    if (!info) {
      return;
    }

    const buffer = getConfig().rateLimitBuffer;
    if (info.remaining > buffer) {
      return;
    }

    const now = Date.now();
    const resetMs = info.resetAt.getTime();
    const waitMs = Math.max(resetMs - now, 0) + WAIT_FLOOR_MS;

    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }

  /**
   * Parses rate limit headers from a TDX API response and updates
   * the tracked state for the given endpoint.
   *
   * Expected headers:
   * - `X-RateLimit-Limit` — max calls in window
   * - `X-RateLimit-Remaining` — calls left
   * - `X-RateLimit-Reset` — RFC 1123 datetime when window resets
   */
  updateFromResponse(endpoint: string, headers: Headers): void {
    const limitHeader = headers.get("X-RateLimit-Limit");
    const remainingHeader = headers.get("X-RateLimit-Remaining");
    const resetHeader = headers.get("X-RateLimit-Reset");

    if (limitHeader === null || remainingHeader === null || resetHeader === null) {
      return;
    }

    const limit = parseInt(limitHeader, 10);
    const remaining = parseInt(remainingHeader, 10);
    const resetAt = new Date(resetHeader);

    if (isNaN(limit) || isNaN(remaining) || isNaN(resetAt.getTime())) {
      return;
    }

    this.endpoints.set(endpoint, { limit, remaining, resetAt });
  }

  /**
   * Returns the current rate limit state for all tracked endpoints.
   */
  getStatus(): Record<string, RateLimitInfo> {
    const result: Record<string, RateLimitInfo> = {};
    for (const [key, info] of this.endpoints) {
      result[key] = { ...info };
    }
    return result;
  }

  /**
   * Returns the remaining call count for a specific endpoint,
   * or null if the endpoint has not been tracked yet.
   */
  getRemainingForEndpoint(endpoint: string): number | null {
    const info = this.endpoints.get(endpoint);
    return info ? info.remaining : null;
  }
}

/** Singleton RateLimiter instance. */
export const rateLimiter = new RateLimiter();
