/**
 * Handler implementations for account/department MCP tools.
 *
 * Contains the business logic that executes when account-related
 * MCP tools are invoked by the client. Accounts (also called
 * departments) back the AccountID referenced when creating tickets.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Account,
  AccountSearch,
  AccountCreateParams,
  AccountUpdateParams,
} from "@chatt-state/node-teamdynamix";

/** Searches for accounts/departments matching the given parameters. */
export async function searchAccounts(
  params: AccountSearch,
): Promise<Account[]> {
  return getTdxClient().accounts.search(params);
}

/** Retrieves a single account/department by ID. */
export async function getAccount(id: number): Promise<Account> {
  return getTdxClient().accounts.get(id);
}

/** Creates a new account/department. */
export async function createAccount(
  params: AccountCreateParams,
): Promise<Account> {
  return getTdxClient().accounts.create(params);
}

/** Updates an existing account/department. */
export async function updateAccount(
  id: number,
  params: AccountUpdateParams,
): Promise<Account> {
  return getTdxClient().accounts.update(id, params);
}
