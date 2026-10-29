import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockAssets = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getAttachments: vi.fn(),
  getFeed: vi.fn(),
  getStatuses: vi.fn(),
  getForms: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    assets: mockAssets,
  })),
}));

import {
  searchAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetAttachments,
  getAssetFeed,
  getAssetStatuses,
  getAssetForms,
} from "./handlers.js";

describe("asset handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchAssets", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ ID: 1, Name: "Laptop" }];
      mockAssets.search.mockResolvedValue(mockResults);

      const result = await searchAssets({
        SearchText: "laptop",
        MaxResults: 10,
      });

      expect(mockAssets.search).toHaveBeenCalledWith({
        SearchText: "laptop",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should forward StatusIDs filter", async () => {
      mockAssets.search.mockResolvedValue([]);
      await searchAssets({ StatusIDs: [1, 2] });

      expect(mockAssets.search).toHaveBeenCalledWith({
        StatusIDs: [1, 2],
      });
    });
  });

  describe("getAsset", () => {
    it("should call the library client with asset ID", async () => {
      const mockAsset = { ID: 42, Name: "Desktop PC" };
      mockAssets.get.mockResolvedValue(mockAsset);

      const result = await getAsset(42);

      expect(mockAssets.get).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockAsset);
    });
  });

  describe("createAsset", () => {
    it("should call the library client with asset params", async () => {
      const params = { Name: "New Laptop", StatusID: 1, FormID: 10 };
      const mockResult = { ID: 99, ...params };
      mockAssets.create.mockResolvedValue(mockResult);

      const result = await createAsset(params);

      expect(mockAssets.create).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateAsset", () => {
    it("should call the library client with asset ID and params", async () => {
      const params = { Name: "Renamed Laptop", StatusID: 2 };
      const mockResult = { ID: 42, ...params };
      mockAssets.update.mockResolvedValue(mockResult);

      const result = await updateAsset(42, params);

      expect(mockAssets.update).toHaveBeenCalledWith(42, params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("deleteAsset", () => {
    it("should call the library client with asset ID", async () => {
      mockAssets.delete.mockResolvedValue(undefined);

      await deleteAsset(42);

      expect(mockAssets.delete).toHaveBeenCalledWith(42);
    });
  });

  describe("getAssetAttachments", () => {
    it("should return attachments from the library client", async () => {
      const attachments = [
        { ID: 1, Name: "receipt.pdf", Size: 1024, ContentType: "application/pdf" },
      ];
      mockAssets.getAttachments.mockResolvedValue(attachments);

      const result = await getAssetAttachments(42);

      expect(mockAssets.getAttachments).toHaveBeenCalledWith(42);
      expect(result).toEqual(attachments);
    });
  });

  describe("getAssetFeed", () => {
    it("should return feed entries from the library client", async () => {
      const feed = [{ ID: 5, Comments: "Checked in", CreatedFullName: "Jane Doe" }];
      mockAssets.getFeed.mockResolvedValue(feed);

      const result = await getAssetFeed(42);

      expect(mockAssets.getFeed).toHaveBeenCalledWith(42);
      expect(result).toEqual(feed);
    });
  });

  describe("getAssetStatuses", () => {
    it("should return statuses from the library client", async () => {
      const statuses = [{ ID: 1, Name: "In Use", IsActive: true }];
      mockAssets.getStatuses.mockResolvedValue(statuses);

      const result = await getAssetStatuses();

      expect(mockAssets.getStatuses).toHaveBeenCalled();
      expect(result).toEqual(statuses);
    });
  });

  describe("getAssetForms", () => {
    it("should return forms from the library client", async () => {
      const forms = [{ ID: 10, Name: "Laptop Form", IsActive: true }];
      mockAssets.getForms.mockResolvedValue(forms);

      const result = await getAssetForms();

      expect(mockAssets.getForms).toHaveBeenCalled();
      expect(result).toEqual(forms);
    });
  });
});
