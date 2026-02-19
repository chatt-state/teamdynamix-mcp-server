import { describe, it, expect } from "vitest";
import { TdxApiError } from "@chatt-state/node-teamdynamix";
import {
  formatMcpError,
  wrapToolHandler,
  type McpErrorResponse,
} from "./error-handler.js";

describe("formatMcpError", () => {
  it("should format TdxApiError with status and message", () => {
    const error = new TdxApiError(404, "Not Found", "Ticket not found", "tickets");
    const result = formatMcpError(error);

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("404");
    expect(result.content[0].text).toContain("Not Found");
    expect(result.content[0].text).toContain("Ticket not found");
  });

  it("should format generic Error with message", () => {
    const error = new Error("Something went wrong");
    const result = formatMcpError(error);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Something went wrong");
  });

  it("should format unknown error with generic message", () => {
    const result = formatMcpError("just a string");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
  });

  it("should format null error with generic message", () => {
    const result = formatMcpError(null);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
  });

  it("should format undefined error with generic message", () => {
    const result = formatMcpError(undefined);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
  });
});

describe("wrapToolHandler", () => {
  it("should return the handler result on success", async () => {
    const data = { id: 1, title: "Test" };
    const result = await wrapToolHandler(() => Promise.resolve(data));

    expect(result).toEqual(data);
  });

  it("should return MCP error response on TdxApiError", async () => {
    const result = await wrapToolHandler(() => {
      throw new TdxApiError(500, "Internal Server Error", "Server error", "tickets");
    });

    const errorResult = result as McpErrorResponse;
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain("500");
  });

  it("should return MCP error response on generic Error", async () => {
    const result = await wrapToolHandler(() => {
      throw new Error("Something failed");
    });

    const errorResult = result as McpErrorResponse;
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain("Something failed");
  });

  it("should return MCP error response on async rejection", async () => {
    const result = await wrapToolHandler(async () => {
      throw new Error("Async failure");
    });

    const errorResult = result as McpErrorResponse;
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain("Async failure");
  });

  it("should handle non-Error throws", async () => {
    const result = await wrapToolHandler(() => {
      throw 42;
    });

    const errorResult = result as McpErrorResponse;
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toBe("An unexpected error occurred");
  });
});
