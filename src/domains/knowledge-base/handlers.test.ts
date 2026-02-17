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
    kbAppId: 50,
  })),
}));

import { tdxClient } from "../../http/client.js";
import { getConfig } from "../../config.js";
import { searchArticles, getArticle } from "./handlers.js";

const mockClient = tdxClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const mockGetConfig = getConfig as ReturnType<typeof vi.fn>;

describe("knowledge base handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ kbAppId: 50 });
  });

  describe("getAppId", () => {
    it("should use provided appId over config", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchArticles({ appId: 999 });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/999/knowledgebase/search",
        {},
      );
    });

    it("should fall back to config kbAppId", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchArticles({});
      expect(mockClient.post).toHaveBeenCalledWith(
        "/50/knowledgebase/search",
        {},
      );
    });

    it("should throw when neither appId nor config is available", async () => {
      mockGetConfig.mockReturnValue({ kbAppId: undefined });
      await expect(searchArticles({})).rejects.toThrow(
        /No KB app ID provided/,
      );
    });
  });

  describe("searchArticles", () => {
    it("should construct correct path and forward search params", async () => {
      const mockResults = [{ ID: 1, Title: "Test Article" }];
      mockClient.post.mockResolvedValue(mockResults);

      const result = await searchArticles({
        appId: 50,
        SearchText: "password reset",
        ReturnCount: 10,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        "/50/knowledgebase/search",
        {
          SearchText: "password reset",
          ReturnCount: 10,
        },
      );
      expect(result).toEqual(mockResults);
    });

    it("should strip appId from the search body", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchArticles({ appId: 50, CategoryID: 3 });

      const callBody = mockClient.post.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(callBody).not.toHaveProperty("appId");
      expect(callBody.CategoryID).toBe(3);
    });
  });

  describe("getArticle", () => {
    it("should construct correct path with article ID", async () => {
      const mockArticle = { ID: 42, Title: "How to reset password" };
      mockClient.get.mockResolvedValue(mockArticle);

      const result = await getArticle(42, 50);

      expect(mockClient.get).toHaveBeenCalledWith("/50/knowledgebase/42");
      expect(result).toEqual(mockArticle);
    });

    it("should use config appId when not provided", async () => {
      mockClient.get.mockResolvedValue({ ID: 1 });
      await getArticle(1);
      expect(mockClient.get).toHaveBeenCalledWith("/50/knowledgebase/1");
    });
  });
});
