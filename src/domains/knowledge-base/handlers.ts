/**
 * Handler implementations for knowledge base MCP tools.
 *
 * Contains the business logic that executes when KB-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via tdxClient and returns typed results.
 */

import { tdxClient } from "../../http/client.js";
import { getConfig } from "../../config.js";
import type { TdxKbArticle, KbSearchParams } from "./types.js";

/**
 * Resolves the KB app ID from an explicit value or the global config.
 * Throws if neither is available.
 */
function getAppId(providedAppId?: number): number {
  const appId = providedAppId ?? getConfig().kbAppId;
  if (appId === undefined) {
    throw new Error(
      "No KB app ID provided and TDX_KB_APP_ID is not configured",
    );
  }
  return appId;
}

/**
 * Searches for KB articles matching the given parameters.
 * The `appId` field on params is used for routing; the rest
 * is forwarded to the TDX search endpoint as the POST body.
 */
export async function searchArticles(
  params: KbSearchParams & { appId?: number },
): Promise<TdxKbArticle[]> {
  const appId = getAppId(params.appId);
  const { appId: _, ...searchParams } = params;
  return tdxClient.post<TdxKbArticle[]>(
    `/${appId}/knowledgebase/search`,
    searchParams,
  );
}

/** Retrieves a single KB article by its ID. */
export async function getArticle(
  articleId: number,
  appId?: number,
): Promise<TdxKbArticle> {
  return tdxClient.get<TdxKbArticle>(
    `/${getAppId(appId)}/knowledgebase/${articleId}`,
  );
}
