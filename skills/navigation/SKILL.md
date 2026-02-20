---
name: tdx-navigation
description: |
  This skill should be used when the user wants to interact with TeamDynamix (TDX),
  including tickets, assets, people, or knowledge base articles. It must be activated
  before any domain-specific TDX tools are available. Common queries include "search
  for a TDX ticket", "look up an asset in TeamDynamix", "find a person in TDX",
  "create a KB article", "check TDX status", "open an ITSM ticket".
---

# TeamDynamix Navigation

This MCP server uses **lazy-loaded domain tools**. Before using any domain-specific tools, you must first load the domain using `tdx_navigate`.

## Required First Step

**Always call `tdx_navigate` before using any domain tools.** This is a hard requirement — domain tools do not exist until their domain is loaded.

```
tdx_navigate({ domain: "tickets" })       // loads ticket tools
tdx_navigate({ domain: "assets" })        // loads asset tools
tdx_navigate({ domain: "people" })        // loads people tools
tdx_navigate({ domain: "knowledge_base" }) // loads KB tools
```

## Available Domains

| Domain | Navigate Value | Tools Loaded |
|---|---|---|
| Tickets | `tickets` | `tdx_tickets_search`, `tdx_tickets_get`, `tdx_tickets_create`, `tdx_tickets_update` |
| Assets | `assets` | `tdx_assets_search`, `tdx_assets_get`, `tdx_assets_create` |
| People | `people` | `tdx_people_search`, `tdx_people_get` |
| Knowledge Base | `knowledge_base` | `tdx_kb_search`, `tdx_kb_get_article`, `tdx_kb_create_article`, `tdx_kb_get_categories` |

## Checking Server Status

Use `tdx_status` (always available, no navigation needed) to check:
- Which domains are currently loaded
- Which TDX app IDs are configured (ticketing, assets, KB)

## Workflow Pattern

1. Call `tdx_navigate` with the relevant domain
2. Use the domain-specific tools (see domain skills for details)
3. If you need tools from another domain, call `tdx_navigate` again for that domain

Domains only need to be loaded once per session — calling `tdx_navigate` for an already-loaded domain is a no-op.

## Error Handling

- **Authentication errors**: Check that `TDX_BASE_URL`, `TDX_BEID`, and `TDX_WEB_SERVICES_KEY` are configured
- **"Domain not found"**: Use the exact domain values from the table above (e.g., `knowledge_base` not `kb`)
- **Tool not found**: You likely forgot to call `tdx_navigate` first
