/**
 * Token manager for TeamDynamix API authentication.
 *
 * Handles acquiring, caching, and refreshing bearer tokens
 * used to authenticate requests against the TDX Web API.
 */

import { getConfig } from "../config.js";

/** How long before expiry to proactively refresh (1 hour in ms). */
const REFRESH_BUFFER_MS = 60 * 60 * 1000;

/**
 * Decodes a JWT payload without verifying the signature.
 * Uses Node.js built-in base64url support (available in Node 20+).
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected 3 parts");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload) as Record<string, unknown>;
}

/**
 * Manages authentication tokens for the TeamDynamix Web API.
 *
 * Acquires JWT tokens via the admin login endpoint, caches them
 * in memory, and automatically refreshes before expiry.
 */
export class TokenManager {
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAuth: Promise<string> | null = null;

  /**
   * Returns a valid JWT token, authenticating if needed.
   *
   * If a valid cached token exists, it is returned immediately.
   * Otherwise, a new token is acquired from the TDX API.
   * Concurrent calls during authentication share the same request.
   */
  async getValidToken(): Promise<string> {
    if (this.token !== null && !this.isExpired()) {
      return this.token;
    }
    return this.authenticate();
  }

  /**
   * Forces re-authentication regardless of current token state.
   * Returns the newly acquired token.
   */
  async forceRefresh(): Promise<string> {
    this.clearToken();
    return this.authenticate();
  }

  /**
   * Checks whether we currently hold a non-expired token.
   */
  isAuthenticated(): boolean {
    return this.token !== null && !this.isExpired();
  }

  /**
   * Returns the expiry date of the current token, or null if no token is held.
   */
  getTokenExpiry(): Date | null {
    return this.tokenExpiry;
  }

  /**
   * Handles a 401 Unauthorized response by immediately re-authenticating.
   * Returns the new token for retry.
   */
  async handleUnauthorized(): Promise<string> {
    return this.forceRefresh();
  }

  /**
   * Clears the token from memory and cancels any scheduled refresh.
   * Should be called when shutting down to avoid leaking secrets.
   */
  dispose(): void {
    this.clearToken();
  }

  /**
   * Authenticates against the TDX admin login endpoint.
   * Deduplicates concurrent calls so only one HTTP request is made.
   */
  private async authenticate(): Promise<string> {
    if (this.pendingAuth !== null) {
      return this.pendingAuth;
    }

    this.pendingAuth = this.doAuthenticate();

    try {
      const token = await this.pendingAuth;
      return token;
    } finally {
      this.pendingAuth = null;
    }
  }

  /**
   * Performs the actual HTTP call to the TDX admin login endpoint.
   */
  private async doAuthenticate(): Promise<string> {
    const config = getConfig();
    const url = `${config.baseUrl}/TDWebApi/api/auth/loginadmin`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        BEID: config.beid,
        WebServicesKey: config.webServicesKey,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `TDX authentication failed with HTTP status ${response.status}`,
      );
    }

    const token = await response.text();

    if (!token || token.trim().length === 0) {
      throw new Error("TDX authentication returned an empty token");
    }

    const trimmedToken = token.trim();

    this.setToken(trimmedToken);

    return trimmedToken;
  }

  /**
   * Stores the token and sets up the automatic refresh timer.
   */
  private setToken(token: string): void {
    this.clearRefreshTimer();
    this.token = token;

    try {
      const payload = decodeJwtPayload(token);
      if (typeof payload.exp === "number") {
        this.tokenExpiry = new Date(payload.exp * 1000);
        this.scheduleRefresh();
      } else {
        this.tokenExpiry = null;
      }
    } catch {
      // If JWT decoding fails, keep the token but without expiry tracking
      this.tokenExpiry = null;
    }
  }

  /**
   * Schedules a proactive refresh 1 hour before the token expires.
   */
  private scheduleRefresh(): void {
    if (this.tokenExpiry === null) {
      return;
    }

    const msUntilRefresh =
      this.tokenExpiry.getTime() - Date.now() - REFRESH_BUFFER_MS;

    if (msUntilRefresh <= 0) {
      // Token is already within the refresh window or expired
      return;
    }

    this.refreshTimer = setTimeout(() => {
      void this.forceRefresh().catch(() => {
        // Proactive refresh failed; next getValidToken() call will retry
      });
    }, msUntilRefresh);

    // Allow the process to exit even if the timer is pending
    if (this.refreshTimer && typeof this.refreshTimer.unref === "function") {
      this.refreshTimer.unref();
    }
  }

  /**
   * Returns true if the current token is expired or missing.
   */
  private isExpired(): boolean {
    if (this.tokenExpiry === null) {
      // No expiry known; assume valid
      return false;
    }
    return Date.now() >= this.tokenExpiry.getTime();
  }

  /**
   * Clears the stored token and cancels any refresh timer.
   */
  private clearToken(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.clearRefreshTimer();
  }

  /**
   * Cancels the proactive refresh timer if one is scheduled.
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

/** Singleton TokenManager instance. */
export const tokenManager = new TokenManager();
