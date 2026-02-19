import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockPeople = {
  search: vi.fn(),
  get: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    people: mockPeople,
  })),
}));

import { searchPeople, getPerson } from "./handlers.js";

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
});
