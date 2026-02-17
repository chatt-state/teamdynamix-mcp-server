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

import { tdxClient } from "../../http/client.js";
import { searchPeople, getPerson } from "./handlers.js";

const mockClient = tdxClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("people handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchPeople", () => {
    it("should POST to /people/search with search params", async () => {
      const mockResults = [{ UID: "abc-123", FirstName: "John", LastName: "Doe" }];
      mockClient.post.mockResolvedValue(mockResults);

      const result = await searchPeople({
        SearchText: "John",
        MaxResults: 10,
      });

      expect(mockClient.post).toHaveBeenCalledWith("/people/search", {
        SearchText: "John",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should POST to /people/search with empty params", async () => {
      mockClient.post.mockResolvedValue([]);

      const result = await searchPeople({});

      expect(mockClient.post).toHaveBeenCalledWith("/people/search", {});
      expect(result).toEqual([]);
    });

    it("should forward IsActive and IsEmployee filters", async () => {
      mockClient.post.mockResolvedValue([]);

      await searchPeople({ IsActive: true, IsEmployee: false });

      expect(mockClient.post).toHaveBeenCalledWith("/people/search", {
        IsActive: true,
        IsEmployee: false,
      });
    });

    it("should not include appId in the URL path", async () => {
      mockClient.post.mockResolvedValue([]);

      await searchPeople({ SearchText: "test" });

      const callPath = mockClient.post.mock.calls[0][0] as string;
      expect(callPath).toBe("/people/search");
      expect(callPath).not.toMatch(/\/\d+\//);
    });
  });

  describe("getPerson", () => {
    it("should GET /people/{uid} for a UID", async () => {
      const mockPerson = { UID: "abc-123", FirstName: "Jane", LastName: "Smith" };
      mockClient.get.mockResolvedValue(mockPerson);

      const result = await getPerson("abc-123");

      expect(mockClient.get).toHaveBeenCalledWith("/people/abc-123");
      expect(result).toEqual(mockPerson);
    });

    it("should GET /people/{username} for a username", async () => {
      const mockPerson = { UID: "def-456", FirstName: "Bob", LastName: "Jones" };
      mockClient.get.mockResolvedValue(mockPerson);

      const result = await getPerson("bjones");

      expect(mockClient.get).toHaveBeenCalledWith("/people/bjones");
      expect(result).toEqual(mockPerson);
    });

    it("should not include appId in the URL path", async () => {
      mockClient.get.mockResolvedValue({ UID: "abc-123" });

      await getPerson("abc-123");

      const callPath = mockClient.get.mock.calls[0][0] as string;
      expect(callPath).toBe("/people/abc-123");
      expect(callPath).not.toMatch(/\/\d+\//);
    });
  });
});
