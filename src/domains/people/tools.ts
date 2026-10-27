/**
 * MCP tool definitions for people operations.
 *
 * Defines the schemas and metadata for people-related MCP tools
 * such as searching, retrieving, creating, and updating person
 * records, plus group membership and active-status management.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  PersonCreateParams,
  PersonUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import type { McpErrorResponse } from "../../middleware/error-handler.js";
import type { PortalIdentity } from "../../middleware/portal-identity.js";
import {
  actingUserSchema,
  resolveActor,
  missingAttributionResult,
  attributionNote,
} from "../../middleware/attribution.js";
import { getConfig } from "../../config.js";
import * as handlers from "./handlers.js";

/**
 * Whether privileged people writes (security role, active status, group
 * membership) are currently permitted. Off by default — see src/config.ts.
 */
function privilegedPeopleWritesAllowed(): boolean {
  return getConfig().allowPrivilegedPeopleWrites;
}

/**
 * The forbidden-style result returned when a privileged people-write is
 * attempted while the TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES gate is off. The
 * attribution requirement is enforced separately and first; this is an
 * additional gate that stays closed by default even for an attributed caller.
 */
function privilegedWriteForbiddenResult(operation: string): McpErrorResponse {
  return {
    content: [
      {
        type: "text",
        text:
          `Forbidden: ${operation} is a privileged people-write and is ` +
          "disabled by default. It requires BOTH a verified identity / " +
          "attribution AND the server flag " +
          "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES=true. Ask a TDX administrator to " +
          "enable that flag; even then, the TDX service account should run " +
          "under a least-privilege role (defense in depth).",
      },
    ],
    isError: true,
  };
}

/** Loose shape of a user-group record as returned by the people/groups API. */
interface PersonGroupRecord {
  GroupID?: number;
  ID?: number;
  GroupName?: string;
  Name?: string;
  IsPrimary?: boolean;
  IsManager?: boolean;
}

/**
 * Registers all people-related tools with the MCP server.
 * Tools follow the `tdx_people_*` naming convention.
 */
export function registerPeopleTools(
  server: McpServer,
  identity: PortalIdentity | null = null,
): void {
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
        "Get full person details by UID including contact info, attributes, and role.",
      inputSchema: {
        uid: z
          .string()
          .describe("The person UID (GUID) to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const person = await handlers.getPerson(args.uid);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(person, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_get_by_username",
    {
      title: "Get Person by Username",
      description:
        "Look up a single person by their username (e.g. a network/login name).",
      inputSchema: {
        username: z
          .string()
          .describe("The username to look up"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const person = await handlers.getPersonByUsername(args.username);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(person, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_get_groups",
    {
      title: "Get Person Groups",
      description: "List the groups a person belongs to, by person UID.",
      inputSchema: {
        uid: z
          .string()
          .describe("The person UID (GUID) whose groups to list"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const groups = (await handlers.getPersonGroups(
          args.uid,
        )) as PersonGroupRecord[];
        const summary = groups
          .map((g) => {
            const id = g.GroupID ?? g.ID ?? "?";
            const name = g.GroupName ?? g.Name ?? "Unnamed group";
            const flags = [
              g.IsPrimary ? "primary" : null,
              g.IsManager ? "manager" : null,
            ]
              .filter(Boolean)
              .join(", ");
            return `#${id} ${name}${flags ? ` (${flags})` : ""}`;
          })
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                groups.length === 0
                  ? "This person belongs to no groups."
                  : `Found ${groups.length} group(s):\n\n${summary}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_add_to_group",
    {
      title: "Add Person to Group",
      description:
        "Add a person to a group by person UID and group ID.\n\n" +
        "ATTRIBUTION REQUIRED: this mutation runs through the shared TDX " +
        "service account, so supply the real name and email of the user making " +
        "the change (never guess) — it is recorded in the confirmation so the " +
        "change is human-attributable.\n\n" +
        "PRIVILEGED: group membership is a privileged write, disabled by " +
        "default. It is refused unless the server flag " +
        "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES=true, even with valid attribution.",
      inputSchema: {
        uid: z
          .string()
          .describe("The person UID (GUID) to add"),
        groupId: z
          .number()
          .int()
          .positive()
          .describe("The group ID to add the person to"),
        ...actingUserSchema(identity),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const actor = resolveActor(
          identity,
          args.actingUserFullName,
          args.actingUserEmail,
        );
        if (!actor) return missingAttributionResult();
        if (!privilegedPeopleWritesAllowed())
          return privilegedWriteForbiddenResult("changing group membership");
        await handlers.addPersonToGroup(args.uid, args.groupId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Person ${args.uid} added to group #${args.groupId}.${attributionNote(actor)}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_remove_from_group",
    {
      title: "Remove Person from Group",
      description:
        "Remove a person from a group by person UID and group ID.\n\n" +
        "ATTRIBUTION REQUIRED: this mutation runs through the shared TDX " +
        "service account, so supply the real name and email of the user making " +
        "the change (never guess) — it is recorded in the confirmation so the " +
        "change is human-attributable.\n\n" +
        "PRIVILEGED: group membership is a privileged write, disabled by " +
        "default. It is refused unless the server flag " +
        "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES=true, even with valid attribution.",
      inputSchema: {
        uid: z
          .string()
          .describe("The person UID (GUID) to remove"),
        groupId: z
          .number()
          .int()
          .positive()
          .describe("The group ID to remove the person from"),
        ...actingUserSchema(identity),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const actor = resolveActor(
          identity,
          args.actingUserFullName,
          args.actingUserEmail,
        );
        if (!actor) return missingAttributionResult();
        if (!privilegedPeopleWritesAllowed())
          return privilegedWriteForbiddenResult("changing group membership");
        await handlers.removePersonFromGroup(args.uid, args.groupId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Person ${args.uid} removed from group #${args.groupId}.${attributionNote(actor)}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_set_active",
    {
      title: "Set Person Active Status",
      description:
        "Deactivate or reactivate a person by UID. Set isActive=false to " +
        "deactivate, true to reactivate.\n\n" +
        "ATTRIBUTION REQUIRED: deactivating a person is destructive and runs " +
        "through the shared TDX service account, so supply the real name and " +
        "email of the user making the change (never guess) — it is recorded in " +
        "the confirmation so the change is human-attributable (FERPA).\n\n" +
        "PRIVILEGED: changing active status is a privileged write, disabled by " +
        "default. It is refused unless the server flag " +
        "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES=true, even with valid attribution.",
      inputSchema: {
        uid: z
          .string()
          .describe("The person UID (GUID) to update"),
        isActive: z
          .boolean()
          .describe("true to reactivate, false to deactivate"),
        ...actingUserSchema(identity),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const actor = resolveActor(
          identity,
          args.actingUserFullName,
          args.actingUserEmail,
        );
        if (!actor) return missingAttributionResult();
        if (!privilegedPeopleWritesAllowed())
          return privilegedWriteForbiddenResult(
            "changing a person's active status",
          );
        await handlers.setPersonActive(args.uid, args.isActive);
        return {
          content: [
            {
              type: "text" as const,
              text: `Person ${args.uid} ${args.isActive ? "reactivated" : "deactivated"}.${attributionNote(actor)}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_create",
    {
      title: "Create Person",
      description:
        "Create a new person (user or contact). Requires first name, last " +
        "name, and primary email.\n\n" +
        "ATTRIBUTION REQUIRED: this creates a directory record through the " +
        "shared TDX service account, so supply the real name and email of the " +
        "user making the change (never guess) — it is recorded in the " +
        "confirmation. NOTE: securityRoleId and isActive are privileged fields, " +
        "disabled by default — supplying either is refused unless the server " +
        "flag TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES=true, even with valid " +
        "attribution. Non-privileged fields (name, email, username, typeId, " +
        "defaultAccountId, isEmployee) always work with attribution.",
      inputSchema: {
        firstName: z.string().describe("First name"),
        lastName: z.string().describe("Last name"),
        primaryEmail: z.string().describe("Primary email address"),
        userName: z
          .string()
          .optional()
          .describe("Username / login name"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the account is active"),
        isEmployee: z
          .boolean()
          .optional()
          .describe("Whether the person is an employee"),
        typeId: z
          .number()
          .int()
          .optional()
          .describe("Person type ID"),
        defaultAccountId: z
          .number()
          .int()
          .optional()
          .describe("Default account/department ID"),
        securityRoleId: z
          .string()
          .optional()
          .describe(
            "Security role ID (GUID). PRIVILEGED: grants access rights — " +
              "only set on explicit request.",
          ),
        ...actingUserSchema(identity),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const actor = resolveActor(
          identity,
          args.actingUserFullName,
          args.actingUserEmail,
        );
        if (!actor) return missingAttributionResult();
        if (
          (args.securityRoleId !== undefined || args.isActive !== undefined) &&
          !privilegedPeopleWritesAllowed()
        )
          return privilegedWriteForbiddenResult(
            "setting securityRoleId or isActive",
          );
        const data: PersonCreateParams = {
          FirstName: args.firstName,
          LastName: args.lastName,
          PrimaryEmail: args.primaryEmail,
        };
        if (args.userName !== undefined) data.UserName = args.userName;
        if (args.isActive !== undefined) data.IsActive = args.isActive;
        if (args.isEmployee !== undefined) data.IsEmployee = args.isEmployee;
        if (args.typeId !== undefined) data.TypeID = args.typeId;
        if (args.defaultAccountId !== undefined)
          data.DefaultAccountID = args.defaultAccountId;
        if (args.securityRoleId !== undefined)
          data.SecurityRoleID = args.securityRoleId;
        const person = await handlers.createPerson(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Person created: ${person.UID} — ${person.FullName ?? `${person.FirstName} ${person.LastName}`} (${person.PrimaryEmail ?? "no email"})${attributionNote(actor)}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_people_update",
    {
      title: "Update Person",
      description:
        "Update an existing person by UID. Only the fields you provide are " +
        "changed.\n\n" +
        "ATTRIBUTION REQUIRED: this mutates a directory record through the " +
        "shared TDX service account, so supply the real name and email of the " +
        "user making the change (never guess) — it is recorded in the " +
        "confirmation. NOTE: securityRoleId and isActive are privileged fields, " +
        "disabled by default — supplying either is refused unless the server " +
        "flag TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES=true, even with valid " +
        "attribution. Non-privileged fields (name, email, username, typeId, " +
        "defaultAccountId, isEmployee) always work with attribution.",
      inputSchema: {
        uid: z
          .string()
          .describe("The person UID (GUID) to update"),
        firstName: z.string().optional().describe("Updated first name"),
        lastName: z.string().optional().describe("Updated last name"),
        primaryEmail: z
          .string()
          .optional()
          .describe("Updated primary email address"),
        userName: z.string().optional().describe("Updated username"),
        isActive: z
          .boolean()
          .optional()
          .describe("Updated active status (privileged)"),
        isEmployee: z
          .boolean()
          .optional()
          .describe("Updated employee status"),
        typeId: z.number().int().optional().describe("Updated person type ID"),
        defaultAccountId: z
          .number()
          .int()
          .optional()
          .describe("Updated default account/department ID"),
        securityRoleId: z
          .string()
          .optional()
          .describe(
            "Updated security role ID (GUID). PRIVILEGED: changes access " +
              "rights — only set on explicit request.",
          ),
        ...actingUserSchema(identity),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { uid, actingUserFullName, actingUserEmail, ...fields } = args;
        const actor = resolveActor(identity, actingUserFullName, actingUserEmail);
        if (!actor) return missingAttributionResult();
        if (
          (fields.securityRoleId !== undefined ||
            fields.isActive !== undefined) &&
          !privilegedPeopleWritesAllowed()
        )
          return privilegedWriteForbiddenResult(
            "setting securityRoleId or isActive",
          );
        const data: PersonUpdateParams = {};
        if (fields.firstName !== undefined) data.FirstName = fields.firstName;
        if (fields.lastName !== undefined) data.LastName = fields.lastName;
        if (fields.primaryEmail !== undefined)
          data.PrimaryEmail = fields.primaryEmail;
        if (fields.userName !== undefined) data.UserName = fields.userName;
        if (fields.isActive !== undefined) data.IsActive = fields.isActive;
        if (fields.isEmployee !== undefined) data.IsEmployee = fields.isEmployee;
        if (fields.typeId !== undefined) data.TypeID = fields.typeId;
        if (fields.defaultAccountId !== undefined)
          data.DefaultAccountID = fields.defaultAccountId;
        if (fields.securityRoleId !== undefined)
          data.SecurityRoleID = fields.securityRoleId;
        const person = await handlers.updatePerson(uid, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Person ${person.UID} updated.${attributionNote(actor)}`,
            },
          ],
        };
      });
    },
  );
}
