/**
 * MCP tool definitions for people operations.
 *
 * Defines the schemas and metadata for people-related MCP tools
 * such as searching and retrieving person records.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all people-related tools with the MCP server.
 * Tools follow the `tdx_people_*` naming convention.
 */
export function registerPeopleTools(server: McpServer): void {
  server.registerTool(
    "tdx_people_search",
    {
      title: "Search People",
      description:
        "Search TeamDynamix people. Returns summary data — use tdx_people_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across people fields"),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active status"),
        isEmployee: z
          .boolean()
          .optional()
          .describe("Filter by employee status"),
        maxResults: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum results to return"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const searchParams = {
          SearchText: args.searchText,
          IsActive: args.isActive,
          IsEmployee: args.isEmployee,
          MaxResults: args.maxResults,
        };
        const people = await handlers.searchPeople(searchParams);
        const summary = people
          .map(
            (p) =>
              `${p.UID} — ${p.FullName ?? `${p.FirstName} ${p.LastName}`} (${p.PrimaryEmail ?? "no email"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                people.length === 0
                  ? "No people found matching the search criteria."
                  : `Found ${people.length} person(s):\n\n${summary}\n\nUse tdx_people_get for full details on any person.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_get",
    {
      title: "Get Person",
      description:
        "Get full person details by UID or username including contact info, attributes, and role.",
      inputSchema: {
        uidOrUsername: z
          .string()
          .describe("The person UID (GUID) or username to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const person = await handlers.getPerson(args.uidOrUsername);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(person, null, 2) },
          ],
        };
      });
    },
  );
}
