import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
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
  getTdxClient: vi.fn(() => ({
    people: mockPeople,
  })),
}));

import {
  searchPeople,
  getPerson,
  getPersonByUsername,
  getPersonGroups,
  addPersonToGroup,
  removePersonFromGroup,
  setPersonActive,
  createPerson,
  updatePerson,
} from "./handlers.js";

describe("people handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchPeople", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ UID: "abc-123", FirstName: "John", LastName: "Doe" }];
      mockPeople.search.mockResolvedValue(mockResults);

      const result = await searchPeople({
        SearchText: "John",
        MaxResults: 10,
      });

      expect(mockPeople.search).toHaveBeenCalledWith({
        SearchText: "John",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should forward IsActive and IsEmployee filters", async () => {
      mockPeople.search.mockResolvedValue([]);

      await searchPeople({ IsActive: true, IsEmployee: false });

      expect(mockPeople.search).toHaveBeenCalledWith({
        IsActive: true,
        IsEmployee: false,
      });
    });
  });

  describe("getPerson", () => {
    it("should call the library client with UID", async () => {
      const mockPerson = { UID: "abc-123", FirstName: "Jane", LastName: "Smith" };
      mockPeople.get.mockResolvedValue(mockPerson);

      const result = await getPerson("abc-123");

      expect(mockPeople.get).toHaveBeenCalledWith("abc-123");
      expect(result).toEqual(mockPerson);
    });
  });

  describe("getPersonByUsername", () => {
    it("should call the library client with the username", async () => {
      const mockPerson = { UID: "abc-123", UserName: "jsmith" };
      mockPeople.getByUsername.mockResolvedValue(mockPerson);

      const result = await getPersonByUsername("jsmith");

      expect(mockPeople.getByUsername).toHaveBeenCalledWith("jsmith");
      expect(result).toEqual(mockPerson);
    });
  });

  describe("getPersonGroups", () => {
    it("should call the library client with UID", async () => {
      const mockGroups = [{ GroupID: 5, GroupName: "Help Desk" }];
      mockPeople.getGroups.mockResolvedValue(mockGroups);

      const result = await getPersonGroups("abc-123");

      expect(mockPeople.getGroups).toHaveBeenCalledWith("abc-123");
      expect(result).toEqual(mockGroups);
    });
  });

  describe("addPersonToGroup", () => {
    it("should call the library client with (groupId, uid) order", async () => {
      mockPeople.addToGroup.mockResolvedValue(undefined);

      await addPersonToGroup("abc-123", 42);

      expect(mockPeople.addToGroup).toHaveBeenCalledWith(42, "abc-123");
    });
  });

  describe("removePersonFromGroup", () => {
    it("should call the library client with (groupId, uid) order", async () => {
      mockPeople.removeFromGroup.mockResolvedValue(undefined);

      await removePersonFromGroup("abc-123", 42);

      expect(mockPeople.removeFromGroup).toHaveBeenCalledWith(42, "abc-123");
    });
  });

  describe("setPersonActive", () => {
    it("should call the library client with UID and status", async () => {
      mockPeople.setActive.mockResolvedValue(undefined);

      await setPersonActive("abc-123", false);

      expect(mockPeople.setActive).toHaveBeenCalledWith("abc-123", false);
    });
  });

  describe("createPerson", () => {
    it("should forward create params to the library client", async () => {
      const params = {
        FirstName: "New",
        LastName: "User",
        PrimaryEmail: "new.user@example.edu",
      };
      const mockPerson = { UID: "new-999", ...params };
      mockPeople.create.mockResolvedValue(mockPerson);

      const result = await createPerson(params);

      expect(mockPeople.create).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockPerson);
    });
  });

  describe("updatePerson", () => {
    it("should forward UID and update params to the library client", async () => {
      const params = { Title: "Analyst" };
      const mockPerson = { UID: "abc-123", Title: "Analyst" };
      mockPeople.update.mockResolvedValue(mockPerson);

      const result = await updatePerson("abc-123", params);

      expect(mockPeople.update).toHaveBeenCalledWith("abc-123", params);
      expect(result).toEqual(mockPerson);
    });
  });
});
