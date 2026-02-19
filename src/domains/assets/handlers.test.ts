import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockAssets = {
  search: vi.fn(),
  get: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    assets: mockAssets,
  })),
}));

import { searchAssets, getAsset } from "./handlers.js";

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
});
