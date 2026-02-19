/**
 * Shared TdxClient instance for the MCP server.
 *
 * Creates a singleton TdxClient from the @chatt-state/node-teamdynamix
 * library, configured from environment variables via getConfig().
 */

import { TdxClient } from "@chatt-state/node-teamdynamix";
import { getConfig } from "./config.js";

/** Singleton TdxClient instance, lazily initialized. */
let clientInstance: TdxClient | null = null;

/**
 * Returns the shared TdxClient instance.
 * Lazily creates the client on first call using the validated config.
 */
export function getTdxClient(): TdxClient {
  if (clientInstance === null) {
    const config = getConfig();
    clientInstance = new TdxClient({
      baseUrl: config.baseUrl,
      auth: {
        type: "admin",
        beid: config.beid,
        webServicesKey: config.webServicesKey,
      },
      ticketingAppId: config.ticketingAppId,
      assetsAppId: config.assetsAppId,
      kbAppId: config.kbAppId,
      rateLimitBuffer: config.rateLimitBuffer,
    });
  }
  return clientInstance;
}

/**
 * Resets the singleton client instance.
 * Primarily useful for testing.
 */
export function resetTdxClient(): void {
  clientInstance = null;
}
