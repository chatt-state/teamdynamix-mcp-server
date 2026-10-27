/**
 * MCP tool definitions for group operations.
 *
 * Defines the schemas and metadata for group-related MCP tools.
 * Group membership drives ticket routing and assignment, so the
 * member read/write tools are first-class alongside group CRUD.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  GroupCreateParams,
  GroupUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import { elicitChoice } from "../../middleware/elicitation.js";
import * as handlers from "./handlers.js";

/**
 * Resolves a group ID, falling back to interactive selection when it
 * was omitted. Returns the resolved numeric ID, or `null` if the user
 * declined / the client cannot elicit (caller returns an isError).
 */
async function resolveGroupId(
  groupId: number | undefined,
): Promise<number | null> {
  if (groupId !== undefined) {
    return groupId;
  }
  const groups = await handlers.searchGroups({ IsActive: true });
  return elicitChoice(
    "Select a group:",
    "groupId",
    "Group",
    groups.map((g) => ({ id: g.ID, name: g.Name })),
  );
}

/** Standard isError response used when a group ID could not be resolved. */
function groupRequiredError(): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: "Group selection is required. Provide groupId or try again.",
      },
    ],
    isError: true as const,
  };
}

/**
 * Registers all group-related tools with the MCP server.
 * Tools follow the `tdx_groups_*` naming convention.
 */
export function registerGroupTools(server: McpServer): void {
  server.registerTool(
    "tdx_groups_search",
    {
      title: "Search Groups",
      description:
        "Search TeamDynamix groups. Returns summary data — use tdx_groups_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Text to match against group names"),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active status"),
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
        const groups = await handlers.searchGroups({
          SearchText: args.searchText,
          IsActive: args.isActive,
          MaxResults: args.maxResults,
        });
        const summary = groups
          .map(
            (g) =>
              `#${g.ID} ${g.Name} (${g.IsActive ? "Active" : "Inactive"})${
                g.Description ? ` — ${g.Description}` : ""
              }`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                groups.length === 0
                  ? "No groups found matching the search criteria."
                  : `Found ${groups.length} group(s):\n\n${summary}\n\nUse tdx_groups_get for full details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_groups_get",
    {
      title: "Get Group",
      description: "Get full group details by ID.",
      inputSchema: {
        groupId: z
          .number()
          .int()
          .positive()
          .describe("The group ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const group = await handlers.getGroup(args.groupId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(group, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_groups_get_members",
    {
      title: "Get Group Members",
      description:
        "List the members of a group. Useful for reviewing ticket routing/assignment pools.",
      inputSchema: {
        groupId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Group ID — omit to select interactively"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const resolvedGroupId = await resolveGroupId(args.groupId);
        if (resolvedGroupId === null) {
          return groupRequiredError();
        }
        const members = await handlers.getGroupMembers(resolvedGroupId);
        const summary = members
          .map(
            (m) =>
              `${m.UID} ${m.FullName ?? "Unknown"}${
                m.IsPrimary ? " (Primary)" : ""
              }`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                members.length === 0
                  ? `Group #${resolvedGroupId} has no members.`
                  : `Group #${resolvedGroupId} has ${members.length} member(s):\n\n${summary}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_groups_create",
    {
      title: "Create Group",
      description: "Create a new group.",
      inputSchema: {
        name: z.string().describe("Name of the group"),
        description: z
          .string()
          .optional()
          .describe("Description of the group"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the group is active (defaults to active)"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const data: GroupCreateParams = {
          Name: args.name,
          Description: args.description,
          IsActive: args.isActive,
        };
        const group = await handlers.createGroup(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Group #${group.ID} created: ${group.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_groups_update",
    {
      title: "Update Group",
      description: "Update an existing group.",
      inputSchema: {
        groupId: z
          .number()
          .int()
          .positive()
          .describe("Group ID to update"),
        name: z.string().optional().describe("Updated group name"),
        description: z
          .string()
          .optional()
          .describe("Updated description"),
        isActive: z
          .boolean()
          .optional()
          .describe("Updated active status"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { groupId, ...fields } = args;
        const data: GroupUpdateParams = {};
        if (fields.name !== undefined) data.Name = fields.name;
        if (fields.description !== undefined)
          data.Description = fields.description;
        if (fields.isActive !== undefined) data.IsActive = fields.isActive;
        const group = await handlers.updateGroup(groupId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Group #${group.ID} updated: ${group.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_groups_add_member",
    {
      title: "Add Group Member",
      description:
        "Add a person to a group by their user UID. Group membership drives ticket routing/assignment.",
      inputSchema: {
        uid: z
          .string()
          .describe("The user UID (person GUID) to add to the group"),
        groupId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Group ID — omit to select interactively"),
        isPrimary: z
          .boolean()
          .optional()
          .describe("Whether this is the member's primary group"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const resolvedGroupId = await resolveGroupId(args.groupId);
        if (resolvedGroupId === null) {
          return groupRequiredError();
        }
        await handlers.addGroupMember(
          resolvedGroupId,
          args.uid,
          args.isPrimary,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `User ${args.uid} added to group #${resolvedGroupId}.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_groups_remove_member",
    {
      title: "Remove Group Member",
      description: "Remove a person from a group by their user UID.",
      inputSchema: {
        uid: z
          .string()
          .describe("The user UID (person GUID) to remove from the group"),
        groupId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Group ID — omit to select interactively"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const resolvedGroupId = await resolveGroupId(args.groupId);
        if (resolvedGroupId === null) {
          return groupRequiredError();
        }
        await handlers.removeGroupMember(resolvedGroupId, args.uid);
        return {
          content: [
            {
              type: "text" as const,
              text: `User ${args.uid} removed from group #${resolvedGroupId}.`,
            },
          ],
        };
      });
    },
  );
}
