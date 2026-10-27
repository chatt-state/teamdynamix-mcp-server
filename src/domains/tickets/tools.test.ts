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
  getTasks: vi.fn(),
  getContacts: vi.fn(),
  addContact: vi.fn(),
  removeContact: vi.fn(),
  getAttachments: vi.fn(),
  addAttachment: vi.fn(),
  addTag: vi.fn(),
};
const mockPeople = { search: vi.fn() };

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    tickets: mockTickets,
    people: mockPeople,
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
    expect("tdx_tickets_get_feed" in registeredTools).toBe(true);
    expect("tdx_tickets_get_tasks" in registeredTools).toBe(true);
    expect("tdx_tickets_get_contacts" in registeredTools).toBe(true);
    expect("tdx_tickets_add_contact" in registeredTools).toBe(true);
    expect("tdx_tickets_remove_contact" in registeredTools).toBe(true);
    expect("tdx_tickets_get_attachments" in registeredTools).toBe(true);
    expect("tdx_tickets_add_attachment" in registeredTools).toBe(true);
    expect("tdx_tickets_add_tag" in registeredTools).toBe(true);
  });

  it("should register exactly 13 ticket tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerTicketTools(server);

    const registeredTools = getRegisteredTools(server);

    const ticketTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_tickets_"),
    );
    expect(ticketTools).toHaveLength(13);
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
      "tdx_tickets_get_feed",
      "tdx_tickets_get_tasks",
      "tdx_tickets_get_contacts",
      "tdx_tickets_add_contact",
      "tdx_tickets_remove_contact",
      "tdx_tickets_get_attachments",
      "tdx_tickets_add_attachment",
      "tdx_tickets_add_tag",
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
    // create() now resolves TDX-required ids from these lookups when the
    // model omits them; provide active defaults + a requestor account.
    mockTickets.getTypes.mockResolvedValue([{ ID: 35, Name: "Default", IsActive: true }]);
    mockTickets.getStatuses.mockResolvedValue([{ ID: 688, Name: "New", IsActive: true, Order: 1 }]);
    mockTickets.getPriorities.mockResolvedValue([{ ID: 251, Name: "Medium", IsActive: true }]);
    mockPeople.search.mockResolvedValue([
      { PrimaryEmail: "brad.mccormick@example.edu", DefaultAccountID: 2778, IsActive: true },
      { PrimaryEmail: "jane.doe@example.edu", DefaultAccountID: 2900, IsActive: true },
    ]);
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

  it("create: resolves all required ids from defaults (never sends 0)", async () => {
    // Regression for the AccountId:0 400 — a bare title+description must
    // resolve TypeID/StatusID/PriorityID/AccountID to real values.
    mockTickets.create.mockResolvedValue({ ID: 303, Title: "Wifi is down" });

    const result = (await getTool("tdx_tickets_create", IDENTITY).handler(
      { title: "Wifi is down", description: "3rd floor." },
      {},
    )) as { isError?: boolean };

    expect(result.isError).not.toBe(true);
    const [t] = mockTickets.create.mock.calls[0];
    expect(t.TypeID).toBe(35);
    expect(t.StatusID).toBe(688);
    expect(t.PriorityID).toBe(251);
    expect(t.AccountID).toBe(2778); // Brad's default account, via people.search
    for (const v of [t.TypeID, t.StatusID, t.PriorityID, t.AccountID]) expect(v).not.toBe(0);
  });

  it("create: clear error when the requestor's account can't be resolved", async () => {
    mockPeople.search.mockResolvedValue([]); // no match, no accountId given
    const result = (await getTool("tdx_tickets_create", IDENTITY).handler(
      { title: "Orphan ticket", description: "x" },
      {},
    )) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("accountId");
    expect(mockTickets.create).not.toHaveBeenCalled();
  });
});

describe("full-coverage ticket tools", () => {
  const IDENTITY = {
    email: "brad.mccormick@example.edu",
    name: "Brad McCormick",
    oid: "00000000-0000-0000-0000-0000000000bb",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function invoke(
    name: string,
    args: Record<string, unknown>,
    identity: typeof IDENTITY | null = null,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const server = new McpServer({ name: "test-server", version: "0.0.1" });
    registerTicketTools(server, identity);
    const registered = getRegisteredTools(server) as Record<
      string,
      { handler: (args: unknown, extra: unknown) => Promise<unknown> }
    >;
    return registered[name].handler(args, {}) as Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;
  }

  describe("tdx_tickets_get_feed", () => {
    it("summarizes feed entries into one line each", async () => {
      mockTickets.getFeed.mockResolvedValue([
        {
          ID: 9,
          CreatedDate: "2026-01-01",
          CreatedFullName: "Jane Doe",
          Comments: "Line one\n\nline two",
          IsPrivate: false,
        },
        {
          ID: 10,
          CreatedDate: "2026-01-02",
          CreatedFullName: "Staff",
          Comments: "internal",
          IsPrivate: true,
        },
      ]);

      const result = await invoke("tdx_tickets_get_feed", { ticketId: 42 });

      expect(mockTickets.getFeed).toHaveBeenCalledWith(42);
      expect(result.content[0].text).toContain("#9 [2026-01-01] Jane Doe: Line one line two");
      expect(result.content[0].text).toContain("(private)");
    });

    it("reports empty feeds", async () => {
      mockTickets.getFeed.mockResolvedValue([]);
      const result = await invoke("tdx_tickets_get_feed", { ticketId: 42 });
      expect(result.content[0].text).toContain("no feed entries");
    });
  });

  describe("tdx_tickets_get_tasks", () => {
    it("summarizes untyped task objects", async () => {
      mockTickets.getTasks.mockResolvedValue([
        { ID: 3, Title: "Image the laptop", StatusName: "Open", PercentComplete: 25 },
      ]);

      const result = await invoke("tdx_tickets_get_tasks", { ticketId: 42 });

      expect(mockTickets.getTasks).toHaveBeenCalledWith(42);
      expect(result.content[0].text).toContain("#3 Image the laptop [Open] — 25% complete");
    });
  });

  describe("tdx_tickets_get_contacts", () => {
    it("summarizes contacts", async () => {
      mockTickets.getContacts.mockResolvedValue([
        { UID: "u-1", FullName: "Pat Smith", PrimaryEmail: "pat@example.edu" },
      ]);

      const result = await invoke("tdx_tickets_get_contacts", { ticketId: 42 });

      expect(mockTickets.getContacts).toHaveBeenCalledWith(42);
      expect(result.content[0].text).toContain("Pat Smith <pat@example.edu> [UID u-1]");
    });
  });

  describe("tdx_tickets_add_contact", () => {
    it("adds the contact and records an attributed audit feed entry", async () => {
      mockTickets.addContact.mockResolvedValue(undefined);
      mockTickets.addFeedEntry.mockResolvedValue({ ID: 500 });

      const result = await invoke("tdx_tickets_add_contact", {
        ticketId: 42,
        contactUid: "u-9",
        actingUserFullName: "Aaron Sachs",
        actingUserEmail: "aaron@example.edu",
      });

      expect(mockTickets.addContact).toHaveBeenCalledWith(42, "u-9");
      const [, entry] = mockTickets.addFeedEntry.mock.calls[0];
      expect(entry.Comments).toContain("[Contact u-9 added to ticket by Aaron Sachs <aaron@example.edu>");
      expect(entry.IsPrivate).toBe(true);
      expect(result.isError).not.toBe(true);
    });

    it("requires attribution when no verified identity exists", async () => {
      const result = await invoke("tdx_tickets_add_contact", {
        ticketId: 42,
        contactUid: "u-9",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("actingUserFullName");
      expect(mockTickets.addContact).not.toHaveBeenCalled();
    });

    it("verified identity overrides model-supplied attribution", async () => {
      mockTickets.addContact.mockResolvedValue(undefined);
      mockTickets.addFeedEntry.mockResolvedValue({ ID: 501 });

      await invoke(
        "tdx_tickets_add_contact",
        {
          ticketId: 42,
          contactUid: "u-9",
          actingUserFullName: "Someone Else",
          actingUserEmail: "attacker@example.edu",
        },
        IDENTITY,
      );

      const [, entry] = mockTickets.addFeedEntry.mock.calls[0];
      expect(entry.Comments).toContain("Brad McCormick");
      expect(entry.Comments).toContain("identity verified by AI Portal");
      expect(entry.Comments).not.toContain("attacker@example.edu");
    });
  });

  describe("tdx_tickets_remove_contact", () => {
    it("removes the contact and records an attributed audit feed entry", async () => {
      mockTickets.removeContact.mockResolvedValue(undefined);
      mockTickets.addFeedEntry.mockResolvedValue({ ID: 502 });

      await invoke("tdx_tickets_remove_contact", {
        ticketId: 42,
        contactUid: "u-9",
        actingUserFullName: "Aaron Sachs",
        actingUserEmail: "aaron@example.edu",
      });

      expect(mockTickets.removeContact).toHaveBeenCalledWith(42, "u-9");
      const [, entry] = mockTickets.addFeedEntry.mock.calls[0];
      expect(entry.Comments).toContain("[Contact u-9 removed from ticket by Aaron Sachs");
    });

    it("requires attribution when no verified identity exists", async () => {
      const result = await invoke("tdx_tickets_remove_contact", {
        ticketId: 42,
        contactUid: "u-9",
      });

      expect(result.isError).toBe(true);
      expect(mockTickets.removeContact).not.toHaveBeenCalled();
    });
  });

  describe("tdx_tickets_get_attachments", () => {
    it("summarizes attachment metadata", async () => {
      mockTickets.getAttachments.mockResolvedValue([
        {
          ID: 7,
          Name: "log.txt",
          Size: 1024,
          ContentType: "text/plain",
          CreatedDate: "2026-01-01",
          CreatedUID: "u-1",
        },
      ]);

      const result = await invoke("tdx_tickets_get_attachments", { ticketId: 42 });

      expect(mockTickets.getAttachments).toHaveBeenCalledWith(42);
      expect(result.content[0].text).toContain("#7 log.txt (1024 bytes, text/plain)");
    });
  });

  describe("tdx_tickets_add_attachment", () => {
    it("decodes base64 and uploads the buffer", async () => {
      mockTickets.addAttachment.mockResolvedValue({ ID: 15, Name: "note.txt" });
      const contentBase64 = Buffer.from("hello world").toString("base64");

      const result = await invoke("tdx_tickets_add_attachment", {
        ticketId: 42,
        fileName: "note.txt",
        contentBase64,
      });

      expect(mockTickets.addAttachment).toHaveBeenCalledTimes(1);
      const [calledId, calledBuf, calledName] = mockTickets.addAttachment.mock.calls[0];
      expect(calledId).toBe(42);
      expect(Buffer.isBuffer(calledBuf)).toBe(true);
      expect((calledBuf as Buffer).toString("utf8")).toBe("hello world");
      expect(calledName).toBe("note.txt");
      expect(result.content[0].text).toContain("uploaded attachment #15");
    });

    it("errors on empty decoded content without calling the SDK", async () => {
      const result = await invoke("tdx_tickets_add_attachment", {
        ticketId: 42,
        fileName: "empty.bin",
        contentBase64: "===",
      });

      expect(result.isError).toBe(true);
      expect(mockTickets.addAttachment).not.toHaveBeenCalled();
    });
  });

  describe("tdx_tickets_add_tag", () => {
    it("adds a tag", async () => {
      mockTickets.addTag.mockResolvedValue(undefined);

      const result = await invoke("tdx_tickets_add_tag", {
        ticketId: 42,
        tag: "hardware",
      });

      expect(mockTickets.addTag).toHaveBeenCalledWith(42, "hardware");
      expect(result.content[0].text).toContain('tag "hardware" added');
    });
  });
});
