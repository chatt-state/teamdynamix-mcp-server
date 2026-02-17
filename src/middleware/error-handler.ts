/**
 * Error handler middleware for MCP tool execution.
 *
 * Provides consistent error formatting and logging for all
 * tool handler errors, mapping TDX API errors to MCP error responses.
 */

import { TdxApiError } from "../http/client.js";

/** MCP-formatted error response shape. */
export interface McpErrorResponse {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
}

/**
 * Formats an error into an MCP-compatible error response object.
 *
 * - TdxApiError: includes status code and message
 * - Error: includes the error message
 * - Unknown: generic fallback message
 */
export function formatMcpError(error: unknown): McpErrorResponse {
  let text: string;

  if (error instanceof TdxApiError) {
    text = `TDX API Error (${error.status} ${error.statusText}): ${error.message}`;
  } else if (error instanceof Error) {
    text = `Error: ${error.message}`;
  } else {
    text = "An unexpected error occurred";
  }

  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

/**
 * Wraps a tool handler function with error handling.
 *
 * On success, returns the handler's result. On failure, catches the error
 * and returns an MCP-formatted error response.
 */
export async function wrapToolHandler<T>(
  handler: () => Promise<T>,
): Promise<T | McpErrorResponse> {
  try {
    return await handler();
  } catch (error: unknown) {
    return formatMcpError(error);
  }
}
