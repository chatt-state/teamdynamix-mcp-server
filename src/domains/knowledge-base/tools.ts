/**
 * MCP tool definitions for knowledge base operations.
 *
 * Defines the schemas and metadata for KB article-related MCP tools
 * such as searching and retrieving articles.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import * as handlers from "./handlers.js";

/**
 * Registers all knowledge-base-related tools with the MCP server.
 * Tools follow the `tdx_kb_*` naming convention.
 */
export function registerKbTools(server: McpServer): void {
  server.registerTool(
    "tdx_kb_search",
    {
      title: "Search KB Articles",
      description:
        "Search TeamDynamix knowledge base articles. Returns summary data — use tdx_kb_get_article for full details including body, attachments, and attributes.",
      inputSchema: {
        appId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("KB app ID. Uses default if omitted."),
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across article fields"),
        categoryId: z
          .number()
          .int()
          .optional()
          .describe("Filter by category ID"),
        status: z
          .number()
          .int()
          .optional()
          .describe("Filter by status value"),
        returnCount: z
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
          appId: args.appId,
          SearchText: args.searchText,
          CategoryID: args.categoryId,
          Status: args.status,
          ReturnCount: args.returnCount,
        };
        const articles = await handlers.searchArticles(searchParams);
        const summary = articles
          .map(
            (a) =>
              `#${a.ID} [${a.IsPublished ? "Published" : "Draft"}] ${a.Title} (${a.CategoryName ?? "Uncategorized"})`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                articles.length === 0
                  ? "No KB articles found matching the search criteria."
                  : `Found ${articles.length} article(s):\n\n${summary}\n\nUse tdx_kb_get_article for full details on any article.`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_kb_get_article",
    {
      title: "Get KB Article",
      description:
        "Get full knowledge base article details by ID including body, custom attributes, tags, and attachments.",
      inputSchema: {
        appId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("KB app ID. Uses default if omitted."),
        articleId: z
          .number()
          .int()
          .positive()
          .describe("The KB article ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const article = await handlers.getArticle(args.articleId, args.appId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(article, null, 2) },
          ],
        };
      });
    },
  );
}
