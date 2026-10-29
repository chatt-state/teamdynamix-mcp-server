/**
 * MCP tool definitions for account/department operations.
 *
 * Defines the schemas and metadata for account-related MCP tools.
 * search + get are the priority: they let the model resolve the
 * AccountID needed when creating tickets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AccountCreateParams,
  AccountUpdateParams,
} from "@chatt-state/node-teamdynamix";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all account/department-related tools with the MCP server.
 * Tools follow the `tdx_accounts_*` naming convention.
 */
export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "tdx_accounts_search",
    {
      title: "Search Accounts/Departments",
      description:
        "Search TeamDynamix accounts (departments). Use this to resolve the AccountID needed when creating tickets. Returns summary data — use tdx_accounts_get for full details.",
      inputSchema: {
        searchText: z
          .string()
          .optional()
          .describe("Text to match against the account/department name"),
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
        const accounts = await handlers.searchAccounts({
          SearchText: args.searchText,
          IsActive: args.isActive,
          MaxResults: args.maxResults,
        });
        const summary = accounts
          .map(
            (a) =>
              `#${a.ID} ${a.Name}${a.City ? ` — ${a.City}${a.State ? `, ${a.State}` : ""}` : ""} (${a.IsActive ? "Active" : "Inactive"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                accounts.length === 0
                  ? "No accounts/departments found matching the search criteria."
                  : `Found ${accounts.length} account(s)/department(s):\n\n${summary}\n\nUse tdx_accounts_get for details.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_accounts_get",
    {
      title: "Get Account/Department",
      description: "Get full account/department details by ID.",
      inputSchema: {
        accountId: z
          .number()
          .int()
          .positive()
          .describe("The account/department ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const account = await handlers.getAccount(args.accountId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(account, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_accounts_create",
    {
      title: "Create Account/Department",
      description: "Create a new account (department).",
      inputSchema: {
        name: z.string().describe("Name of the account/department"),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the account is active (defaults to active)"),
        address1: z.string().optional().describe("Street address line 1"),
        city: z.string().optional().describe("City"),
        state: z.string().optional().describe("State or province"),
        postalCode: z.string().optional().describe("Postal/ZIP code"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const data: AccountCreateParams = { Name: args.name };
        if (args.isActive !== undefined) data.IsActive = args.isActive;
        if (args.address1 !== undefined) data.Address1 = args.address1;
        if (args.city !== undefined) data.City = args.city;
        if (args.state !== undefined) data.State = args.state;
        if (args.postalCode !== undefined) data.PostalCode = args.postalCode;
        const account = await handlers.createAccount(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Account/department #${account.ID} created: ${account.Name}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_accounts_update",
    {
      title: "Update Account/Department",
      description: "Update an existing account (department).",
      inputSchema: {
        accountId: z
          .number()
          .int()
          .positive()
          .describe("The account/department ID to update"),
        name: z.string().optional().describe("Updated name"),
        isActive: z.boolean().optional().describe("Updated active status"),
        address1: z.string().optional().describe("Updated street address line 1"),
        city: z.string().optional().describe("Updated city"),
        state: z.string().optional().describe("Updated state or province"),
        postalCode: z.string().optional().describe("Updated postal/ZIP code"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const { accountId, ...fields } = args;
        const data: AccountUpdateParams = {};
        if (fields.name !== undefined) data.Name = fields.name;
        if (fields.isActive !== undefined) data.IsActive = fields.isActive;
        if (fields.address1 !== undefined) data.Address1 = fields.address1;
        if (fields.city !== undefined) data.City = fields.city;
        if (fields.state !== undefined) data.State = fields.state;
        if (fields.postalCode !== undefined) data.PostalCode = fields.postalCode;
        const account = await handlers.updateAccount(accountId, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Account/department #${account.ID} updated: ${account.Name}`,
            },
          ],
        };
      });
    },
  );
}
