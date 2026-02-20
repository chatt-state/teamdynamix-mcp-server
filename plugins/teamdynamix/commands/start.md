---
name: start
description: Initialize the TeamDynamix MCP connection and show available domains
---

Welcome to the **TeamDynamix MCP Server**.

First, check the server status to verify connectivity:

1. Call `tdx_status` to confirm the server is running and see which TDX apps are configured.

2. Based on the configured apps, these domains are available:

   | Domain | Navigate Command | What You Can Do |
   |---|---|---|
   | Tickets | `tdx_navigate({ domain: "tickets" })` | Search, view, create, and update service tickets |
   | Assets | `tdx_navigate({ domain: "assets" })` | Search, view, and create hardware/inventory assets |
   | People | `tdx_navigate({ domain: "people" })` | Look up users, contacts, and employees |
   | Knowledge Base | `tdx_navigate({ domain: "knowledge_base" })` | Search, read, and create KB articles |

3. To get started, tell me what you'd like to do — for example:
   - "Search for open tickets assigned to me"
   - "Look up asset with serial number ABC123"
   - "Find the KB article about VPN setup"
   - "Create a new ticket for a password reset"

**Important**: I'll automatically load the right domain tools before performing any action. You don't need to worry about the navigation step.
