---
name: tdx-knowledge-base
description: |
  This skill should be used when the user asks about TeamDynamix knowledge base articles
  or documentation. Common queries include "search the KB", "find a knowledge article",
  "create documentation", "write a how-to article", "find instructions for", "look up
  a FAQ", "browse KB categories".
---

# TeamDynamix Knowledge Base

## Prerequisite

Before using any KB tools, load the knowledge_base domain:

```
tdx_navigate({ domain: "knowledge_base" })
```

This is safe to call if the domain is already loaded — it will return immediately.

## Tools

### tdx_kb_search

Search KB articles. Returns summary lines — use `tdx_kb_get_article` for full content.

**Parameters:**
- `searchText` (string, optional) — Free-text search across article fields
- `isPublished` (boolean, optional) — Filter by published status
- `isPublic` (boolean, optional) — Filter by public visibility
- `maxResults` (number, optional) — Maximum results to return

### tdx_kb_get_article

Get full article details including body content, tags, custom attributes, and attachments.

**Parameters:**
- `articleId` (number, required) — The KB article ID to retrieve

### tdx_kb_create_article

Create a new KB article. If `categoryId` is omitted, the server will prompt interactively. Use `tdx_kb_get_categories` first to find valid category IDs.

**Parameters:**
- `title` (string, required) — Article title
- `body` (string, required) — Article body content (HTML supported)
- `categoryId` (number, optional) — Category ID (interactive selection if omitted)
- `summary` (string, optional) — Short summary
- `isPublished` (boolean, optional) — Publish immediately (default: false)
- `isPublic` (boolean, optional) — Publicly visible
- `order` (number, optional) — Display order within category

### tdx_kb_get_categories

List all KB categories. Use this to find `categoryId` values for creating articles.

**Parameters:** None

## Common Workflows

### Search and Read an Article

```
1. tdx_navigate({ domain: "knowledge_base" })
2. tdx_kb_search({ searchText: "VPN setup" })
3. tdx_kb_get_article({ articleId: 42 })
```

### Create a New Article

```
1. tdx_navigate({ domain: "knowledge_base" })
2. tdx_kb_get_categories()  // find the right category
3. tdx_kb_create_article({
     title: "How to Connect to VPN",
     body: "<h2>Steps</h2><ol><li>Open the VPN client...</li></ol>",
     categoryId: 15,
     summary: "Instructions for connecting to the campus VPN",
     isPublished: true,
     isPublic: true
   })
```

### Browse Categories

```
1. tdx_navigate({ domain: "knowledge_base" })
2. tdx_kb_get_categories()
```

## Response Formatting

- **Search results**: Present as a table with columns: ID, Status (Published/Draft), Title, Category
- **Get article**: Show title, summary, and full body content. Note the category and published status.
- **Create**: Confirm with article ID, title, and published status
- **Categories**: Present as a hierarchical list showing parent-child relationships
