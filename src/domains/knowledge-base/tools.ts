/**
 * MCP tool definitions for knowledge base operations.
 *
 * Defines the schemas and metadata for KB article-related MCP tools
 * such as searching and retrieving articles.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolHandler } from "../../middleware/error-handler.js";
import { elicitChoice } from "../../middleware/elicitation.js";
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
        searchText: z
          .string()
          .optional()
          .describe("Free-text search across article fields"),
        isPublished: z
          .boolean()
          .optional()
          .describe("Filter by published status"),
        isPublic: z
          .boolean()
          .optional()
          .describe("Filter by public status"),
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
          IsPublished: args.isPublished,
          IsPublic: args.isPublic,
          MaxResults: args.maxResults,
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
        articleId: z
          .number()
          .int()
          .positive()
          .describe("The KB article ID to retrieve"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        const article = await handlers.getArticle(args.articleId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(article, null, 2) },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_kb_create_article",
    {
      title: "Create KB Article",
      description:
        "Create a new knowledge base article. Use tdx_kb_get_categories first to find a valid CategoryID.",
      inputSchema: {
        title: z.string().describe("Article title"),
        body: z.string().describe("Article body content (HTML supported)"),
        categoryId: z
          .number()
          .int()
          .optional()
          .describe("Category ID — omit to select interactively, or use tdx_kb_get_categories to find valid IDs"),
        summary: z.string().optional().describe("Short summary of the article"),
        isPublished: z
          .boolean()
          .optional()
          .describe("Whether to publish immediately (default: false)"),
        isPublic: z
          .boolean()
          .optional()
          .describe("Whether the article is publicly visible"),
        order: z
          .number()
          .int()
          .optional()
          .describe("Display order within the category"),
      },
    },
    async (args) => {
      return wrapToolHandler(async () => {
        let resolvedCategoryId: number;
        if (args.categoryId !== undefined) {
          resolvedCategoryId = args.categoryId;
        } else {
          const categories = await handlers.getCategories();
          const selected = await elicitChoice(
            "Select a category for the new KB article:",
            "categoryId",
            "Category",
            categories.map((c) => ({ id: c.ID, name: c.Name })),
          );
          if (selected === null) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Category selection is required. Provide categoryId or use tdx_kb_get_categories to find valid IDs.",
                },
              ],
              isError: true as const,
            };
          }
          resolvedCategoryId = selected;
        }
        const article = await handlers.createArticle({
          Title: args.title,
          Body: args.body,
          CategoryID: resolvedCategoryId,
          Summary: args.summary,
          IsPublished: args.isPublished,
          IsPublic: args.isPublic,
          Order: args.order,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Created KB article #${article.ID}: "${article.Title}" (${article.IsPublished ? "Published" : "Draft"})\n\n${JSON.stringify(article, null, 2)}`,
            },
          ],
        };
      });
    },
  );

  server.registerTool(
    "tdx_kb_get_categories",
    {
      title: "Get KB Categories",
      description:
        "List all knowledge base categories. Use this to find CategoryID values when creating articles.",
      inputSchema: {},
    },
    async () => {
      return wrapToolHandler(async () => {
        const categories = await handlers.getCategories();
        const summary = categories
          .map(
            (c) =>
              `#${c.ID} ${c.Name}${c.ParentID ? ` (parent: ${c.ParentID})` : ""}${c.Description ? ` — ${c.Description}` : ""}`,
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                categories.length === 0
                  ? "No KB categories found."
                  : `Found ${categories.length} category/categories:\n\n${summary}`,
            },
          ],
        };
      });
    },
  );
}
