import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockAccounts = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    accounts: mockAccounts,
  })),
}));

import {
  searchAccounts,
  getAccount,
  createAccount,
  updateAccount,
} from "./handlers.js";

describe("account handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchAccounts", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ ID: 1, Name: "Information Technology" }];
      mockAccounts.search.mockResolvedValue(mockResults);

      const result = await searchAccounts({
        SearchText: "Information",
        MaxResults: 10,
      });

      expect(mockAccounts.search).toHaveBeenCalledWith({
        SearchText: "Information",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should forward the IsActive filter", async () => {
      mockAccounts.search.mockResolvedValue([]);

      await searchAccounts({ IsActive: true });

      expect(mockAccounts.search).toHaveBeenCalledWith({ IsActive: true });
    });
  });

  describe("getAccount", () => {
    it("should call the library client with account ID", async () => {
      const mockAccount = { ID: 42, Name: "Registrar" };
      mockAccounts.get.mockResolvedValue(mockAccount);

      const result = await getAccount(42);

      expect(mockAccounts.get).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockAccount);
    });
  });

  describe("createAccount", () => {
    it("should call the library client with account params", async () => {
      const params = { Name: "Facilities", City: "Chattanooga", State: "TN" };
      const mockResult = { ID: 99, IsActive: true, ...params };
      mockAccounts.create.mockResolvedValue(mockResult);

      const result = await createAccount(params);

      expect(mockAccounts.create).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateAccount", () => {
    it("should call the library client with ID and update params", async () => {
      const params = { Name: "Facilities Management" };
      const mockResult = { ID: 99, Name: "Facilities Management" };
      mockAccounts.update.mockResolvedValue(mockResult);

      const result = await updateAccount(99, params);

      expect(mockAccounts.update).toHaveBeenCalledWith(99, params);
      expect(result).toEqual(mockResult);
    });
  });
});
