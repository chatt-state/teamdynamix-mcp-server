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
    ticketingAppId: 431,
  })),
}));

import { tdxClient } from "../../http/client.js";
import { getConfig } from "../../config.js";
import {
  searchTickets,
  getTicket,
  createTicket,
  updateTicket,
  getTicketFeed,
  addTicketFeedEntry,
} from "./handlers.js";

const mockClient = tdxClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const mockGetConfig = getConfig as ReturnType<typeof vi.fn>;

describe("ticket handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ ticketingAppId: 431 });
  });

  describe("getAppId", () => {
    it("should use provided appId over config", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchTickets({ appId: 999 });
      expect(mockClient.post).toHaveBeenCalledWith("/999/tickets/search", {});
    });

    it("should fall back to config ticketingAppId", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchTickets({});
      expect(mockClient.post).toHaveBeenCalledWith("/431/tickets/search", {});
    });

    it("should throw when neither appId nor config is available", async () => {
      mockGetConfig.mockReturnValue({ ticketingAppId: undefined });
      await expect(searchTickets({})).rejects.toThrow(
        /No ticketing app ID provided/,
      );
    });
  });

  describe("searchTickets", () => {
    it("should construct correct path and forward search params", async () => {
      const mockResults = [{ ID: 1, Title: "Test" }];
      mockClient.post.mockResolvedValue(mockResults);

      const result = await searchTickets({
        appId: 431,
        SearchText: "network",
        MaxResults: 10,
      });

      expect(mockClient.post).toHaveBeenCalledWith("/431/tickets/search", {
        SearchText: "network",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should strip appId from the search body", async () => {
      mockClient.post.mockResolvedValue([]);
      await searchTickets({ appId: 431, StatusIDs: [1, 2] });

      const callBody = mockClient.post.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(callBody).not.toHaveProperty("appId");
      expect(callBody.StatusIDs).toEqual([1, 2]);
    });
  });

  describe("getTicket", () => {
    it("should construct correct path with ticket ID", async () => {
      const mockTicket = { ID: 42, Title: "Broken printer" };
      mockClient.get.mockResolvedValue(mockTicket);

      const result = await getTicket(42, 431);

      expect(mockClient.get).toHaveBeenCalledWith("/431/tickets/42");
      expect(result).toEqual(mockTicket);
    });

    it("should use config appId when not provided", async () => {
      mockClient.get.mockResolvedValue({ ID: 1 });
      await getTicket(1);
      expect(mockClient.get).toHaveBeenCalledWith("/431/tickets/1");
    });
  });

  describe("createTicket", () => {
    it("should post ticket data to correct path", async () => {
      const ticketData = { Title: "New ticket", TypeID: 5 };
      const mockCreated = { ID: 100, Title: "New ticket" };
      mockClient.post.mockResolvedValue(mockCreated);

      const result = await createTicket(ticketData, 431);

      expect(mockClient.post).toHaveBeenCalledWith(
        "/431/tickets",
        ticketData,
      );
      expect(result).toEqual(mockCreated);
    });
  });

  describe("updateTicket", () => {
    it("should post update data to correct path with ticket ID", async () => {
      const updateData = { Title: "Updated title" };
      const mockUpdated = { ID: 42, Title: "Updated title" };
      mockClient.post.mockResolvedValue(mockUpdated);

      const result = await updateTicket(42, updateData, 431);

      expect(mockClient.post).toHaveBeenCalledWith(
        "/431/tickets/42",
        updateData,
      );
      expect(result).toEqual(mockUpdated);
    });
  });

  describe("getTicketFeed", () => {
    it("should construct correct feed path", async () => {
      const mockFeed = [{ ID: 1, Body: "Comment" }];
      mockClient.get.mockResolvedValue(mockFeed);

      const result = await getTicketFeed(42, 431);

      expect(mockClient.get).toHaveBeenCalledWith("/431/tickets/42/feed");
      expect(result).toEqual(mockFeed);
    });
  });

  describe("addTicketFeedEntry", () => {
    it("should post feed entry to correct path", async () => {
      const entry = { Body: "New comment", IsPrivate: false };
      const mockEntry = { ID: 10, Body: "New comment" };
      mockClient.post.mockResolvedValue(mockEntry);

      const result = await addTicketFeedEntry(42, entry, 431);

      expect(mockClient.post).toHaveBeenCalledWith(
        "/431/tickets/42/feed",
        entry,
      );
      expect(result).toEqual(mockEntry);
    });
  });
});
