/**
 * Handler implementations for knowledge base MCP tools.
 *
 * Contains the business logic that executes when KB-related
 * MCP tools are invoked by the client. Each handler calls the
 * TDX API via the shared TdxClient and returns typed results.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  KBArticle,
  KBArticleSearch,
  KBArticleCreateParams,
  KBCategory,
} from "@chatt-state/node-teamdynamix";

/**
 * Searches for KB articles matching the given parameters.
 */
export async function searchArticles(
  params: KBArticleSearch,
): Promise<KBArticle[]> {
  return getTdxClient().knowledgeBase.search(params);
}

/** Retrieves a single KB article by its ID. */
export async function getArticle(articleId: number): Promise<KBArticle> {
  return getTdxClient().knowledgeBase.get(articleId);
}

/** Creates a new KB article. */
export async function createArticle(
  params: KBArticleCreateParams,
): Promise<KBArticle> {
  return getTdxClient().knowledgeBase.create(params);
}

/** Lists all KB categories. */
export async function getCategories(): Promise<KBCategory[]> {
  return getTdxClient().knowledgeBase.getCategories();
}
