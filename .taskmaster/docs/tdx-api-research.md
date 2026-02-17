# TeamDynamix REST API Research

Research conducted: 2026-02-17

## Overview

The TeamDynamix Web API provides a series of RESTful web services to facilitate integration with various areas of the TeamDynamix solution. These web services send and receive data in JSON (JavaScript Object Notation) format.

**Documentation Locations:**
- Production: `https://yourTeamDynamixDomain/TDWebApi/`
- Sandbox: `https://yourTeamDynamixDomain/SBTDWebApi/`
- Solutions Portal: https://solutions.teamdynamix.com/TDWebApi/

**Content Type:** The API exclusively accepts `application/json` content type. Calls using other content types (e.g., `text/plain`) are not supported.

## 1. Authentication Flow

### Admin Service Account Authentication

**Endpoint:** `POST /api/auth/loginadmin`

**Request Format:**
```http
POST /api/auth/loginadmin HTTP/1.1
Content-Type: application/json; charset=utf-8

{
  "BEID": "df0b5273-d7d4-44a3-9dbb-73a57c2904a9",
  "WebServicesKey": "2313ed32-7b4c-4c5b-8974-126a638d0de1"
}
```

**Credentials:**
- `BEID`: Business Entity ID
- `WebServicesKey`: Web Services authentication key
- Both available in TDAdmin's organization detail page (requires "Add BE Administrators" permission)

**Response:**
Returns a JSON Web Token (JWT) in the response body.

**Example Response:**
```json
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### User/Service Account Authentication

**Endpoint:** `POST /api/auth`

**Request Format:**
```http
POST /api/auth HTTP/1.1
Content-Type: application/json; charset=utf-8

{
  "username": "user@example.com",
  "password": "password123"
}
```

**Response:**
Returns a JWT token in the response body.

### Using the JWT Token

**Authorization Header:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Include this header in all subsequent API requests.

### Rate Limiting for Authentication

- **Limit:** 60 calls per IP address every 60 seconds
- **Status Code:** 429 (Too Many Requests) when exceeded

## 2. JWT Token Format and Expiry

### Token Expiration

- **Expiry Time:** 24 hours after issuance
- **Claim:** Token expiration stored in the `exp` claim (standard JWT claim)

### Token Lifecycle Management

1. **Decode JWT:** Parse the token to check the `exp` claim
2. **Monitor Expiry:** Track token age to proactively refresh
3. **Handle 401 Errors:** When receiving 401 Unauthorized, re-authenticate to obtain new token
4. **No Refresh Token:** TeamDynamix does not use traditional refresh tokens - simply re-authenticate via `/api/auth` or `/api/auth/loginadmin`

### Common 401 Causes

- Authentication token has expired (24 hours)
- User lacks sufficient permissions for the requested action

## 3. Rate Limiting

### Rate Limit Headers

TeamDynamix includes three informative headers in API responses:

- **`X-RateLimit-Limit`**: Maximum number of calls allowed in the current measuring period
- **`X-RateLimit-Remaining`**: Number of calls remaining in the current measuring period
- **`X-RateLimit-Reset`**: When the current measuring period will end (RFC 1123 format)

**Example Response:**
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: Wed, 28 Mar 2018 16:08:14 GMT
```

### Rate Limit Types

1. **Per-IP address** (most common)
2. **Per-user**
3. **Per-organization** (least common)

### Rate Limit Framework

- Each endpoint has its own rate limit thresholds
- Timing resets a designated number of seconds after the initial request
- Rate limits on different methods operate independently

### Handling Rate Limit Errors

**Status Code:** `429 Too Many Requests`

**Best Practices:**
1. Parse the `X-RateLimit-Reset` header
2. Wait until the indicated time plus a minimum 5-second buffer (to account for clock differences)
3. Implement exponential backoff for repeated 429 errors
4. Monitor `X-RateLimit-Remaining` to throttle requests proactively

**Example Rate Limits:**
- Authentication endpoints: 60 calls per IP per 60 seconds
- Ticket search: 30 calls per IP per 60 seconds
- Applications list: 60 calls per IP per 60 seconds

## 4. The appId Pattern

### What is appId?

- **Type:** `Int32` (integer)
- **Purpose:** Application identifier that specifies the corresponding application for operations
- **Usage:** Included in URL path wherever `{appId}` placeholder appears

### Example Endpoints Using appId

```
GET    /api/{appId}/tickets/{id}
POST   /api/{appId}/tickets
POST   /api/{appId}/tickets/search
PUT    /api/{appId}/tickets/{id}
PATCH  /api/{appId}/tickets/{id}
DELETE /api/{appId}/tickets/{id}
```

### How to Get appId

**Endpoint:** `GET /api/applications`

**Description:** Gets all applications for an organization

**Response:** Array of `TeamDynamix.Api.Apps.OrgApplication` objects

**Rate Limiting:** 60 calls per IP address every 60 seconds

**Example Response:**
```json
[
  {
    "AppID": 123,
    "Name": "IT Support",
    "AppClass": "TDTickets",
    "IsActive": true
  },
  {
    "AppID": 456,
    "Name": "HR Services",
    "AppClass": "TDTickets",
    "IsActive": true
  }
]
```

### Application Classes

Applications in TeamDynamix can be of different types (classes):
- `TDTickets`: Ticketing/service management applications
- `TDAssets`: Asset/configuration management applications
- `TDProjects`: Project management applications

## 5. Ticket Search API

### Endpoint

**POST** `/api/{appId}/tickets/search`

### Request Body

**Type:** `TeamDynamix.Api.Tickets.TicketSearch` object

**Content-Type:** `application/json`

### TicketSearch Object Properties

#### Identification & Basic Filters
- `TicketID` (Int32, nullable): Individual ticket reference
- `ParentTicketID` (Int32, nullable): Parent ticket association
- `SearchText` (String, nullable): General text-based filtering
- `MaxResults` (Int32): Limits returned records

#### Classification & Status
- `TicketClassification` (TicketClass[], nullable): Categorization filtering
- `StatusIDs` (Int32[], nullable): Current ticket statuses
- `PastStatusIDs` (Int32[], nullable): Historical status tracking
- `StatusClassIDs` (Int32[], nullable): Status groupings

#### Priority & Impact
- `PriorityIDs` (Int32[], nullable): Urgency indicators
- `UrgencyIDs` (Int32[], nullable): Request severity
- `ImpactIDs` (Int32[], nullable): Business impact levels

#### Organizational Context
- `AccountIDs` (Int32[], nullable): Department associations
- `TypeIDs` (Int32[], nullable): Ticket categorization
- `SourceIDs` (Int32[], nullable): Request origin
- `FormIDs` (Int32[], nullable): Request templates

#### Date Range Filters (all DateTime, nullable)
- `CreatedDateFrom`, `CreatedDateTo`: Ticket creation dates
- `UpdatedDateFrom`, `UpdatedDateTo`: Last update dates
- `ModifiedDateFrom`, `ModifiedDateTo`: Modification dates
- `StartDateFrom`, `StartDateTo`: Start dates
- `EndDateFrom`, `EndDateTo`: End dates
- `RespondedDateFrom`, `RespondedDateTo`: Response dates
- `ClosedDateFrom`, `ClosedDateTo`: Closure dates
- `RespondByDateFrom`, `RespondByDateTo`: SLA response deadlines
- `CloseByDateFrom`, `CloseByDateTo`: SLA closure deadlines
- `GoesOffHoldFrom`, `GoesOffHoldTo`: Hold status dates
- `DaysOldFrom`, `DaysOldTo` (Int32, nullable): Age-based filtering

#### User/Responsibility Filters
- `ResponsibilityUids` (Guid[], nullable): Assigned users
- `ResponsibilityGroupIDs` (Int32[], nullable): Team assignments
- `PrimaryResponsibilityUids` (Guid[], nullable): Primary assigned users
- `PrimaryResponsibilityGroupIDs` (Int32[], nullable): Primary teams
- `RequestorUids` (Guid[], nullable): Request originators
- `RequestorNameSearch` (String, nullable): Requestor name lookup
- `RequestorEmailSearch` (String, nullable): Requestor email lookup
- `RequestorPhoneSearch` (String, nullable): Requestor phone lookup
- `UpdatedByUid` (Guid, nullable): Last updated by user
- `ModifiedByUid` (Guid, nullable): Last modified by user
- `ClosedByUid` (Guid, nullable): Closed by user
- `CreatedByUid` (Guid, nullable): Created by user
- `RespondedByUid` (Guid, nullable): Responded by user
- `ReviewerUid` (Guid, nullable): Reviewer user

#### Service & Configuration
- `ServiceIDs` (Int32[], nullable): Service associations
- `ConfigurationItemIDs` (Int32[], nullable): Associated assets
- `ExcludeConfigurationItemIDs` (Int32[], nullable): Asset exclusions
- `LocationIDs` (Int32[], nullable): Physical locations
- `LocationRoomIDs` (Int32[], nullable): Specific rooms
- `KBArticleIDs` (Int32[], nullable): Knowledge base references

#### SLA & Status Indicators
- `SlaIDs` (Int32[], nullable): Service level agreements
- `SlaViolationStatus` (Boolean, nullable): SLA breach tracking
- `SlaUnmetConstraints`: Specific deadline failures
- `IsOnHold` (Boolean, nullable): On-hold status

#### Additional Criteria
- `CustomAttributes` (CustomAttribute[], nullable): Extended data filtering
- `AssignmentStatus` (Boolean, nullable): Assignment state
- `ConvertedToTask` (Boolean, nullable): Task conversion status
- `CompletedTaskResponsibilityFilter` (Boolean, nullable): Completed task filter
- `HasReferenceCode` (Boolean, nullable): Reference number presence

### Example Request

```http
POST /api/123/tickets/search HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "StatusIDs": [1, 2, 3],
  "PriorityIDs": [4],
  "CreatedDateFrom": "2026-01-01T00:00:00Z",
  "CreatedDateTo": "2026-02-17T23:59:59Z",
  "MaxResults": 100,
  "SearchText": "password reset"
}
```

### Response Characteristics

**Important Limitations:**
- Does **not** include full ticket information
- Omits: attachments, custom attributes, descriptions, notify settings, task information
- Returns basic ticket listing data only

**To get full ticket details:** Use `GET /api/{appId}/tickets/{id}` for individual tickets

### Rate Limiting

- **Limit:** 30 calls per IP address every 60 seconds

## 6. HTTP Methods and Operations

### Supported HTTP Verbs

- **GET**: Retrieve resources
- **POST**: Create resources
- **PUT**: Update resources (full replacement)
- **PATCH**: Partial update (specific fields only)
- **DELETE**: Remove resources

### PATCH Operations

TeamDynamix supports JSON Patch operations with some variations from the standard:

#### Supported Operations
- **add**: Modifies or sets field values
- **remove**: Clears (but doesn't delete) properties
- **move**: Relocates values between paths
- **copy**: Duplicates values to new locations

**Not Supported:**
- **test**: Not currently implemented

#### Key Restrictions

1. **Unordered collections** (like custom attributes) reference items by ID rather than array position
2. **Case-insensitive** property matching
3. **Add/copy operations** cannot introduce new properties
4. **Remove/move operations** cannot delete properties—only clear them
5. The special `/-` index for array operations is unavailable

#### PATCH vs PUT

- **PATCH**: Submit only fields that should be changed (partial update)
- **PUT**: Submit the complete resource (full replacement)

#### Example PATCH Request

```http
PATCH /api/123/tickets/456 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

[
  {
    "op": "add",
    "path": "/StatusID",
    "value": 3
  },
  {
    "op": "add",
    "path": "/Attributes/1234",
    "value": "Updated value"
  }
]
```

#### Custom Attribute Handling in PATCH

- Submit only the attribute value (not a full object)
- For choice-based attributes: Submit the selected choice ID
- For multiple selections: Use comma-separated IDs

### Common Ticket Endpoints

```
GET    /api/{appId}/tickets/{id}          - Get individual ticket
POST   /api/{appId}/tickets                - Create ticket
PUT    /api/{appId}/tickets/{id}           - Update ticket (full)
PATCH  /api/{appId}/tickets/{id}           - Patch ticket (partial)
POST   /api/{appId}/tickets/search         - Search tickets

# Ticket Tasks
GET    /api/{appId}/tickets/{id}/tasks     - Get ticket tasks
POST   /api/{appId}/tickets/{id}/tasks     - Create ticket task
PUT    /api/{appId}/tickets/{id}/tasks/{taskId}  - Update task
DELETE /api/{appId}/tickets/{id}/tasks/{taskId}  - Delete task
```

## 7. Common Error Responses and Status Codes

### HTTP Status Codes

#### 200 OK
- Successful GET, PUT, PATCH operations
- Check rate limit headers in response

#### 201 Created
- Successful POST operations (resource creation)
- Response may include created resource

#### 400 Bad Request
- Malformed JSON
- Invalid parameter values
- Missing required fields
- Validation errors

#### 401 Unauthorized
**Common Causes:**
1. Authentication token has expired (24-hour limit)
2. User lacks sufficient permissions for the requested action
3. Missing or invalid Authorization header

**Resolution:**
- Re-authenticate via `/api/auth` or `/api/auth/loginadmin`
- Verify user has necessary permissions

#### 403 Forbidden
- User is authenticated but lacks specific permissions
- Different from 401 (which indicates authentication failure)

#### 404 Not Found
- Resource does not exist
- Invalid endpoint URL
- Incorrect appId or ticket ID

#### 429 Too Many Requests
- Rate limit exceeded
- Check `X-RateLimit-Reset` header for reset time
- Wait until reset time + 5 seconds buffer

#### 500 Internal Server Error
- Server-side error
- Retry with exponential backoff
- Contact TeamDynamix support if persists

#### 503 Service Unavailable
- Service temporarily unavailable
- Maintenance or overload
- Retry with exponential backoff

### Error Response Format

While specific error response formats are not extensively documented, expect JSON responses with error details:

```json
{
  "Message": "Error description",
  "ErrorCode": "SPECIFIC_ERROR_CODE",
  "Details": "Additional error information"
}
```

## 8. Implementation Recommendations for MCP Server

### Authentication (Task #3)

1. **Token Management:**
   - Decode JWT to extract `exp` claim
   - Implement proactive token refresh (before 24-hour expiry)
   - Handle 401 errors with automatic re-authentication
   - Store BEID and WebServicesKey securely (environment variables)

2. **Auth Flow:**
   ```
   1. POST /api/auth/loginadmin with BEID + WebServicesKey
   2. Parse JWT from response
   3. Decode JWT to get expiration
   4. Store token and expiration
   5. Include token in Authorization: Bearer header
   6. Monitor expiration and refresh proactively
   ```

### HTTP Client and Rate Limiting (Task #4)

1. **Rate Limit Tracking:**
   - Parse `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` from all responses
   - Implement per-endpoint rate limit tracking
   - Queue requests when approaching limits
   - Implement 429 retry logic with `X-RateLimit-Reset` + 5 seconds

2. **HTTP Client Configuration:**
   - Base URL: `https://yourinstance.teamdynamix.com/TDWebApi/api`
   - Default headers: `Content-Type: application/json`
   - Automatic token injection in Authorization header
   - Request/response interceptors for rate limit handling
   - Exponential backoff for 429, 500, 503 errors

3. **Error Handling:**
   - 401: Automatic re-authentication
   - 429: Parse reset time and queue request
   - 400: Validation error - return to user
   - 404: Resource not found - return to user
   - 500/503: Retry with exponential backoff

### Tickets Domain (Task #7)

1. **Required Endpoints:**
   - `GET /api/applications` - Get appIds
   - `POST /api/{appId}/tickets/search` - Search tickets
   - `GET /api/{appId}/tickets/{id}` - Get full ticket details
   - `POST /api/{appId}/tickets` - Create ticket
   - `PUT /api/{appId}/tickets/{id}` - Update ticket
   - `PATCH /api/{appId}/tickets/{id}` - Partial update

2. **Search Implementation:**
   - Support common filters: StatusIDs, PriorityIDs, date ranges, SearchText
   - Implement MaxResults for pagination
   - Remember: search returns limited data - fetch full tickets individually
   - Rate limit: 30 calls/60 seconds

3. **PATCH Support:**
   - Prefer PATCH over PUT for partial updates
   - Support custom attribute updates
   - Handle choice-based attributes (comma-separated IDs)

## Sources

- [TeamDynamix Web API](https://solutions.teamdynamix.com/TDWebApi/)
- [TeamDynamix API/Web Services Overview](https://solutions.teamdynamix.com/TDClient/KB/ArticleDet?ID=579)
- [Article - Logging into the Web API](https://solutions.teamdynamix.com/TDClient/1965/Portal/KB/ArticleDet?ID=1715)
- [TeamDynamix Web API: Auth](https://solutions.teamdynamix.com/TDWebApi/Home/section/Auth)
- [TeamDynamix Web API: Rate Limiting](https://solutions.teamdynamix.com/TDWebApi/Home/AboutRateLimiting)
- [TeamDynamix Web API: Tickets](https://solutions.teamdynamix.com/TDWebApi/Home/section/Tickets)
- [TeamDynamix Web API: TeamDynamix.Api.Tickets.TicketSearch](https://solutions.teamdynamix.com/TDWebApi/Home/type/TeamDynamix.Api.Tickets.TicketSearch)
- [TeamDynamix Web API: HTTP PATCH Support](https://solutions.teamdynamix.com/TDWebApi/Home/AboutPatching)
- [TeamDynamix Web API: Applications](https://bridgew.teamdynamix.com/TDWebApi/Home/section/Applications)
- [Knowledge Base - API and Web Services](https://solutions.teamdynamix.com/TDClient/KB/?CategoryID=356)
