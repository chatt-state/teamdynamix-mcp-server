import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockTickets = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getFeed: vi.fn(),
  addFeedEntry: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    tickets: mockTickets,
  })),
}));

import {
  searchTickets,
  getTicket,
  createTicket,
  updateTicket,
  getTicketFeed,
  addTicketFeedEntry,
} from "./handlers.js";

describe("ticket handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchTickets", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ ID: 1, Title: "Test" }];
      mockTickets.search.mockResolvedValue(mockResults);

      const result = await searchTickets({
        SearchText: "network",
        MaxResults: 10,
      });

      expect(mockTickets.search).toHaveBeenCalledWith({
        SearchText: "network",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });
  });

  describe("getTicket", () => {
    it("should call the library client with ticket ID", async () => {
      const mockTicket = { ID: 42, Title: "Broken printer" };
      mockTickets.get.mockResolvedValue(mockTicket);

      const result = await getTicket(42);

      expect(mockTickets.get).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockTicket);
    });
  });

  describe("createTicket", () => {
    it("should forward ticket data to the library client", async () => {
      const ticketData = {
        Title: "New ticket",
        TypeID: 5,
        AccountID: 1,
        StatusID: 1,
        PriorityID: 1,
        RequestorUid: "abc-123",
      };
      const mockCreated = { ID: 100, Title: "New ticket" };
      mockTickets.create.mockResolvedValue(mockCreated);

      const result = await createTicket(ticketData);

      expect(mockTickets.create).toHaveBeenCalledWith(ticketData);
      expect(result).toEqual(mockCreated);
    });
  });

  describe("updateTicket", () => {
    it("should forward update data to the library client", async () => {
      const updateData = { Title: "Updated title" };
      const mockUpdated = { ID: 42, Title: "Updated title" };
      mockTickets.update.mockResolvedValue(mockUpdated);

      const result = await updateTicket(42, updateData);

      expect(mockTickets.update).toHaveBeenCalledWith(42, updateData);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe("getTicketFeed", () => {
    it("should call the library client for feed", async () => {
      const mockFeed = [{ ID: 1, Comments: "Comment" }];
      mockTickets.getFeed.mockResolvedValue(mockFeed);

      const result = await getTicketFeed(42);

      expect(mockTickets.getFeed).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockFeed);
    });
  });

  describe("addTicketFeedEntry", () => {
    it("should forward feed entry to the library client", async () => {
      const entry = { Comments: "New comment", IsPrivate: false };
      const mockEntry = { ID: 10, Comments: "New comment" };
      mockTickets.addFeedEntry.mockResolvedValue(mockEntry);

      const result = await addTicketFeedEntry(42, entry);

      expect(mockTickets.addFeedEntry).toHaveBeenCalledWith(42, entry);
      expect(result).toEqual(mockEntry);
    });
  });
});
