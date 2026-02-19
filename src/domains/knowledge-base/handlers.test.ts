import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockKnowledgeBase = {
  search: vi.fn(),
  get: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    knowledgeBase: mockKnowledgeBase,
  })),
}));

import { searchArticles, getArticle } from "./handlers.js";

describe("knowledge base handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchArticles", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ ID: 1, Title: "Test Article" }];
      mockKnowledgeBase.search.mockResolvedValue(mockResults);

      const result = await searchArticles({
        SearchText: "password reset",
        MaxResults: 10,
      });

      expect(mockKnowledgeBase.search).toHaveBeenCalledWith({
        SearchText: "password reset",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });
  });

  describe("getArticle", () => {
    it("should call the library client with article ID", async () => {
      const mockArticle = { ID: 42, Title: "How to reset password" };
      mockKnowledgeBase.get.mockResolvedValue(mockArticle);

      const result = await getArticle(42);

      expect(mockKnowledgeBase.get).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockArticle);
    });
  });
});
