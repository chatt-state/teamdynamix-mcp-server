import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers. The CMDB handlers delegate to
 * the client's `cmdb` resource, so we stub every method it calls.
 */
const mockCmdb = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getFeed: vi.fn(),
  getRelationships: vi.fn(),
  addRelationship: vi.fn(),
  removeRelationship: vi.fn(),
  addAttachment: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    cmdb: mockCmdb,
  })),
}));

import {
  searchConfigurationItems,
  getConfigurationItem,
  createConfigurationItem,
  updateConfigurationItem,
  deleteConfigurationItem,
  getCIFeed,
  getCIRelationships,
  addCIRelationship,
  removeCIRelationship,
  addCIAttachment,
} from "./handlers.js";

describe("cmdb handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchConfigurationItems", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ ID: 1, Name: "Core Switch" }];
      mockCmdb.search.mockResolvedValue(mockResults);

      const result = await searchConfigurationItems({
        SearchText: "switch",
        MaxResults: 10,
      });

      expect(mockCmdb.search).toHaveBeenCalledWith({
        SearchText: "switch",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should forward TypeIDs and IsActive filters", async () => {
      mockCmdb.search.mockResolvedValue([]);
      await searchConfigurationItems({ TypeIDs: [5, 6], IsActive: true });

      expect(mockCmdb.search).toHaveBeenCalledWith({
        TypeIDs: [5, 6],
        IsActive: true,
      });
    });
  });

  describe("getConfigurationItem", () => {
    it("should call the library client with the CI ID", async () => {
      const mockCi = { ID: 42, Name: "App Server" };
      mockCmdb.get.mockResolvedValue(mockCi);

      const result = await getConfigurationItem(42);

      expect(mockCmdb.get).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockCi);
    });
  });

  describe("createConfigurationItem", () => {
    it("should call the library client with CI params", async () => {
      const params = { Name: "New CI", TypeID: 3, FormID: 7 };
      const mockResult = { ID: 99, ...params };
      mockCmdb.create.mockResolvedValue(mockResult);

      const result = await createConfigurationItem(params);

      expect(mockCmdb.create).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateConfigurationItem", () => {
    it("should call the library client with id and update params", async () => {
      const mockResult = { ID: 42, Name: "Renamed CI" };
      mockCmdb.update.mockResolvedValue(mockResult);

      const result = await updateConfigurationItem(42, { Name: "Renamed CI" });

      expect(mockCmdb.update).toHaveBeenCalledWith(42, { Name: "Renamed CI" });
      expect(result).toEqual(mockResult);
    });
  });

  describe("deleteConfigurationItem", () => {
    it("should call the library client with the CI ID", async () => {
      mockCmdb.delete.mockResolvedValue(undefined);

      await deleteConfigurationItem(42);

      expect(mockCmdb.delete).toHaveBeenCalledWith(42);
    });
  });

  describe("getCIFeed", () => {
    it("should return the feed from the library client", async () => {
      const feed = [{ ID: 1, Comments: "Updated" }];
      mockCmdb.getFeed.mockResolvedValue(feed);

      const result = await getCIFeed(42);

      expect(mockCmdb.getFeed).toHaveBeenCalledWith(42);
      expect(result).toEqual(feed);
    });
  });

  describe("getCIRelationships", () => {
    it("should return relationships from the library client", async () => {
      const rels = [{ ID: 1, RelatedItemID: 2, TypeID: 3, IsReverse: false }];
      mockCmdb.getRelationships.mockResolvedValue(rels);

      const result = await getCIRelationships(42);

      expect(mockCmdb.getRelationships).toHaveBeenCalledWith(42);
      expect(result).toEqual(rels);
    });
  });

  describe("addCIRelationship", () => {
    it("should call the library client with id, relatedId and typeId", async () => {
      mockCmdb.addRelationship.mockResolvedValue(undefined);

      await addCIRelationship(42, 100, 5);

      expect(mockCmdb.addRelationship).toHaveBeenCalledWith(42, 100, 5);
    });
  });

  describe("removeCIRelationship", () => {
    it("should call the library client with id and relationshipId", async () => {
      mockCmdb.removeRelationship.mockResolvedValue(undefined);

      await removeCIRelationship(42, 7);

      expect(mockCmdb.removeRelationship).toHaveBeenCalledWith(42, 7);
    });
  });

  describe("addCIAttachment", () => {
    it("should call the library client with id, file and fileName", async () => {
      const attachment = { ID: 1, Name: "diagram.png" };
      mockCmdb.addAttachment.mockResolvedValue(attachment);
      const file = Buffer.from("hello", "utf8");

      const result = await addCIAttachment(42, file, "diagram.png");

      expect(mockCmdb.addAttachment).toHaveBeenCalledWith(
        42,
        file,
        "diagram.png",
      );
      expect(result).toEqual(attachment);
    });
  });
});
