# MCP TypeScript SDK Research

Research Date: 2026-02-17
SDK: @modelcontextprotocol/sdk (TypeScript)
Context7 Library ID: `/modelcontextprotocol/typescript-sdk`

## Overview

The Model Context Protocol TypeScript SDK provides a standardized way to build MCP servers that expose resources, tools, and prompts to LLM clients. The SDK handles JSON-RPC communication, schema validation, and transport layer abstraction.

## 1. Creating an MCP Server Instance

### Basic Server Initialization

```typescript
import { McpServer } from '@modelcontextprotocol/server';

const server = new McpServer({
    name: 'my-server',
    version: '1.0.0'
});
```

The server instance requires:
- `name`: Unique identifier for your server
- `version`: Semantic version string

## 2. Transport Layer Setup

The MCP SDK supports multiple transport mechanisms for different deployment scenarios.

### Stdio Transport (Local Process Integration)

Used for local, process-spawned integrations such as Claude Desktop or CLI tools. This transport uses standard input/output for bidirectional communication without requiring HTTP configuration.

```typescript
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';

const server = new McpServer({
    name: 'my-server',
    version: '1.0.0'
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Use Cases:**
- Claude Desktop integration
- CLI tools
- Local development
- Process-spawned servers

### HTTP/SSE Streamable Transport (Remote Server Integration)

Used for remote HTTP-based servers with Server-Sent Events (SSE) streaming support and session management.

```typescript
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { createMcpExpressApp } from '@modelcontextprotocol/express';

const server = new McpServer({
    name: 'my-server',
    version: '1.0.0'
});

const app = createMcpExpressApp();

// Stateful transport with session management
const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
});

await server.connect(transport);

app.post('/mcp', async (req, res) => {
    await transport.handleRequest(req, res, req.body);
});

app.listen(3000, () => {
    console.log('MCP server running on port 3000');
});
```

**Features:**
- Session management with unique session IDs
- SSE streaming for real-time updates
- Resumability support
- Stateful connections

### HTTP JSON Response Mode (No SSE)

For clients that don't support SSE streaming, you can disable streaming and return plain JSON responses:

```typescript
const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true  // Disables SSE, returns plain JSON
});
```

**Behavior:**
- Returns plain JSON responses to POST requests
- Rejects GET requests with 405 status
- No SSE streaming

## 3. Tool Registration

Tools are the primary mechanism for MCP clients to request server actions and represent the main integration point for LLMs.

### Tool Registration with Schema Validation

The SDK requires Zod schemas for input/output validation (as of v2):

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const server = new McpServer({
    name: 'my-server',
    version: '1.0.0'
});

server.registerTool(
    'calculate-bmi',
    {
        title: 'BMI Calculator',
        description: 'Calculate Body Mass Index',
        inputSchema: z.object({
            weightKg: z.number(),
            heightM: z.number()
        }),
        outputSchema: z.object({
            bmi: z.number()
        })
    },
    async ({ weightKg, heightM }) => {
        const output = { bmi: weightKg / (heightM * heightM) };
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(output)
            }],
            structuredContent: output
        };
    }
);
```

### High-Level Tool Registration API

Alternative shorthand syntax using `server.tool()`:

```typescript
server.tool(
    'tool-name',
    { param: z.string() },
    async ({ param }, extra) => {
        return {
            content: [{
                type: 'text',
                text: 'result'
            }]
        };
    }
);
```

### Tool with No Parameters

For tools that don't require input parameters:

```typescript
server.registerTool(
    'ping',
    {
        title: 'Ping',
        description: 'Health check endpoint',
        inputSchema: z.object({})  // Empty schema for no parameters
    },
    async () => {
        return {
            content: [{
                type: 'text',
                text: 'pong'
            }]
        };
    }
);
```

### Important Schema Requirements (v2)

**v2 requires full Zod schemas wrapped with `z.object()`**. Raw object shapes are no longer accepted:

```typescript
// BEFORE (v1) - Raw shape accepted ❌
server.tool('greet', { name: z.string() }, async ({ name }) => { ... });

// AFTER (v2) - Must wrap with z.object() ✅
server.registerTool('greet', {
    inputSchema: z.object({ name: z.string() })
}, async ({ name }) => { ... });
```

## 4. Dynamic Tool Registration

### Initial Registration

Tools can be registered at any time using `registerTool()`:

```typescript
// Register initial tools during server setup
server.registerTool('tool-1', config1, handler1);
server.registerTool('tool-2', config2, handler2);
```

### Adding Tools After Handshake

Tools can be registered dynamically after the initial client handshake. To notify clients of tool list changes, you must send a notification:

```typescript
// Add a new tool after server is running
server.registerTool('new-tool', config, handler);

// Notify clients that the tool list has changed
// (Client-side pattern shown for reference)
```

## 5. Tool List Change Notifications

### Server-Side: Sending Notifications

While the SDK documentation primarily shows client-side notification handling, servers should send `notifications/tools/list_changed` when the tool list is modified:

```typescript
// Pattern for notifying clients of tool list changes
// Server sends: notifications/tools/list_changed
// Clients can then call listTools() to refresh their tool cache
```

### Client-Side: Handling Notifications

Clients can handle tool list changes in two ways:

#### Manual Notification Handler

```typescript
import { Client } from '@modelcontextprotocol/client';

const client = new Client({
    name: 'my-client',
    version: '1.0.0'
});

// Manual handler for tool list changes
client.setNotificationHandler(
    'notifications/tools/list_changed',
    async () => {
        const { tools } = await client.listTools();
        console.log('Tools updated:', tools.map(t => t.name));
    }
);
```

#### Automatic List-Change Tracking

```typescript
const client = new Client(
    { name: 'my-client', version: '1.0.0' },
    {
        listChanged: {
            tools: {
                onChanged: (error, tools) => {
                    if (error) {
                        console.error('Failed to refresh tools:', error);
                        return;
                    }
                    console.log('Tools updated:', tools);
                }
            },
            prompts: {
                onChanged: (error, prompts) => {
                    console.log('Prompts updated:', prompts);
                }
            }
        }
    }
);
```

**Features:**
- Automatic server capability gating
- 300ms debouncing by default
- Auto-refresh on notification
- Error-first callbacks

**Important:** `listChanged` and `setNotificationHandler` are mutually exclusive per notification type. Using both for the same notification will cause the manual handler to override the automatic one.

### Other Notification Types

```typescript
// Handle server log messages
client.setNotificationHandler(
    'notifications/message',
    notification => {
        const { level, data } = notification.params;
        console.log(`[${level}]`, data);
    }
);

// Handle resource list changes
client.setNotificationHandler(
    'notifications/resources/list_changed',
    async () => {
        const { resources } = await client.listResources();
        console.log('Resources changed:', resources.length);
    }
);
```

## 6. Tool Handler Implementation

### Handler Function Signature

Tool handlers are async functions that receive validated input parameters and return structured output:

```typescript
async (inputParams: z.infer<typeof inputSchema>) => {
    // Handler logic
    return {
        content: ContentItem[],
        structuredContent?: OutputType
    };
}
```

### Input Validation

Input is automatically validated against the `inputSchema` before the handler is called. If validation fails, the SDK returns an error to the client.

### Return Format

Handlers must return an object with:

1. **content**: Array of content items (required)
   - Each item must have `type: 'text'`
   - Contains human-readable text representation

2. **structuredContent**: Typed output object (optional)
   - Validated against `outputSchema` if provided
   - Contains machine-readable structured data

```typescript
return {
    content: [
        {
            type: 'text',
            text: 'Human-readable result'
        }
    ],
    structuredContent: {
        // Typed object matching outputSchema
        field1: 'value1',
        field2: 42
    }
};
```

### Error Handling

Tool handlers should throw errors for exceptional cases. The SDK will catch and format them appropriately for the client:

```typescript
server.registerTool(
    'divide',
    {
        inputSchema: z.object({
            numerator: z.number(),
            denominator: z.number()
        }),
        outputSchema: z.object({ result: z.number() })
    },
    async ({ numerator, denominator }) => {
        if (denominator === 0) {
            throw new Error('Division by zero is not allowed');
        }

        const result = numerator / denominator;
        return {
            content: [{
                type: 'text',
                text: `Result: ${result}`
            }],
            structuredContent: { result }
        };
    }
);
```

## 7. Complete Server Example

Here's a complete example combining all patterns:

```typescript
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import * as z from 'zod/v4';

// Initialize server
const server = new McpServer({
    name: 'example-server',
    version: '1.0.0'
});

// Register initial tools
server.registerTool(
    'calculate-bmi',
    {
        title: 'BMI Calculator',
        description: 'Calculate Body Mass Index',
        inputSchema: z.object({
            weightKg: z.number(),
            heightM: z.number()
        }),
        outputSchema: z.object({ bmi: z.number() })
    },
    async ({ weightKg, heightM }) => {
        const bmi = weightKg / (heightM * heightM);
        return {
            content: [{
                type: 'text',
                text: `BMI: ${bmi.toFixed(2)}`
            }],
            structuredContent: { bmi }
        };
    }
);

// Choose transport based on deployment scenario
const useStdio = process.env.TRANSPORT === 'stdio';

if (useStdio) {
    // Stdio transport for local integration
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP server running on stdio');
} else {
    // HTTP/SSE transport for remote integration
    const app = createMcpExpressApp();

    const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
    });

    await server.connect(transport);

    app.post('/mcp', async (req, res) => {
        await transport.handleRequest(req, res, req.body);
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`MCP server running on port ${port}`);
    });
}

// Dynamic tool registration example
setTimeout(() => {
    server.registerTool(
        'greet',
        {
            title: 'Greet User',
            description: 'Generate a greeting message',
            inputSchema: z.object({
                name: z.string()
            }),
            outputSchema: z.object({
                greeting: z.string()
            })
        },
        async ({ name }) => {
            const greeting = `Hello, ${name}!`;
            return {
                content: [{
                    type: 'text',
                    text: greeting
                }],
                structuredContent: { greeting }
            };
        }
    );

    // Send notification to clients
    // (Notification mechanism would be implemented here)
}, 5000);
```

## 8. Key Takeaways for TDX MCP Server

### For Task #5 (MCP Server Foundation)

1. **Server Initialization**: Use `McpServer` with name and version
2. **Transport Selection**:
   - Use `StdioServerTransport` for Claude Desktop integration
   - Use `NodeStreamableHTTPServerTransport` for web-based integrations
3. **Dual Transport Support**: Server can be configured to support both transports via environment variables

### For Task #6 (Domain Registry/Lazy Loading)

1. **Dynamic Registration**: Tools can be registered at any time using `registerTool()`
2. **Schema Requirements**: All tools must use `z.object()` for input/output schemas (v2 requirement)
3. **Notification Pattern**: Implement `notifications/tools/list_changed` to notify clients when tools are added/removed
4. **Handler Pattern**: Handlers receive validated input and return `{ content, structuredContent }`
5. **Lazy Loading Strategy**:
   - Register core tools on startup
   - Register domain-specific tools on demand
   - Send notification after registration
   - Client automatically refreshes tool list

### Architecture Recommendations

1. **Domain Registry Pattern**:
   ```typescript
   class DomainRegistry {
       private loadedDomains = new Set<string>();

       async loadDomain(domain: string) {
           if (this.loadedDomains.has(domain)) return;

           // Load domain tools
           const tools = await import(`./domains/${domain}/tools`);

           // Register each tool
           for (const [name, config, handler] of tools) {
               server.registerTool(name, config, handler);
           }

           this.loadedDomains.add(domain);

           // Send notification
           this.notifyToolsChanged();
       }

       private notifyToolsChanged() {
           // Implement notification mechanism
       }
   }
   ```

2. **Tool Organization**:
   - Group tools by domain (Autotask, TDNext, shared utilities)
   - Use consistent naming: `{domain}_{entity}_{action}`
   - Implement lazy loading to reduce initial startup time

3. **Error Handling**:
   - Let handlers throw errors naturally
   - SDK handles error formatting
   - Log errors server-side for debugging

## 9. References

- SDK Repository: https://github.com/modelcontextprotocol/typescript-sdk
- Server Documentation: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md
- Client Documentation: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md
- Migration Guide: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration.md
- Context7 Library: /modelcontextprotocol/typescript-sdk
