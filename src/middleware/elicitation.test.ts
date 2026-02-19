import { describe, it, expect, vi, beforeEach } from "vitest";

const mockElicitInput = vi.hoisted(() => vi.fn());

vi.mock("../server.js", () => ({
  mcpServer: {
    server: {
      elicitInput: mockElicitInput,
    },
  },
}));

import { elicitChoice } from "./elicitation.js";

const sampleOptions = [
  { id: 1, name: "Incident" },
  { id: 2, name: "Service Request" },
  { id: 3, name: "Problem" },
];

describe("elicitChoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the selected ID when user accepts", async () => {
    mockElicitInput.mockResolvedValue({
      action: "accept",
      content: { typeId: "2" },
    });

    const result = await elicitChoice(
      "Select a type:",
      "typeId",
      "Type",
      sampleOptions,
    );

    expect(result).toBe(2);
    expect(mockElicitInput).toHaveBeenCalledWith({
      mode: "form",
      message: "Select a type:",
      requestedSchema: {
        type: "object",
        properties: {
          typeId: {
            type: "string",
            title: "Type",
            enum: ["1", "2", "3"],
            enumNames: ["Incident", "Service Request", "Problem"],
          },
        },
        required: ["typeId"],
      },
    });
  });

  it("should return null when user declines", async () => {
    mockElicitInput.mockResolvedValue({
      action: "decline",
    });

    const result = await elicitChoice(
      "Select a type:",
      "typeId",
      "Type",
      sampleOptions,
    );

    expect(result).toBeNull();
  });

  it("should return null when elicitation is not supported", async () => {
    mockElicitInput.mockRejectedValue(new Error("Elicitation not supported"));

    const result = await elicitChoice(
      "Select a type:",
      "typeId",
      "Type",
      sampleOptions,
    );

    expect(result).toBeNull();
  });

  it("should return null when options list is empty", async () => {
    const result = await elicitChoice("Select:", "field", "Field", []);

    expect(result).toBeNull();
    expect(mockElicitInput).not.toHaveBeenCalled();
  });

  it("should return null when accept has no content", async () => {
    mockElicitInput.mockResolvedValue({
      action: "accept",
      content: null,
    });

    const result = await elicitChoice(
      "Select:",
      "typeId",
      "Type",
      sampleOptions,
    );

    expect(result).toBeNull();
  });
});
