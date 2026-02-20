---
name: tdx-people
description: |
  This skill should be used when the user asks about people, users, or contacts in
  TeamDynamix. Common queries include "find a person", "look up who someone is",
  "search for an employee", "find someone's email address", "get a user's UID for
  assignment", "directory lookup".
---

# TeamDynamix People Directory

## Prerequisite

Before using any people tools, load the people domain:

```
tdx_navigate({ domain: "people" })
```

This is safe to call if the domain is already loaded — it will return immediately.

## Tools

### tdx_people_search

Search people by name, email, or other fields. Returns summary lines — use `tdx_people_get` for full profile.

**Parameters:**
- `searchText` (string, optional) — Free-text search across people fields
- `isActive` (boolean, optional) — Filter by active status
- `isEmployee` (boolean, optional) — Filter by employee status
- `maxResults` (number, optional) — Maximum results to return

### tdx_people_get

Get full person details by UID including contact info, attributes, and role.

**Parameters:**
- `uid` (string, required) — The person UID (GUID) to retrieve

## Common Workflows

### Find a Person by Name

```
1. tdx_navigate({ domain: "people" })
2. tdx_people_search({ searchText: "Jane Smith" })
3. tdx_people_get({ uid: "abc-123-def-456" })
```

### Find Active Employees

```
1. tdx_navigate({ domain: "people" })
2. tdx_people_search({ isActive: true, isEmployee: true, maxResults: 50 })
```

### Get a Person's UID for Ticket Assignment

When creating or updating tickets, you need a person's UID. Use this workflow:

```
1. tdx_navigate({ domain: "people" })
2. tdx_people_search({ searchText: "john.doe@example.edu" })
   // Note the UID from the results
3. tdx_navigate({ domain: "tickets" })  // if not already loaded
4. tdx_tickets_update({ ticketId: 123, responsibleUid: "<uid from step 2>" })
```

## Response Formatting

- **Search results**: Present as a table with columns: UID, Full Name, Email
- **Get details**: Show structured summary with key fields (name, email, department, title, active status)
