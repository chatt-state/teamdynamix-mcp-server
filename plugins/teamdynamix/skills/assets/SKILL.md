---
name: tdx-assets
description: |
  This skill should be used when the user asks about TeamDynamix assets, inventory,
  hardware, or equipment. Common queries include "find an asset", "look up a serial
  number", "asset tag", "search for a laptop", "register a new device", "create a
  computer asset", "find a workstation".
---

# TeamDynamix Asset Management

## Prerequisite

Before using any asset tools, load the assets domain:

```
tdx_navigate({ domain: "assets" })
```

This is safe to call if the domain is already loaded — it will return immediately.

## Tools

### tdx_assets_search

Search assets with filters. Returns summary lines — use `tdx_assets_get` for full details.

**Parameters:**
- `searchText` (string, optional) — Free-text search across asset fields
- `statusIds` (number[], optional) — Filter by status IDs
- `maxResults` (number, optional) — Maximum results to return

### tdx_assets_get

Get full asset details by ID including serial number, custom attributes, and attachments.

**Parameters:**
- `assetId` (number, required) — The asset ID to retrieve

### tdx_assets_create

Create a new asset. If `statusId` or `formId` are omitted, the server will prompt interactively.

**Parameters:**
- `name` (string, required) — Asset name
- `statusId` (number, optional) — Asset status ID (interactive selection if omitted)
- `formId` (number, optional) — Asset form ID (interactive selection if omitted)
- `serialNumber` (string, optional) — Serial number
- `tag` (string, optional) — Asset tag
- `locationId` (number, optional) — Location ID
- `owningCustomerId` (string, optional) — Owning customer UID
- `owningDepartmentId` (number, optional) — Owning department ID

## Common Workflows

### Find an Asset by Serial Number

```
1. tdx_navigate({ domain: "assets" })
2. tdx_assets_search({ searchText: "SN12345" })
3. tdx_assets_get({ assetId: 678 })
```

### Create a New Asset

```
1. tdx_navigate({ domain: "assets" })
2. tdx_assets_create({
     name: "Dell Latitude 5540",
     serialNumber: "ABC123XYZ",
     tag: "CHSCC-5540-001"
   })
   // Server will prompt for status and form if not provided
```

## Response Formatting

- **Search results**: Present as a table with columns: ID, Status, Name, Serial Number
- **Get details**: Show structured summary with key fields (ID, name, status, serial number, tag, location, owner)
- **Create**: Confirm with asset ID and name
