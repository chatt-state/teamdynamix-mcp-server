/**
 * HTTP client for communicating with the TeamDynamix Web API.
 *
 * Provides a configured HTTP client with authentication headers,
 * retry logic, and error handling for all TDX API requests.
 */

import { getConfig } from "../config.js";
import { tokenManager } from "../auth/token-manager.js";
import { rateLimiter } from "../middleware/rate-limiter.js";

/** Minimum wait floor in milliseconds when retrying after 429. */
const RETRY_WAIT_FLOOR_MS = 5000;

/**
 * Error class for TDX API errors.
 * Carries the HTTP status, status text, endpoint, and a descriptive message.
 */
export class TdxApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly endpoint: string,
    message: string,
  ) {
    super(message);
    this.name = "TdxApiError";
  }
}

/**
 * Extracts a normalized endpoint key from a TDX API path.
 *
 * Strips the leading app ID prefix and any trailing numeric resource ID,
 * producing a stable key suitable for per-endpoint rate limit tracking.
 *
 * Examples:
 * - `/431/tickets/123` -> `tickets`
 * - `/431/tickets/search` -> `tickets/search`
 * - `/people/lookup` -> `people/lookup`
 * - `/auth/loginadmin` -> `auth/loginadmin`
 */
export function extractEndpointKey(path: string): string {
  // Remove leading slash
  const stripped = path.startsWith("/") ? path.slice(1) : path;
  const segments = stripped.split("/");

  // If the first segment is purely numeric, it is an app ID — drop it
  if (segments.length > 1 && /^\d+$/.test(segments[0])) {
    segments.shift();
  }

  // If the last segment is purely numeric, it is a resource ID — drop it
  if (segments.length > 1 && /^\d+$/.test(segments[segments.length - 1])) {
    segments.pop();
  }

  return segments.join("/");
}

/**
 * HTTP client for the TeamDynamix Web API.
 *
 * All domain handlers use this client to make authenticated requests.
 * Handles rate limiting, 401/429 retries, and structured error responses.
 */
export class TdxClient {
  /**
   * Performs an authenticated GET request.
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /**
   * Performs an authenticated POST request with an optional JSON body.
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /**
   * Performs an authenticated PUT request with an optional JSON body.
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  /**
   * Performs an authenticated PATCH request with a JSON Patch array body.
   */
  async patch<T>(path: string, body: unknown[]): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  /**
   * Performs an authenticated DELETE request.
   */
  async delete(path: string): Promise<void> {
    await this.request<undefined>("DELETE", path);
  }

  /**
   * Core request method that handles auth, rate limiting, retries, and errors.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const endpoint = extractEndpointKey(path);

    // Wait if rate limited
    await rateLimiter.checkLimit(endpoint);

    // Get auth token
    const token = await tokenManager.getValidToken();

    // Execute the request
    const response = await this.executeRequest(method, path, token, body);

    // Update rate limit state from response headers
    rateLimiter.updateFromResponse(endpoint, response.headers);

    // Handle 401 — retry once with a fresh token
    if (response.status === 401) {
      const newToken = await tokenManager.handleUnauthorized();
      const retryResponse = await this.executeRequest(method, path, newToken, body);
      rateLimiter.updateFromResponse(endpoint, retryResponse.headers);

      if (!retryResponse.ok) {
        await this.throwApiError(retryResponse, endpoint);
      }
      return this.parseResponse<T>(retryResponse);
    }

    // Handle 429 — wait and retry once
    if (response.status === 429) {
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      let waitMs = RETRY_WAIT_FLOOR_MS;
      if (resetHeader) {
        const resetTime = new Date(resetHeader).getTime();
        const now = Date.now();
        waitMs = Math.max(resetTime - now, 0) + RETRY_WAIT_FLOOR_MS;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));

      const retryToken = await tokenManager.getValidToken();
      const retryResponse = await this.executeRequest(method, path, retryToken, body);
      rateLimiter.updateFromResponse(endpoint, retryResponse.headers);

      if (!retryResponse.ok) {
        await this.throwApiError(retryResponse, endpoint);
      }
      return this.parseResponse<T>(retryResponse);
    }

    // Handle other errors
    if (!response.ok) {
      await this.throwApiError(response, endpoint);
    }

    return this.parseResponse<T>(response);
  }

  /**
   * Executes a single HTTP request against the TDX API.
   */
  private async executeRequest(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ): Promise<Response> {
    const config = getConfig();
    const url = `${config.baseUrl}/TDWebApi/api${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    return fetch(url, init);
  }

  /**
   * Parses the JSON response body, returning undefined for empty responses.
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (text.length === 0) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  /**
   * Reads the response body and throws a TdxApiError.
   */
  private async throwApiError(response: Response, endpoint: string): Promise<never> {
    let message: string;
    try {
      const text = await response.text();
      message = text || `HTTP ${response.status} ${response.statusText}`;
    } catch {
      message = `HTTP ${response.status} ${response.statusText}`;
    }

    throw new TdxApiError(
      response.status,
      response.statusText,
      endpoint,
      message,
    );
  }
}

/** Singleton TdxClient instance. */
export const tdxClient = new TdxClient();
