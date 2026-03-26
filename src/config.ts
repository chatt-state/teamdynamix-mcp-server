/**
 * Configuration management for the TeamDynamix MCP Server.
 *
 * Handles loading and validating environment variables and configuration
 * settings required for connecting to the TeamDynamix API.
 */

import { z } from "zod";

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Zod schema for the TDX MCP server configuration.
 * Validates all environment variable inputs and applies defaults.
 */
const tdxConfigSchema = z.object({
  baseUrl: z
    .string({ message: "TDX_BASE_URL is required" })
    .url("TDX_BASE_URL must be a valid URL")
    .startsWith("https://", "TDX_BASE_URL must start with https://"),

  beid: z
    .string({ message: "TDX_BEID is required" })
    .regex(GUID_REGEX, "TDX_BEID must be a valid GUID format"),

  webServicesKey: z
    .string({ message: "TDX_WEB_SERVICES_KEY is required" })
    .regex(GUID_REGEX, "TDX_WEB_SERVICES_KEY must be a valid GUID format"),

  ticketingAppId: z
    .number()
    .int("TDX_TICKETING_APP_ID must be an integer")
    .positive("TDX_TICKETING_APP_ID must be a positive integer")
    .optional(),

  assetsAppId: z
    .number()
    .int("TDX_ASSETS_APP_ID must be an integer")
    .positive("TDX_ASSETS_APP_ID must be a positive integer")
    .optional(),

  kbAppId: z
    .number()
    .int("TDX_KB_APP_ID must be an integer")
    .positive("TDX_KB_APP_ID must be a positive integer")
    .optional(),

  serviceCatalogAppId: z
    .number()
    .int("TDX_SERVICE_CATALOG_APP_ID must be an integer")
    .positive("TDX_SERVICE_CATALOG_APP_ID must be a positive integer")
    .optional(),

  transport: z.enum(["stdio", "http"]).default("stdio"),

  httpPort: z
    .number()
    .int("TDX_MCP_HTTP_PORT must be an integer")
    .min(1, "TDX_MCP_HTTP_PORT must be between 1 and 65535")
    .max(65535, "TDX_MCP_HTTP_PORT must be between 1 and 65535")
    .default(3000),

  httpHost: z.string().default("0.0.0.0"),

  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),

  preloadDomains: z.array(z.string()).default(["tickets"]),

  rateLimitBuffer: z.number().int().nonnegative().default(5),
});

/** Validated TDX MCP server configuration. */
export type TdxConfig = z.infer<typeof tdxConfigSchema>;

/**
 * Reads a raw configuration object from environment variables.
 * Handles parsing of numeric and comma-separated values.
 */
function readEnv(): Record<string, unknown> {
  const env = process.env;
  const raw: Record<string, unknown> = {};

  // Required strings
  if (env.TDX_BASE_URL !== undefined) raw.baseUrl = env.TDX_BASE_URL;
  if (env.TDX_BEID !== undefined) raw.beid = env.TDX_BEID;
  if (env.TDX_WEB_SERVICES_KEY !== undefined)
    raw.webServicesKey = env.TDX_WEB_SERVICES_KEY;

  // Optional integer app IDs
  if (env.TDX_TICKETING_APP_ID !== undefined)
    raw.ticketingAppId = parseInt(env.TDX_TICKETING_APP_ID, 10);
  if (env.TDX_ASSETS_APP_ID !== undefined)
    raw.assetsAppId = parseInt(env.TDX_ASSETS_APP_ID, 10);
  if (env.TDX_KB_APP_ID !== undefined)
    raw.kbAppId = parseInt(env.TDX_KB_APP_ID, 10);
  if (env.TDX_SERVICE_CATALOG_APP_ID !== undefined)
    raw.serviceCatalogAppId = parseInt(env.TDX_SERVICE_CATALOG_APP_ID, 10);

  // Transport settings
  if (env.TDX_MCP_TRANSPORT !== undefined)
    raw.transport = env.TDX_MCP_TRANSPORT;
  if (env.TDX_MCP_HTTP_PORT !== undefined)
    raw.httpPort = parseInt(env.TDX_MCP_HTTP_PORT, 10);
  if (env.TDX_MCP_HTTP_HOST !== undefined) raw.httpHost = env.TDX_MCP_HTTP_HOST;

  // Logging
  if (env.TDX_LOG_LEVEL !== undefined) raw.logLevel = env.TDX_LOG_LEVEL;

  // Preload domains: comma-separated string to array
  if (env.TDX_PRELOAD_DOMAINS !== undefined) {
    raw.preloadDomains = env.TDX_PRELOAD_DOMAINS.split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  }

  // Rate limit buffer
  if (env.TDX_RATE_LIMIT_BUFFER !== undefined)
    raw.rateLimitBuffer = parseInt(env.TDX_RATE_LIMIT_BUFFER, 10);

  return raw;
}

/**
 * Sanitizes a zod error message to ensure it does not leak sensitive values.
 * Strips any content after "received" that might contain the actual secret.
 */
function sanitizeErrorMessage(message: string): string {
  // Remove any quoted values that might appear in error messages
  return message.replace(/received ".*?"/g, "received [REDACTED]");
}

/**
 * Formats zod validation issues into a human-readable error string.
 * Sensitive fields (beid, webServicesKey) never have their values exposed.
 */
function formatErrors(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "config";
    return `  - ${path}: ${sanitizeErrorMessage(issue.message)}`;
  });
  return `TDX MCP Server configuration errors:\n${lines.join("\n")}`;
}

/**
 * Loads and validates the TDX MCP server configuration from environment variables.
 *
 * @returns A validated TdxConfig object.
 * @throws Error with a descriptive message listing all validation failures.
 */
export function loadConfig(): TdxConfig {
  const raw = readEnv();
  const result = tdxConfigSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(formatErrors(result.error));
  }

  return result.data;
}

/** Singleton config instance. */
let configInstance: TdxConfig | null = null;

/**
 * Returns the singleton configuration instance.
 * Loads and validates on first call; returns the cached instance thereafter.
 *
 * @returns The validated TdxConfig singleton.
 * @throws Error if configuration is invalid.
 */
export function getConfig(): TdxConfig {
  if (configInstance === null) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Resets the singleton config instance.
 * Primarily useful for testing.
 */
export function resetConfig(): void {
  configInstance = null;
}
