import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the TdxClient before importing handlers.
 */
const mockLocations = {
  search: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getRooms: vi.fn(),
  getRoom: vi.fn(),
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
};

vi.mock("../../tdx-client.js", () => ({
  getTdxClient: vi.fn(() => ({
    locations: mockLocations,
  })),
}));

import {
  searchLocations,
  getLocation,
  createLocation,
  updateLocation,
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
} from "./handlers.js";

describe("location handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchLocations", () => {
    it("should forward search params to the library client", async () => {
      const mockResults = [{ ID: 1, Name: "Main Campus" }];
      mockLocations.search.mockResolvedValue(mockResults);

      const result = await searchLocations({
        SearchText: "main",
        MaxResults: 10,
      });

      expect(mockLocations.search).toHaveBeenCalledWith({
        SearchText: "main",
        MaxResults: 10,
      });
      expect(result).toEqual(mockResults);
    });

    it("should forward IsActive filter", async () => {
      mockLocations.search.mockResolvedValue([]);
      await searchLocations({ IsActive: true });

      expect(mockLocations.search).toHaveBeenCalledWith({ IsActive: true });
    });
  });

  describe("getLocation", () => {
    it("should call the library client with location ID", async () => {
      const mockLocation = { ID: 42, Name: "Science Building" };
      mockLocations.get.mockResolvedValue(mockLocation);

      const result = await getLocation(42);

      expect(mockLocations.get).toHaveBeenCalledWith(42);
      expect(result).toEqual(mockLocation);
    });
  });

  describe("createLocation", () => {
    it("should call the library client with location params", async () => {
      const params = { Name: "New Hall", City: "Chattanooga", State: "TN" };
      const mockResult = { ID: 99, ...params };
      mockLocations.create.mockResolvedValue(mockResult);

      const result = await createLocation(params);

      expect(mockLocations.create).toHaveBeenCalledWith(params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateLocation", () => {
    it("should call the library client with ID and params", async () => {
      const params = { Name: "Renamed Hall" };
      const mockResult = { ID: 7, Name: "Renamed Hall" };
      mockLocations.update.mockResolvedValue(mockResult);

      const result = await updateLocation(7, params);

      expect(mockLocations.update).toHaveBeenCalledWith(7, params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("getRooms", () => {
    it("should call the library client with location ID", async () => {
      const rooms = [{ ID: 1, Name: "Room 101", LocationID: 5 }];
      mockLocations.getRooms.mockResolvedValue(rooms);

      const result = await getRooms(5);

      expect(mockLocations.getRooms).toHaveBeenCalledWith(5);
      expect(result).toEqual(rooms);
    });
  });

  describe("getRoom", () => {
    it("should call the library client with location and room IDs", async () => {
      const room = { ID: 3, Name: "Lab A", LocationID: 5 };
      mockLocations.getRoom.mockResolvedValue(room);

      const result = await getRoom(5, 3);

      expect(mockLocations.getRoom).toHaveBeenCalledWith(5, 3);
      expect(result).toEqual(room);
    });
  });

  describe("createRoom", () => {
    it("should call the library client with location ID and room params", async () => {
      const params = { Name: "Room 202", Floor: "2" };
      const mockResult = { ID: 11, LocationID: 5, ...params };
      mockLocations.createRoom.mockResolvedValue(mockResult);

      const result = await createRoom(5, params);

      expect(mockLocations.createRoom).toHaveBeenCalledWith(5, params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateRoom", () => {
    it("should call the library client with location, room IDs and params", async () => {
      const params = { Name: "Room 202B" };
      const mockResult = { ID: 11, LocationID: 5, Name: "Room 202B" };
      mockLocations.updateRoom.mockResolvedValue(mockResult);

      const result = await updateRoom(5, 11, params);

      expect(mockLocations.updateRoom).toHaveBeenCalledWith(5, 11, params);
      expect(result).toEqual(mockResult);
    });
  });

  describe("deleteRoom", () => {
    it("should call the library client with location and room IDs", async () => {
      mockLocations.deleteRoom.mockResolvedValue(undefined);

      await deleteRoom(5, 11);

      expect(mockLocations.deleteRoom).toHaveBeenCalledWith(5, 11);
    });
  });
});
