---
name: tdx-tickets
description: |
  This skill should be used when the user asks about TeamDynamix tickets, incidents,
  service requests, or work orders. Common queries include "create a ticket", "find my
  open tickets", "ticket status", "assign a ticket", "update a support ticket", "submit
  a service request", "check on my help desk request", "search for work orders".
---

# TeamDynamix Ticket Management

## Prerequisite

Before using any ticket tools, load the tickets domain:

```
tdx_navigate({ domain: "tickets" })
```

This is safe to call if the domain is already loaded — it will return immediately.

## Tools

### tdx_tickets_search

Search tickets with filters. Returns summary lines — use `tdx_tickets_get` for full details.

**Parameters:**
- `searchText` (string, optional) — Free-text search across ticket fields
- `statusIds` (number[], optional) — Filter by status IDs
- `priorityIds` (number[], optional) — Filter by priority IDs
- `typeIds` (number[], optional) — Filter by type IDs
- `responsibilityGroupIds` (number[], optional) — Filter by responsible group IDs
- `requestorUids` (string[], optional) — Filter by requestor UIDs
- `maxResults` (number, optional) — Maximum results to return

### tdx_tickets_get

Get full ticket details by ID including description, custom attributes, and attachments.

**Parameters:**
- `ticketId` (number, required) — The ticket ID to retrieve

### tdx_tickets_create

Create a new ticket. If `typeId` is omitted, the server will prompt interactively for ticket type selection.

**Parameters:**
- `title` (string, required) — Ticket title
- `description` (string, optional) — HTML description
- `typeId` (number, optional) — Ticket type ID (interactive selection if omitted)
- `statusId` (number, optional) — Status ID
- `priorityId` (number, optional) — Priority ID
- `accountId` (number, optional) — Department/account ID
- `requestorEmail` (string, optional) — Requestor email
- `requestorUid` (string, optional) — Requestor UID (GUID)
- `responsibleUid` (string, optional) — Responsible person UID
- `responsibleGroupId` (number, optional) — Responsible group ID
- `sourceId` (number, optional) — Ticket source ID
- `formId` (number, optional) — Form ID

### tdx_tickets_update

Update an existing ticket. Only provided fields are changed.

**Parameters:**
- `ticketId` (number, required) — Ticket ID to update
- `title` (string, optional)
- `description` (string, optional)
- `statusId` (number, optional)
- `priorityId` (number, optional)
- `typeId` (number, optional)
- `responsibleUid` (string, optional)
- `responsibleGroupId` (number, optional)

## Common Workflows

### Find and View a Ticket

```
1. tdx_navigate({ domain: "tickets" })
2. tdx_tickets_search({ searchText: "password reset" })
3. tdx_tickets_get({ ticketId: 12345 })
```

### Create a Ticket

```
1. tdx_navigate({ domain: "tickets" })
2. tdx_tickets_create({
     title: "New laptop request",
     description: "<p>User needs a new laptop for remote work</p>",
     requestorEmail: "user@example.edu"
   })
   // Server will prompt for ticket type if typeId is not provided
```

### Update Ticket Status or Assignment

```
1. tdx_navigate({ domain: "tickets" })
2. tdx_tickets_update({
     ticketId: 12345,
     statusId: 2,
     responsibleUid: "abc-123-def"
   })
```

## Response Formatting

- **Search results**: Present as a table with columns: ID, Status, Title, Requestor
- **Get details**: Show structured summary with key fields (ID, title, status, priority, description, dates, assignee)
- **Create/Update**: Confirm with ticket ID and title
