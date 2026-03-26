# TeamDynamix MCP Server

An [MCP](https://modelcontextprotocol.io) server that connects AI assistants to your [TeamDynamix](https://www.teamdynamix.com/) instance. Search and manage tickets, knowledge base articles, people, assets, projects, time entries, reports, service catalog, and custom attributes through natural language.

## Features

- **Decision-tree navigation** — only 2 tools load at startup; domain tools load on demand
- **9 domains** — Tickets, Knowledge Base, People, Assets, Projects, Time, Reports, Service Catalog, Attributes
- **38 tools** total across all domains
- **Interactive elicitation** — prompts for ticket type, asset status/form, KB category, time type, and service category when IDs aren't provided
- **Claude plugin** — skills and commands for guided workflows
- **Multiple transports** — stdio (default) and streamable HTTP

## Available Tools

### Always loaded
| Tool | Description |
|------|-------------|
| `tdx_navigate` | Load a domain tool set (tickets, knowledge_base, people, assets, projects, reports, time, service_catalog, attributes) |
| `tdx_status` | Server status and loaded domains |

### Tickets domain
| Tool | Description |
|------|-------------|
| `tdx_tickets_search` | Search tickets by text, status, priority, type, group |
| `tdx_tickets_get` | Get full ticket details by ID |
| `tdx_tickets_create` | Create a new ticket (interactive type selection) |
| `tdx_tickets_update` | Update an existing ticket |

### Knowledge Base domain
| Tool | Description |
|------|-------------|
| `tdx_kb_search` | Search KB articles |
| `tdx_kb_get_article` | Get full article content |
| `tdx_kb_create_article` | Create a new KB article (interactive category selection) |
| `tdx_kb_get_categories` | List all KB categories |

### People domain
| Tool | Description |
|------|-------------|
| `tdx_people_search` | Search people by name, email, or department |
| `tdx_people_get` | Get person details by UID |

### Assets domain
| Tool | Description |
|------|-------------|
| `tdx_assets_search` | Search assets/CIs |
| `tdx_assets_get` | Get asset details by ID |
| `tdx_assets_create` | Create a new asset (interactive status/form selection) |

### Projects domain
| Tool | Description |
|------|-------------|
| `tdx_projects_search` | Search projects by text, status, account |
| `tdx_projects_get` | Get full project details by ID |
| `tdx_projects_create` | Create a new project |
| `tdx_projects_update` | Update an existing project |

### Time domain
| Tool | Description |
|------|-------------|
| `tdx_time_search` | Search time entries by date range and resource |
| `tdx_time_get` | Get full time entry details by ID |
| `tdx_time_create` | Log a new time entry (interactive type selection) |
| `tdx_time_update` | Update an existing time entry |
| `tdx_time_delete` | Delete a time entry |
| `tdx_time_get_types` | List all available time types |

### Reports domain
| Tool | Description |
|------|-------------|
| `tdx_reports_search` | Search reports by name |
| `tdx_reports_get` | Get report metadata by ID |
| `tdx_reports_execute` | Execute a report and return data rows |

### Service Catalog domain
| Tool | Description |
|------|-------------|
| `tdx_services_search` | Search the service catalog |
| `tdx_services_get` | Get full service details by ID |
| `tdx_services_create` | Create a new service (interactive category selection) |
| `tdx_services_update` | Update an existing service |
| `tdx_services_search_offerings` | Search offerings within a service |
| `tdx_services_get_offering` | Get full offering details |
| `tdx_services_create_offering` | Create a new offering within a service |
| `tdx_services_update_offering` | Update an existing offering |
| `tdx_services_get_categories` | List all service categories |

### Attributes domain
| Tool | Description |
|------|-------------|
| `tdx_attributes_list` | List custom attribute definitions for a component |
| `tdx_attributes_get_choices` | Get picklist choices for an attribute |
| `tdx_attributes_create_choice` | Add a new picklist choice |
| `tdx_attributes_update_choice` | Update an existing picklist choice |
| `tdx_attributes_delete_choice` | Remove a picklist choice |

## Prerequisites

- Node.js 20+
- A TeamDynamix instance with API access enabled
- Admin service account credentials (BEID + Web Services Key)

### Finding your credentials

1. Log into **TDAdmin** at `https://yourinstance.teamdynamix.com/TDAdmin`
2. Go to **Organization Details** → **Security** section
3. Copy the **Web Services BEID** and **Web Services Key**
4. You need the "Add BE Administrators" permission to see these values

## Installation

### Claude Plugin Marketplace

Install as a Claude Code plugin with guided skills and workflows:

```
/plugin marketplace add chatt-state/teamdynamix-mcp-server
/plugin install teamdynamix@teamdynamix-mcp-server
```

Set the required environment variables:

```bash
export TDX_BASE_URL=https://yourinstance.teamdynamix.com
export TDX_BEID=your-beid-guid
export TDX_WEB_SERVICES_KEY=your-web-services-key
```

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "teamdynamix": {
      "command": "npx",
      "args": ["-y", "--registry", "https://npm.pkg.github.com", "@chatt-state/teamdynamix-mcp-server"],
      "env": {
        "TDX_BASE_URL": "https://yourinstance.teamdynamix.com",
        "TDX_BEID": "your-beid-guid",
        "TDX_WEB_SERVICES_KEY": "your-web-services-key"
      }
    }
  }
}
```

### Docker

```bash
docker run --rm -i \
  -e TDX_BASE_URL=https://yourinstance.teamdynamix.com \
  -e TDX_BEID=your-beid-guid \
  -e TDX_WEB_SERVICES_KEY=your-web-services-key \
  ghcr.io/chatt-state/teamdynamix-mcp-server:latest
```

### Docker MCP Gateway

The Docker image includes MCP Gateway metadata for auto-discovery:

```bash
docker mcp server enable teamdynamix-mcp-server \
  --image ghcr.io/chatt-state/teamdynamix-mcp-server:latest
```

### From source

```bash
git clone https://github.com/chatt-state/teamdynamix-mcp-server.git
cd teamdynamix-mcp-server
npm install
npm run build
```

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `TDX_BASE_URL` | Yes | Your TeamDynamix instance URL |
| `TDX_BEID` | Yes | API BEID (GUID format) |
| `TDX_WEB_SERVICES_KEY` | Yes | API Web Services Key (GUID format) |
| `TDX_TICKETING_APP_ID` | No | Ticketing app ID |
| `TDX_ASSETS_APP_ID` | No | Assets/CI app ID |
| `TDX_KB_APP_ID` | No | Knowledge Base app ID |
| `TDX_SERVICE_CATALOG_APP_ID` | No | Service Catalog app ID |
| `TDX_MCP_TRANSPORT` | No | `stdio` (default) or `http` |

## Usage

Once connected, ask your AI assistant things like:

- "Search for open tickets about VPN issues"
- "Look up the KB article about password resets"
- "Find all assets assigned to the IT department"
- "Create a ticket for a new laptop request"
- "Show me all active projects"
- "Log 2 hours against ticket #12345"
- "Run the monthly SLA report"
- "Search the service catalog for email services"
- "List the custom attributes on tickets"

The assistant will automatically load the relevant domain tools via `tdx_navigate` before executing searches.

## Architecture

The server uses a **decision-tree lazy loading** pattern:

1. On startup, only `tdx_navigate` and `tdx_status` are registered
2. When the AI calls `tdx_navigate("tickets")`, the tickets domain tools load dynamically
3. The server notifies the client via `tools/list_changed`
4. Subsequent calls use the newly registered domain tools

This keeps the initial tool footprint small — important for LLMs with limited tool context.

## Documentation

Full documentation at [chatt-state.github.io/teamdynamix-mcp-server](https://chatt-state.github.io/teamdynamix-mcp-server)

## Development

```bash
npm run build      # Compile TypeScript
npm run test       # Run tests (vitest)
npm run lint       # ESLint + format checks
npm run typecheck  # TypeScript type checking
```

## License

MIT
