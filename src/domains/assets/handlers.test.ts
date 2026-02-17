import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the HTTP client before importing handlers.
 */
vi.mock("../../http/client.js", () => ({
  tdxClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../config.js", () => ({
  getConfig: vi.fn(() => ({
    assetsAppId: 500,
  })),
}));

import { tdxClient } from "../../http/client.js";
import { getConfig } from "../../config.js";
import { searchAssets, getAsset } from "./handlers.js";

const mockClient = tdxClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const mockGetConfig = getConfig as ReturnType<typeof vi.fn>;

describe("asset handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ assetsAppId: 500 });
  });

  describe("getAppId", () => {
    it("should use provided appId over config", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchAssets({ appId: 999 });
      expect(mockClient.post).toHaveBeenCalledWith("/999/assets/search", {});
    });

    it("should fall back to config assetsAppId", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchAssets({});
      expect(mockClient.post).toHaveBeenCalledWith("/500/assets/search", {});
    });

    it("should throw when neither appId nor config is available", async () => {
      mockGetConfig.mockReturnValue({ assetsAppId: undefined });
      await expect(searchAssets({})).rejects.toThrow(
        /No assets app ID provided/,
      );
    });
  });

  describe("searchAssets", () => {
    it("should construct correct path and forward search params", async () => {
      const mockResults = [{ ID: 1, Name: "Laptop" }];
      mockClient.post.mockResolvedValue(mockResults);

      const result = await searchAssets({
        appId: 500,
        SearchText: "laptop",
        MaxResults: 10,
      });

      expect(mockClient.post).toHaveBeenCalledWith("/500/assets/search", {
        SearchText: "laptop",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should strip appId from the search body", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchAssets({ appId: 500, StatusIDs: [1, 2] });

      const callBody = mockClient.post.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(callBody).not.toHaveProperty("appId");
      expect(callBody.StatusIDs).toEqual([1, 2]);
    });
  });

  describe("getAsset", () => {
    it("should construct correct path with asset ID", async () => {
      const mockAsset = { ID: 42, Name: "Desktop PC" };
      mockClient.get.mockResolvedValue(mockAsset);

      const result = await getAsset(42, 500);

      expect(mockClient.get).toHaveBeenCalledWith("/500/assets/42");
      expect(result).toEqual(mockAsset);
    });

    it("should use config appId when not provided", async () => {
      mockClient.get.mockResolvedValue({ ID: 1 });
      await getAsset(1);
      expect(mockClient.get).toHaveBeenCalledWith("/500/assets/1");
    });
  });
});
