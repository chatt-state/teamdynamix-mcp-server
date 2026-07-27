import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTicketTools } from "./tools.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient.
 */
const mockTickets = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getFeed: vi.fn(),
  addFeedEntry: vi.fn(),
  getTypes: vi.fn(),
  getStatuses: vi.fn(),
  getPriorities: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    tickets: mockTickets,
  })),
}));

vi.mock("../../middleware/elicitation.js", () => ({
  elicitChoice: vi.fn(),
}));

/** Helper to access the private _registeredTools record on McpServer. */
function getRegisteredTools(
  server: McpServer,
): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

describe("ticket tools registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register all ticket tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerTicketTools(server);

    const registeredTools = getRegisteredTools(server);

    expect("tdx_tickets_search" in registeredTools).toBe(true);
    expect("tdx_tickets_get" in registeredTools).toBe(true);
    expect("tdx_tickets_create" in registeredTools).toBe(true);
    expect("tdx_tickets_update" in registeredTools).toBe(true);
    expect("tdx_tickets_reply" in registeredTools).toBe(true);
  });

  it("should register exactly 5 ticket tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerTicketTools(server);

    const registeredTools = getRegisteredTools(server);

    const ticketTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_tickets_"),
    );
    expect(ticketTools).toHaveLength(5);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerTicketTools(server);

    const registeredTools = getRegisteredTools(server);

    const expectedNames = [
      "tdx_tickets_search",
      "tdx_tickets_get",
      "tdx_tickets_create",
      "tdx_tickets_update",
      "tdx_tickets_reply",
    ];

    for (const name of expectedNames) {
      expect(name in registeredTools).toBe(true);
    }
  });
});

describe("tdx_tickets_reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: registers tools, grabs the reply tool's handler, and invokes it.
   * The MCP SDK stores each registered tool under `_registeredTools[name]`
   * as a `RegisteredTool` with a `handler(args, extra)` signature. Tests don't
   * care about `extra`, so we pass a minimal stub.
   */
  async function invokeReplyTool(
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });
    registerTicketTools(server);
    const registered = getRegisteredTools(server) as Record<
      string,
      { handler: (args: unknown, extra: unknown) => Promise<unknown> }
    >;
    const tool = registered["tdx_tickets_reply"];
    return (await tool.handler(args, {})) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
  }

  it("prepends attribution header to the comment body", async () => {
    mockTickets.addFeedEntry.mockResolvedValue({ ID: 101 });

    await invokeReplyTool({
      ticketId: 42,
      comment: "Issue resolved — please confirm.",
      actingUserFullName: "Aaron Sachs",
      actingUserEmail: "aaron.sachs@example.edu",
    });

    expect(mockTickets.addFeedEntry).toHaveBeenCalledTimes(1);
    const [calledTicketId, calledEntry] = mockTickets.addFeedEntry.mock.calls[0];
    expect(calledTicketId).toBe(42);
    expect(calledEntry.Comments).toContain(
      "[Reply from Aaron Sachs <aaron.sachs@example.edu> via Service Desk Assistant]",
    );
    expect(calledEntry.Comments).toContain("Issue resolved — please confirm.");
    expect(calledEntry.IsPrivate).toBe(false);
    expect(calledEntry.IsRichHtml).toBe(false);
  });

  it("passes through NewStatusID and CascadeStatus when supplied", async () => {
    mockTickets.addFeedEntry.mockResolvedValue({ ID: 102 });

    await invokeReplyTool({
      ticketId: 42,
      comment: "Closing ticket.",
      actingUserFullName: "Jane Doe",
      actingUserEmail: "jane.doe@example.edu",
      newStatusId: 5,
      cascadeStatus: true,
    });

    const [, calledEntry] = mockTickets.addFeedEntry.mock.calls[0];
    expect(calledEntry.NewStatusID).toBe(5);
    expect(calledEntry.CascadeStatus).toBe(true);
  });

  it("calls updateTicket before addFeedEntry when reassigning", async () => {
    const callOrder: string[] = [];
    mockTickets.update.mockImplementation(async () => {
      callOrder.push("update");
      return { ID: 42, Title: "Ticket" };
    });
    mockTickets.addFeedEntry.mockImplementation(async () => {
      callOrder.push("addFeedEntry");
      return { ID: 103 };
    });

    await invokeReplyTool({
      ticketId: 42,
      comment: "Reassigning to Network team.",
      actingUserFullName: "Aaron Sachs",
      actingUserEmail: "aaron.sachs@example.edu",
      responsibleGroupId: 7,
    });

    expect(callOrder).toEqual(["update", "addFeedEntry"]);
    expect(mockTickets.update).toHaveBeenCalledWith(42, {
      ResponsibleGroupID: 7,
    });
    const [, calledEntry] = mockTickets.addFeedEntry.mock.calls[0];
    expect(calledEntry.Comments).toContain("[Reassigned via Service Desk Assistant");
    expect(calledEntry.Comments).toContain("to group ID 7");
  });

  it("does not call updateTicket when no reassignment is requested", async () => {
    mockTickets.addFeedEntry.mockResolvedValue({ ID: 104 });

    await invokeReplyTool({
      ticketId: 42,
      comment: "Just a status update.",
      actingUserFullName: "Aaron Sachs",
      actingUserEmail: "aaron.sachs@example.edu",
    });

    expect(mockTickets.update).not.toHaveBeenCalled();
  });

  it("passes notify emails to the feed entry", async () => {
    mockTickets.addFeedEntry.mockResolvedValue({ ID: 105 });

    await invokeReplyTool({
      ticketId: 42,
      comment: "FYI",
      actingUserFullName: "Aaron Sachs",
      actingUserEmail: "aaron.sachs@example.edu",
      notifyEmails: ["alice@example.edu", "bob@example.edu"],
    });

    const [, calledEntry] = mockTickets.addFeedEntry.mock.calls[0];
    expect(calledEntry.Notify).toEqual([
      "alice@example.edu",
      "bob@example.edu",
    ]);
  });
});

describe("verified portal identity enforcement", () => {
  const IDENTITY = {
    email: "brad.mccormick@example.edu",
    name: "Brad McCormick",
    oid: "00000000-0000-0000-0000-0000000000bb",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getTool(
    name: string,
    identity: typeof IDENTITY | null,
  ): { handler: (args: unknown, extra: unknown) => Promise<unknown> } {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });
    registerTicketTools(server, identity);
    const registered = getRegisteredTools(server) as Record<
      string,
      { handler: (args: unknown, extra: unknown) => Promise<unknown> }
    >;
    return registered[name];
  }

  it("reply: verified identity overrides model-supplied attribution", async () => {
    mockTickets.addFeedEntry.mockResolvedValue({ ID: 201 });

    await getTool("tdx_tickets_reply", IDENTITY).handler(
      {
        ticketId: 7,
        comment: "Follow-up.",
        // Model-supplied values MUST be ignored (spoof attempt).
        actingUserFullName: "Someone Else",
        actingUserEmail: "attacker@example.edu",
      },
      {},
    );

    const [, entry] = mockTickets.addFeedEntry.mock.calls[0];
    expect(entry.Comments).toContain(
      "[Reply from Brad McCormick <brad.mccormick@example.edu> via Service Desk Assistant — identity verified by AI Portal]",
    );
    expect(entry.Comments).not.toContain("attacker@example.edu");
  });

  it("reply: verified identity makes actingUser* unnecessary", async () => {
    mockTickets.addFeedEntry.mockResolvedValue({ ID: 202 });

    const result = (await getTool("tdx_tickets_reply", IDENTITY).handler(
      { ticketId: 8, comment: "No attribution args." },
      {},
    )) as { isError?: boolean };

    expect(result.isError).not.toBe(true);
    const [, entry] = mockTickets.addFeedEntry.mock.calls[0];
    expect(entry.Comments).toContain("Brad McCormick");
  });

  it("reply: without identity, missing actingUser* is an error", async () => {
    const result = (await getTool("tdx_tickets_reply", null).handler(
      { ticketId: 9, comment: "Anonymous." },
      {},
    )) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("actingUserFullName");
    expect(mockTickets.addFeedEntry).not.toHaveBeenCalled();
  });

  it("create: requestor defaults to the verified user and filer is recorded", async () => {
    mockTickets.create.mockResolvedValue({ ID: 301, Title: "Printer down" });

    await getTool("tdx_tickets_create", IDENTITY).handler(
      { title: "Printer down", typeId: 1, description: "3rd floor printer." },
      {},
    );

    const [ticketData] = mockTickets.create.mock.calls[0];
    expect(ticketData.RequestorEmail).toBe("brad.mccormick@example.edu");
    expect(ticketData.Description).toContain(
      "[Filed by Brad McCormick <brad.mccormick@example.edu> via AI Portal — identity verified]",
    );
  });

  it("create: explicit requestor (on someone's behalf) is honored, filer still recorded", async () => {
    mockTickets.create.mockResolvedValue({ ID: 302, Title: "Reset for Jane" });

    await getTool("tdx_tickets_create", IDENTITY).handler(
      {
        title: "Reset for Jane",
        typeId: 1,
        description: "Password reset.",
        requestorEmail: "jane.doe@example.edu",
      },
      {},
    );

    const [ticketData] = mockTickets.create.mock.calls[0];
    expect(ticketData.RequestorEmail).toBe("jane.doe@example.edu");
    expect(ticketData.Description).toContain("[Filed by Brad McCormick");
  });
});
