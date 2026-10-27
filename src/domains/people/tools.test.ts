import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPeopleTools } from "./tools.js";
import { resetConfig } from "../../config.js";

/**
 * Mock handler dependencies so tool registration does not
 * require a real TdxClient. A single stable object lets tests set return
 * values and assert calls.
 */
const mockPeople = {
  search: vi.fn(),
  get: vi.fn(),
  getByUsername: vi.fn(),
  getGroups: vi.fn(),
  addToGroup: vi.fn(),
  removeFromGroup: vi.fn(),
  setActive: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({ people: mockPeople })),
}));

/** Helper to access the private _registeredTools record on McpServer. */
function getRegisteredTools(
  server: McpServer,
): Record<string, unknown> {
  return (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
}

/** The full set of people tool names this domain is expected to register. */
const EXPECTED_PEOPLE_TOOLS = [
  "tdx_people_search",
  "tdx_people_get",
  "tdx_people_get_by_username",
  "tdx_people_get_groups",
  "tdx_people_add_to_group",
  "tdx_people_remove_from_group",
  "tdx_people_set_active",
  "tdx_people_create",
  "tdx_people_update",
];

describe("people tools registration", () => {
  it("should register all people tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    for (const name of EXPECTED_PEOPLE_TOOLS) {
      expect(name in registeredTools).toBe(true);
    }
  });

  it("should register exactly the expected number of people tools", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    const peopleTools = Object.keys(registeredTools).filter((name) =>
      name.startsWith("tdx_people_"),
    );
    expect(peopleTools).toHaveLength(EXPECTED_PEOPLE_TOOLS.length);
  });

  it("should match the expected tool names from the domain registry", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.1",
    });

    registerPeopleTools(server);

    const registeredTools = getRegisteredTools(server);

    for (const name of EXPECTED_PEOPLE_TOOLS) {
      expect(name in registeredTools).toBe(true);
    }
  });
});

/** Valid test env so getConfig() succeeds (not real credentials). */
function setBaseConfigEnv(): void {
  process.env.TDX_BASE_URL = "https://example.teamdynamix.com";
  process.env.TDX_BEID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  process.env.TDX_WEB_SERVICES_KEY = "12345678-abcd-ef01-2345-6789abcdef01";
}

/** Toggle the privileged-write gate and reload the config singleton. */
function setPrivilegedFlag(on: boolean): void {
  if (on) {
    process.env.TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES = "true";
  } else {
    delete process.env.TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES;
  }
  resetConfig();
}

function getTool(
  name: string,
  identity: { email: string; name: string; oid: string } | null,
): { handler: (args: unknown, extra: unknown) => Promise<unknown> } {
  const server = new McpServer({ name: "test-server", version: "0.0.1" });
  registerPeopleTools(server, identity);
  const registered = getRegisteredTools(server) as Record<
    string,
    { handler: (args: unknown, extra: unknown) => Promise<unknown> }
  >;
  return registered[name];
}

/**
 * Attribution enforcement on the destructive person writes. These mutations
 * run through the shared TDX service account, so the tool must refuse unless a
 * real human can be attributed — a FERPA accountability requirement, and the
 * same convention the tickets domain enforces for state changes. The actor
 * check runs before the privileged-write gate, so these refusals never depend
 * on the gate flag.
 */
describe("people destructive-write attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBaseConfigEnv();
    setPrivilegedFlag(false);
  });

  afterEach(() => {
    delete process.env.TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES;
    resetConfig();
  });

  it("set_active: refuses without an identity or actingUser* fields", async () => {
    const result = (await getTool("tdx_people_set_active", null).handler(
      { uid: "u-1", isActive: false },
      {},
    )) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("actingUserFullName");
    expect(mockPeople.setActive).not.toHaveBeenCalled();
  });

  it("create: refuses without attribution and does not call the SDK", async () => {
    const result = (await getTool("tdx_people_create", null).handler(
      {
        firstName: "New",
        lastName: "Student",
        primaryEmail: "new.student@example.edu",
      },
      {},
    )) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(mockPeople.create).not.toHaveBeenCalled();
  });

  it("update: refuses a securityRoleId change without attribution (privilege guard)", async () => {
    const result = (await getTool("tdx_people_update", null).handler(
      { uid: "u-1", securityRoleId: "11111111-1111-1111-1111-111111111111" },
      {},
    )) as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(mockPeople.update).not.toHaveBeenCalled();
  });

  it("add_to_group: refuses without attribution", async () => {
    const result = (await getTool("tdx_people_add_to_group", null).handler(
      { uid: "u-1", groupId: 5 },
      {},
    )) as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(mockPeople.addToGroup).not.toHaveBeenCalled();
  });
});

/**
 * Privileged-write gate (TDX-SEC-3). Setting securityRoleId or isActive,
 * changing group membership, and activating/deactivating a person are
 * privileged operations. They are disabled by default
 * (TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES=false) and must be refused in code even
 * for an attributed caller. Non-privileged fields keep working with attribution.
 */
describe("people privileged-write gate", () => {
  const IDENTITY = {
    email: "brad.mccormick@example.edu",
    name: "Brad McCormick",
    oid: "00000000-0000-0000-0000-0000000000bb",
  };

  const ATTR = {
    actingUserFullName: "Aaron Sachs",
    actingUserEmail: "aaron.sachs@example.edu",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setBaseConfigEnv();
  });

  afterEach(() => {
    delete process.env.TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES;
    resetConfig();
  });

  describe("flag OFF (default): privileged writes refused despite attribution", () => {
    beforeEach(() => setPrivilegedFlag(false));

    it("set_active is refused and names the flag; SDK not called", async () => {
      const result = (await getTool("tdx_people_set_active", null).handler(
        { uid: "u-1", isActive: false, ...ATTR },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES",
      );
      expect(mockPeople.setActive).not.toHaveBeenCalled();
    });

    it("update setting securityRoleId is refused; SDK not called", async () => {
      const result = (await getTool("tdx_people_update", null).handler(
        {
          uid: "u-1",
          securityRoleId: "11111111-1111-1111-1111-111111111111",
          ...ATTR,
        },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES",
      );
      expect(mockPeople.update).not.toHaveBeenCalled();
    });

    it("update setting isActive is refused; SDK not called", async () => {
      const result = (await getTool("tdx_people_update", null).handler(
        { uid: "u-1", isActive: false, ...ATTR },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES",
      );
      expect(mockPeople.update).not.toHaveBeenCalled();
    });

    it("add_to_group is refused despite attribution; SDK not called", async () => {
      const result = (await getTool("tdx_people_add_to_group", null).handler(
        { uid: "u-1", groupId: 5, ...ATTR },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "TDX_ALLOW_PRIVILEGED_PEOPLE_WRITES",
      );
      expect(mockPeople.addToGroup).not.toHaveBeenCalled();
    });

    it("remove_from_group is refused despite attribution; SDK not called", async () => {
      const result = (await getTool(
        "tdx_people_remove_from_group",
        null,
      ).handler({ uid: "u-1", groupId: 5, ...ATTR }, {})) as {
        isError?: boolean;
      };

      expect(result.isError).toBe(true);
      expect(mockPeople.removeFromGroup).not.toHaveBeenCalled();
    });

    it("create with securityRoleId is refused; SDK not called", async () => {
      const result = (await getTool("tdx_people_create", null).handler(
        {
          firstName: "New",
          lastName: "Admin",
          primaryEmail: "new.admin@example.edu",
          securityRoleId: "11111111-1111-1111-1111-111111111111",
          ...ATTR,
        },
        {},
      )) as { isError?: boolean };

      expect(result.isError).toBe(true);
      expect(mockPeople.create).not.toHaveBeenCalled();
    });

    it("non-privileged update still works with attribution", async () => {
      mockPeople.update.mockResolvedValue({ UID: "u-1", FirstName: "Robert" });

      const result = (await getTool("tdx_people_update", null).handler(
        {
          uid: "u-1",
          firstName: "Robert",
          primaryEmail: "robert@example.edu",
          ...ATTR,
        },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).not.toBe(true);
      expect(mockPeople.update).toHaveBeenCalledWith("u-1", {
        FirstName: "Robert",
        PrimaryEmail: "robert@example.edu",
      });
      expect(result.content[0].text).toContain("Aaron Sachs");
    });

    it("create with only non-privileged fields works with attribution", async () => {
      mockPeople.create.mockResolvedValue({
        UID: "u-2",
        FirstName: "New",
        LastName: "Student",
        PrimaryEmail: "new.student@example.edu",
      });

      const result = (await getTool("tdx_people_create", null).handler(
        {
          firstName: "New",
          lastName: "Student",
          primaryEmail: "new.student@example.edu",
          isEmployee: false,
          ...ATTR,
        },
        {},
      )) as { isError?: boolean };

      expect(result.isError).not.toBe(true);
      expect(mockPeople.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("flag ON + attribution: privileged writes proceed", () => {
    beforeEach(() => setPrivilegedFlag(true));

    it("set_active proceeds with model-supplied attribution, recorded in output", async () => {
      mockPeople.setActive.mockResolvedValue(undefined);

      const result = (await getTool("tdx_people_set_active", null).handler(
        { uid: "u-1", isActive: false, ...ATTR },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).not.toBe(true);
      expect(mockPeople.setActive).toHaveBeenCalledWith("u-1", false);
      expect(result.content[0].text).toContain("deactivated");
      expect(result.content[0].text).toContain("Aaron Sachs");
    });

    it("set_active: a verified identity is authoritative and proceeds", async () => {
      mockPeople.setActive.mockResolvedValue(undefined);

      const result = (await getTool("tdx_people_set_active", IDENTITY).handler(
        // Spoof attempt — must be ignored in favor of the verified identity.
        {
          uid: "u-9",
          isActive: true,
          actingUserFullName: "Someone Else",
          actingUserEmail: "attacker@example.edu",
        },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain("Brad McCormick");
      expect(result.content[0].text).toContain(
        "identity verified by AI Portal",
      );
      expect(result.content[0].text).not.toContain("attacker@example.edu");
    });

    it("update setting securityRoleId proceeds and calls the SDK", async () => {
      mockPeople.update.mockResolvedValue({ UID: "u-1" });

      const result = (await getTool("tdx_people_update", null).handler(
        {
          uid: "u-1",
          securityRoleId: "11111111-1111-1111-1111-111111111111",
          ...ATTR,
        },
        {},
      )) as { isError?: boolean };

      expect(result.isError).not.toBe(true);
      expect(mockPeople.update).toHaveBeenCalledWith("u-1", {
        SecurityRoleID: "11111111-1111-1111-1111-111111111111",
      });
    });

    it("add_to_group proceeds and calls the SDK", async () => {
      mockPeople.addToGroup.mockResolvedValue(undefined);

      const result = (await getTool("tdx_people_add_to_group", null).handler(
        { uid: "u-1", groupId: 5, ...ATTR },
        {},
      )) as { isError?: boolean };

      expect(result.isError).not.toBe(true);
      expect(mockPeople.addToGroup).toHaveBeenCalledWith(5, "u-1");
    });

    it("still refuses when attribution is missing (gate does not bypass actor check)", async () => {
      const result = (await getTool("tdx_people_set_active", null).handler(
        { uid: "u-1", isActive: false },
        {},
      )) as { isError?: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("actingUserFullName");
      expect(mockPeople.setActive).not.toHaveBeenCalled();
    });
  });
});
