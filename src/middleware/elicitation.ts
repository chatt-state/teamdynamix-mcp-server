/**
 * Elicitation helper for interactive form-based input collection.
 *
 * Wraps the MCP SDK's elicitInput() with graceful fallback for clients
 * that don't support elicitation.
 */

import { mcpServer } from "../server.js";

/**
 * Presents a dropdown selection to the user via MCP elicitation.
 *
 * The SDK's enum schema only supports string values, so numeric IDs are
 * serialized to strings for the form and parsed back on selection.
 *
 * Returns the selected numeric ID, or null if the client doesn't support
 * elicitation or the user declines.
 */
export async function elicitChoice(
  message: string,
  fieldName: string,
  fieldTitle: string,
  options: { id: number; name: string }[],
): Promise<number | null> {
  if (options.length === 0) return null;

  try {
    const result = await mcpServer.server.elicitInput({
      mode: "form",
      message,
      requestedSchema: {
        type: "object",
        properties: {
          [fieldName]: {
            type: "string",
            title: fieldTitle,
            enum: options.map((o) => String(o.id)),
            enumNames: options.map((o) => o.name),
          },
        },
        required: [fieldName],
      },
    });

    if (result.action === "accept" && result.content) {
      return Number(result.content[fieldName]);
    }
    return null;
  } catch {
    // Client doesn't support elicitation — return null so callers can
    // fall back to requiring the ID parameter directly.
    return null;
  }
}
