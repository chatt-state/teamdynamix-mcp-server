import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockGroups = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    groups: mockGroups,
  })),
}));

import {
  searchGroups,
  getGroup,
  createGroup,
  updateGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
} from "./handlers.js";

describe("group handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchGroups", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ ID: 1, Name: "Help Desk", IsActive: true }];
      mockGroups.search.mockResolvedValue(mockResults);

      const result = await searchGroups({
        SearchText: "help",
        IsActive: true,
        MaxResults: 10,
      });

      expect(mockGroups.search).toHaveBeenCalledWith({
        SearchText: "help",
        IsActive: true,
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });
  });

  describe("getGroup", () => {
    it("should call the library client with group ID", async () => {
      const mockGroup = { ID: 42, Name: "Networking", IsActive: true };
      mockGroups.get.mockResolvedValue(mockGroup);

      const result = await getGroup(42);

      expect(mockGroups.get).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockGroup);
    });
  });

  describe("createGroup", () => {
    it("should call the library client with group params", async () => {
      const params = { Name: "Field Services", IsActive: true };
      const mockResult = { ID: 99, ...params };
      mockGroups.create.mockResolvedValue(mockResult);

      const result = await createGroup(params);

      expect(mockGroups.create).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateGroup", () => {
    it("should call the library client with ID and update params", async () => {
      const params = { Name: "Renamed Group" };
      const mockResult = { ID: 7, Name: "Renamed Group", IsActive: true };
      mockGroups.update.mockResolvedValue(mockResult);

      const result = await updateGroup(7, params);

      expect(mockGroups.update).toHaveBeenCalledWith(7, params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("getGroupMembers", () => {
    it("should return members from the library client", async () => {
      const members = [{ UID: "abc", FullName: "Jane Doe", IsPrimary: true }];
      mockGroups.getMembers.mockResolvedValue(members);

      const result = await getGroupMembers(42);

      expect(mockGroups.getMembers).toHaveBeenCalledWith(42);
      expect(result).toEqual(members);
    });
  });

  describe("addGroupMember", () => {
    it("should forward group ID, uid, and isPrimary", async () => {
      mockGroups.addMember.mockResolvedValue(undefined);

      await addGroupMember(42, "abc-uid", true);

      expect(mockGroups.addMember).toHaveBeenCalledWith(42, "abc-uid", true);
    });

    it("should forward undefined isPrimary when omitted", async () => {
      mockGroups.addMember.mockResolvedValue(undefined);

      await addGroupMember(42, "abc-uid");

      expect(mockGroups.addMember).toHaveBeenCalledWith(
        42,
        "abc-uid",
        undefined,
      );
    });
  });

  describe("removeGroupMember", () => {
    it("should forward group ID and uid", async () => {
      mockGroups.removeMember.mockResolvedValue(undefined);

      await removeGroupMember(42, "abc-uid");

      expect(mockGroups.removeMember).toHaveBeenCalledWith(42, "abc-uid");
    });
  });
});
