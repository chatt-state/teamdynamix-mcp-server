import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockAssets = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
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
